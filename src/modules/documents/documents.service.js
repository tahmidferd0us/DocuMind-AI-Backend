import path from 'node:path';
import { AppError } from '../../core/errors/AppError.js';
import { logger } from '../../core/utils/logger.js';
import { nlpClient } from '../../services/nlpClient.js';
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

  const document = await repository.createDocument({
    userId,
    filename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    status: 'PROCESSING',
    processingStep: 'Queued for processing',
    progress: 0,
    sourceFile: file.buffer,
  });
  return toPublicDocument(document);
};

const MAX_PROCESSING_ATTEMPTS = 3;

export const processDocument = async (documentId) => {
  const claimed = await repository.claimDocument(documentId);
  if (!claimed.count) return false;
  const document = await repository.findDocumentForProcessing(documentId);
  try {
    const parsed = await nlpClient.parseDocument(document.sourceFile, document.filename);
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
      logger.warn('Failed to increment document quota', { userId: document.userId, error: quotaError?.message });
    }
    logger.info('Document processing completed', { documentId });
    return ready;
  } catch (error) {
    const exhausted = document.attemptCount >= MAX_PROCESSING_ATTEMPTS;
    logger.error('Document processing attempt failed', { documentId, attempt: document.attemptCount, message: error?.message });
    await repository.updateDocument(documentId, {
      status: exhausted ? 'FAILED' : 'PROCESSING',
      processingStep: exhausted ? 'Failed' : 'Retry scheduled',
      progress: 0,
      processingStartedAt: null,
      errorMessage: error?.message?.slice(0, 500) ?? 'Processing failed',
    });
    return false;
  }
};

export const retryDocument = async (userId, id) => {
  const document = await repository.findDocumentForRetry(id, userId);
  if (!document) throw AppError.notFound('Document not found');
  if (document.status !== 'FAILED') throw AppError.conflict('Only failed documents can be retried');
  if (!document.sourceFile) throw AppError.badRequest('The original upload is unavailable. Upload this document again to process it.');
  const updated = await repository.updateDocument(id, { status: 'PROCESSING', processingStep: 'Queued for retry', progress: 0, attemptCount: 0, processingStartedAt: null, errorMessage: null });
  return toPublicDocument(updated);
};

export const listDocuments = async (userId, { page, limit, search, status }) => {
  const [items, total] = await repository.listDocuments({
    userId,
    skip: (page - 1) * limit,
    take: limit,
    search,
    status,
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
  const { count } = await repository.deleteDocument(id, userId);
  if (!count) throw AppError.notFound('Document not found');
};
