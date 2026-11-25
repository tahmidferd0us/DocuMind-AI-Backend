import path from 'node:path';
import crypto from 'node:crypto';
import { AppError } from '../../core/errors/AppError.js';
import { logger } from '../../core/utils/logger.js';
import { nlpClient } from '../../services/nlpClient.js';
import { env } from '../../config/env.js';
import { getSupabaseAdmin } from '../../config/supabase.js';
import * as repository from './documents.repository.js';
import { toPublicDocument } from './documents.mapper.js';
import { incrementDocumentCount } from '../subscriptions/subscriptions.repository.js';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

export const assertSupportedFile = (file) => {
  if (!file) throw AppError.badRequest('No file was uploaded');
  if (file.size === 0) throw AppError.badRequest('Uploaded file is empty (0 bytes)');
  const extension = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) throw AppError.badRequest(`Only ${ALLOWED_EXTENSIONS.join(', ')} files are supported`);
};

export const ingestDocument = async (userId, file) => {
  assertSupportedFile(file);

  const storagePath = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? `${userId}/${crypto.randomUUID()}/${path.basename(file.originalname)}` : null;
  if (storagePath) {
    const { error } = await getSupabaseAdmin().storage.from(env.SUPABASE_STORAGE_BUCKET).upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) {
      logger.warn('Document storage upload failed', { userId, code: error.name ?? 'STORAGE_ERROR' });
      throw AppError.unavailable('Document storage is temporarily unavailable. Please try again shortly.');
    }
  }
  let document;
  try {
    document = await repository.createDocument({
      userId,
      filename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      status: 'PROCESSING',
      processingStep: 'Queued for processing',
      progress: 0,
      ...(storagePath ? { storagePath } : { sourceFile: file.buffer }),
    });
  } catch (error) {
    if (storagePath) await getSupabaseAdmin().storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storagePath]).catch(() => {});
    throw error;
  }
  return toPublicDocument(document);
};

const MAX_PROCESSING_ATTEMPTS = 3;

export const processDocument = async (documentId) => {
  const claimed = await repository.claimDocument(documentId);
  if (!claimed.count) return false;
  const document = await repository.findDocumentForProcessing(documentId);
  try {
    let sourceFile = document.sourceFile;
    if (!sourceFile && document.storagePath) {
      const { data, error } = await getSupabaseAdmin().storage.from(env.SUPABASE_STORAGE_BUCKET).download(document.storagePath);
      if (error) throw AppError.unavailable('The original file could not be retrieved from storage. Retry later or upload it again.');
      sourceFile = Buffer.from(await data.arrayBuffer());
    }
    const parsed = await nlpClient.parseDocument(sourceFile, document.filename);
    const text = parsed.cleaned_text ?? parsed.raw_text ?? '';
    if (!text.trim()) throw AppError.badRequest('No readable text could be extracted from this document');

    await repository.updateDocument(document.id, { processingStep: 'Saving extracted pages', progress: 75 });
    const ready = await repository.updateDocument(document.id, {
      status: 'READY', processingStep: 'Complete', progress: 100, processingStartedAt: null, sourceFile: null,
      extractedText: text, pageCount: parsed.page_count ?? null,
      wordCount: parsed.total_words ?? text.trim().split(/\s+/).length,
      charCount: parsed.total_characters ?? text.length,
      pages: (parsed.pages ?? []).map((page) => ({ page_number: page.page_number, cleaned_text: page.cleaned_text })),
      errorMessage: null,
    });
    try {
      await incrementDocumentCount(document.userId, undefined, 1, document.sizeBytes);
    } catch (quotaError) {
      logger.warn('Failed to increment document quota', { userId: document.userId, code: quotaError?.code ?? 'USAGE_ACCOUNTING_ERROR' });
    }
    logger.info('Document processing completed', { documentId });
    return ready;
  } catch (error) {
    const exhausted = document.attemptCount >= MAX_PROCESSING_ATTEMPTS;
    logger.error('Document processing attempt failed', { documentId, attempt: document.attemptCount, code: error?.code ?? 'PROCESSING_ERROR' });
    await repository.updateDocument(documentId, {
      status: exhausted ? 'FAILED' : 'PROCESSING',
      processingStep: exhausted ? 'Failed' : 'Retry scheduled',
      progress: 0,
      processingStartedAt: null,
      errorMessage: error?.statusCode === 503 || error?.code === 'NLP_SERVICE_UNAVAILABLE' ? 'The analysis service is temporarily unavailable. Retry will be available after this job finishes.' : error?.statusCode === 504 ? 'Analysis timed out. Try again, or upload a smaller document.' : error?.statusCode === 502 ? 'The analysis service could not process this document. Check the format and retry.' : error?.statusCode === 400 ? error.message : 'Document processing failed. Retry later or upload the document again.',
    });
    return false;
  }
};

