export const toPublicSummary = (summary) => ({
  documentId: summary.documentId,
  extractive: summary.extractive,
  abstractive: summary.abstractive,
  method: summary.method,
  sentenceCount: summary.sentenceCount,
  format: summary.format,
  model: summary.model,
  abstractiveFailed: summary.model === 'error',
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt,
});
