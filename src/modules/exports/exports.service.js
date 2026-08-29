import { nlpClient } from '../../services/nlpClient.js';
import { getDocumentText } from '../documents/documents.service.js';
import { findSummaryForDocument } from '../summaries/summaries.service.js';
import { findEntitySetForDocument } from '../entities/entities.service.js';
import { getHistory } from '../qa/qa.service.js';

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const buildReport = async (userId, documentId, format) => {
  const document = await getDocumentText(userId, documentId);
  const [summary, entitySet, messages] = await Promise.all([
    findSummaryForDocument(documentId),
    findEntitySetForDocument(documentId),
    getHistory(userId, documentId),
  ]);

  const payload = {
    document_info: {
      filename: document.filename,
      page_count: document.pageCount,
      total_words: document.wordCount,
      total_characters: document.charCount,
    },
    extractive_summary: summary ? { summary: summary.extractive, sentences: summary.sentences, method: summary.method } : null,
    abstractive_summary: summary ? { summary: summary.abstractive, format_type: summary.format, model_used: summary.model } : null,
    entities_data: entitySet?.entities ?? null,
    keywords_data: entitySet?.keywords ?? null,
    analytics_data: {
      word_count: document.wordCount ?? 0,
      reading_time_min: document.wordCount ? Math.max(1, Math.round(document.wordCount / 200)) : 0,
      speaking_time_min: document.wordCount ? Math.max(1, Math.round(document.wordCount / 130)) : 0,
    },
    qa_history: messages.map((message) => ({ question: message.question, answer: message.answer })),
  };

  const buffer = await nlpClient.exportReport(format, payload);
  const base = document.filename.replace(/\.[^.]+$/, '');

  return { buffer, mimeType: MIME[format], filename: `DocuMind_${base}.${format}` };
};

export const getReportContents = async (userId, documentId) => {
  await getDocumentText(userId, documentId);
  const [summary, entitySet, messages] = await Promise.all([
    findSummaryForDocument(documentId),
    findEntitySetForDocument(documentId),
    getHistory(userId, documentId),
  ]);

  return {
    hasSummary: Boolean(summary),
    hasEntities: Boolean(entitySet),
    questionCount: messages.length,
    keywordCount: entitySet?.keywords?.length ?? 0,
    entityCount: entitySet?.totalFound ?? 0,
  };
};
