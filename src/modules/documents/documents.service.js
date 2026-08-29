import path from 'node:path';
import { AppError } from '../../core/errors/AppError.js';
import { logger } from '../../core/utils/logger.js';
import { nlpClient } from '../../services/nlpClient.js';
import * as repository from './documents.repository.js';
import { toPublicDocument } from './documents.mapper.js';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

export const assertSupportedFile = (file) => {
  if (!file) throw AppError.badRequest('No file was uploaded');
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
  });

  try {
    const parsed = await nlpClient.parseDocument(file.buffer, file.originalname);
    const text = parsed.cleaned_text ?? parsed.raw_text ?? '';
    if (!text.trim()) throw AppError.badRequest('No readable text could be extracted from this document');

    const updated = await repository.updateDocument(document.id, {
      status: 'READY',
      extractedText: text,
      pageCount: parsed.page_count ?? null,
      wordCount: parsed.total_words ?? text.trim().split(/\s+/).length,
      charCount: parsed.total_characters ?? text.length,
      pages: (parsed.pages ?? []).map((page) => ({ page_number: page.page_number, cleaned_text: page.cleaned_text })),
      errorMessage: null,
    });
    return toPublicDocument(updated);
  } catch (error) {
    logger.error('Document ingestion failed', { documentId: document.id, message: error?.message });
    const failed = await repository.updateDocument(document.id, { status: 'FAILED', errorMessage: error?.message?.slice(0, 500) ?? 'Ingestion failed' });
    if (error instanceof AppError) throw error;
    throw AppError.internal('Could not process this document', { documentId: failed.id });
  }
};

export const listDocuments = async (userId, { page, limit }) => {
  const [items, total] = await repository.listDocuments({ userId, skip: (page - 1) * limit, take: limit });
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
