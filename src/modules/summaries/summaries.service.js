import { AppError } from '../../core/errors/AppError.js';
import { nlpClient } from '../../services/nlpClient.js';
import { getDocumentText } from '../documents/documents.service.js';
import * as repository from './summaries.repository.js';
import { toPublicSummary } from './summaries.mapper.js';

export const findSummaryForDocument = async (documentId) => {
  const summary = await repository.findSummaryByDocument(documentId);
  return summary ? toPublicSummary(summary) : null;
};

export const getSummary = async (userId, documentId) => {
  await getDocumentText(userId, documentId);
  const summary = await repository.findSummaryByDocument(documentId);
  if (!summary) throw AppError.notFound('No summary has been generated for this document yet');
  return toPublicSummary(summary);
};

export const generateSummary = async (userId, documentId, options) => {
  const document = await getDocumentText(userId, documentId);

  const result = await nlpClient.summarize(document.extractedText, {
    extractiveSentences: options.sentences,
    extractiveMethod: options.method,
    abstractiveFormat: options.format,
    abstractiveLength: options.length,
  });

  const extractive = result.extractive?.summary?.trim();
  if (!extractive) throw AppError.internal('The NLP service returned an empty extractive summary');

  const summary = await repository.upsertSummary(documentId, {
    extractive,
    sentences: result.extractive?.sentences ?? [],
    abstractive: result.abstractive?.summary ?? '',
    method: result.extractive?.method ?? options.method,
    sentenceCount: result.extractive?.sentence_count ?? options.sentences,
    format: result.abstractive?.format_type ?? options.format,
    model: result.abstractive?.model_used ?? 'unknown',
  });

  return toPublicSummary(summary);
};
