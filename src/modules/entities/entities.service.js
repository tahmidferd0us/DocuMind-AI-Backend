import { AppError } from '../../core/errors/AppError.js';
import { nlpClient } from '../../services/nlpClient.js';
import { getDocumentText } from '../documents/documents.service.js';
import * as repository from './entities.repository.js';
import { toPublicEntitySet } from './entities.mapper.js';

export const findEntitySetForDocument = async (documentId) => {
  const entitySet = await repository.findEntitySetByDocument(documentId);
  return entitySet ? toPublicEntitySet(entitySet) : null;
};

export const getEntities = async (userId, documentId) => {
  await getDocumentText(userId, documentId);
  const entitySet = await findEntitySetForDocument(documentId);
  if (!entitySet) throw AppError.notFound('No entities have been extracted for this document yet');
  return entitySet;
};

export const extractEntities = async (userId, documentId) => {
  const document = await getDocumentText(userId, documentId);
  const result = await nlpClient.extractEntities(document.extractedText);

  const entitySet = await repository.upsertEntitySet(documentId, {
    entities: result.entities ?? {},
    keywords: result.keywords ?? [],
    totalFound: result.entities?.total_entities_found ?? 0,
  });

  return toPublicEntitySet(entitySet);
};