export const retryDocument = async (userId, id) => {
  const document = await repository.findDocumentForRetry(id, userId);
  if (!document) throw AppError.notFound('Document not found');
  if (document.status !== 'FAILED') throw AppError.conflict('Only failed documents can be retried');
  if (!document.sourceFile && !document.storagePath) throw AppError.badRequest('The original upload is unavailable. Upload this document again to process it.');
  const updated = await repository.updateDocument(id, { status: 'PROCESSING', processingStep: 'Queued for retry', progress: 0, attemptCount: 0, processingStartedAt: null, errorMessage: null });
  return toPublicDocument(updated);
};

export const listDocuments = async (userId, { page, limit, search, status, tag, folder, sort }) => {
  const [items, total] = await repository.listDocuments({
    userId,
    skip: (page - 1) * limit,
    take: limit,
    search,
    status,
    tag,
    folder,
    sort,
  });
  return { items: items.map(toPublicDocument), total };
};

export const getDocument = async (userId, id) => {
  const document = await repository.findDocumentSummary(id, userId);
  if (!document) throw AppError.notFound('Document not found');
  return toPublicDocument(document);
};

export const getDocumentText = async (userId, id) => {
  const document = await repository.findDocumentById(id, userId);
  if (!document) throw AppError.notFound('Document not found');
  if (document.status !== 'READY') throw AppError.badRequest(`Document is ${document.status.toLowerCase()} and has no text yet`);
  return document;
};

export const removeDocument = async (userId, id) => {
  const document = await repository.findOwnedDocument(id, userId);
  if (!document) throw AppError.notFound('Document not found');
  if (document.status === 'READY') {
    try { await nlpClient.deleteRagIndex(document.id); }
    catch (error) {
      logger.warn('Document search index cleanup failed', { documentId: id, code: error?.code ?? 'NLP_SERVICE_ERROR' });
      throw AppError.unavailable('The document’s derived search index could not be removed because the analysis service is unavailable. The document was kept; retry deletion later.');
    }
  }
  if (document.storagePath) {
    const { error } = await getSupabaseAdmin().storage.from(env.SUPABASE_STORAGE_BUCKET).remove([document.storagePath]);
    if (error) {
      logger.warn('Document storage deletion failed', { documentId: id, code: error.name ?? 'STORAGE_ERROR' });
      throw AppError.unavailable('The original file could not be removed from storage. The document was kept; retry deletion later.');
    }
  }
  await repository.deleteDocument(id, userId);
  if (document.status === 'READY') await repository.decrementDocumentUsage(userId, document.sizeBytes);
};

export const updateDocument = async (userId, id, changes) => {
  const { count } = await repository.updateOwnedDocument(id, userId, changes);
  if (!count) throw AppError.notFound('Document not found');
  return getDocument(userId, id);
};

export const bulkDocuments = async (userId, { ids, action, folder, tag }) => {
  const documents = await repository.findOwnedDocuments(ids, userId);
  if (documents.length !== ids.length) throw AppError.notFound('One or more documents were not found');
  if (action === 'delete') {
    for (const document of documents) await removeDocument(userId, document.id);
    return { affected: documents.length };
  }
  for (const id of ids) {
    const current = await repository.findDocumentById(id, userId);
    const changes = action === 'move' ? { folder: folder || null } : { tags: [...new Set([...(current.tags ?? []), tag])] };
    await repository.updateOwnedDocument(id, userId, changes);
  }
  return { affected: documents.length };
};
