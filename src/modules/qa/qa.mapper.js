export const toPublicMessage = (message) => ({
  id: message.id,
  documentId: message.documentId,
  question: message.question,
  answer: message.answer,
  sources: message.sources ?? [],
  model: message.model,
  createdAt: message.createdAt,
});
