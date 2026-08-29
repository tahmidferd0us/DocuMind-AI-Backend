import { prisma } from '../../config/database.js';

export const findSummaryByDocument = (documentId) => prisma.summary.findUnique({ where: { documentId } });

export const upsertSummary = (documentId, data) =>
  prisma.summary.upsert({ where: { documentId }, create: { documentId, ...data }, update: data });
