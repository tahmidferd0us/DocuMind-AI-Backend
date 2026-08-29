import { prisma } from '../../config/database.js';

export const findEntitySetByDocument = (documentId) => prisma.entitySet.findUnique({ where: { documentId } });

export const upsertEntitySet = (documentId, data) =>
  prisma.entitySet.upsert({ where: { documentId }, create: { documentId, ...data }, update: data });
