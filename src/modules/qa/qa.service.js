import { AppError } from '../../core/errors/AppError.js';
import { logger } from '../../core/utils/logger.js';
import { nlpClient } from '../../services/nlpClient.js';
import { getDocumentText } from '../documents/documents.service.js';
import * as repository from './qa.repository.js';
import { toPublicMessage } from './qa.mapper.js';

const HISTORY_TURNS = 6;

const isMissingIndex = (error) => /not found in vector store/i.test(error?.message ?? '');

const pagesFor = (document) => {
  const stored = Array.isArray(document.pages) ? document.pages : [];
  if (stored.length) return stored;
  return [{ page_number: 1, cleaned_text: document.extractedText }];
};

const indexDocument = async (document) => {
  logger.info('Indexing document for retrieval', { documentId: document.id });
  return nlpClient.indexTextForRag(document.id, pagesFor(document));
};

export const getHistory = async (userId, documentId) => {
  await getDocumentText(userId, documentId);
  const messages = await repository.listMessages(documentId);
  return messages.map(toPublicMessage);
};

export const clearHistory = async (userId, documentId) => {
  await getDocumentText(userId, documentId);
  await repository.clearMessages(documentId);
};

export const ask = async (userId, documentId, { question, topK }) => {
  const document = await getDocumentText(userId, documentId);

  const previous = await repository.listMessages(documentId);
  const chatHistory = previous.slice(-HISTORY_TURNS).map((message) => ({ question: message.question, answer: message.answer }));

  let result;
  try {
    result = await nlpClient.queryRag(documentId, question, topK, chatHistory);
  } catch (error) {
    if (!isMissingIndex(error)) throw error;
    await indexDocument(document);
    result = await nlpClient.queryRag(documentId, question, topK, chatHistory);
  }

  const answer = result.answer?.trim();
  if (!answer) throw AppError.internal('The NLP service returned an empty answer');

  const message = await repository.createMessage({
    documentId,
    question,
    answer,
    sources: result.sources ?? [],
    model: result.model_used ?? 'unknown',
  });

  return toPublicMessage(message);
};
