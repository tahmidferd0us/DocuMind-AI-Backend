import { nlpClient } from '../../services/nlpClient.js';
import { getDocumentText } from '../documents/documents.service.js';

export const getDocumentAnalytics = async (userId, documentId) => {
  const document = await getDocumentText(userId, documentId);
  return nlpClient.computeAnalytics(document.extractedText || '', document.filename);
};
