import { prisma } from '../../config/database.js';

const LIST_FIELDS = { id: true, filename: true, mimeType: true, sizeBytes: true, status: true, errorMessage: true, processingStep: true, progress: true, attemptCount: true, pageCount: true, wordCount: true, charCount: true, createdAt: true };

export const createDocument = (data) => prisma.document.create({ data });

export const updateDocument = (id, data) => prisma.document.update({ where: { id }, data });

export const findDocumentById = (id, userId) => prisma.document.findFirst({ where: { id, userId } });

export const findDocumentSummary = (id, userId) => prisma.document.findFirst({ where: { id, userId }, select: LIST_FIELDS });

export const listDocuments = ({ userId, skip, take, search, status }) => {
  const where = {
    userId,
    ...(status ? { status } : {}),
    ...(search ? { filename: { contains: search, mode: 'insensitive' } } : {}),
  };
  return prisma.$transaction([
    prisma.document.findMany({ where, select: LIST_FIELDS, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.document.count({ where }),
  ]);
};

export const deleteDocument = (id, userId) => prisma.document.deleteMany({ where: { id, userId } });

export const findNextQueuedDocument = () => prisma.document.findFirst({ where: { status: 'PROCESSING', processingStartedAt: null, sourceFile: { not: null } }, orderBy: { createdAt: 'asc' } });

export const claimDocument = (id) => prisma.document.updateMany({ where: { id, status: 'PROCESSING', processingStartedAt: null }, data: { processingStartedAt: new Date(), attemptCount: { increment: 1 }, processingStep: 'Extracting text', progress: 10, errorMessage: null } });

export const findDocumentForProcessing = (id) => prisma.document.findUnique({ where: { id } });

export const findDocumentForRetry = (id, userId) => prisma.document.findFirst({ where: { id, userId }, select: { id: true, status: true, sourceFile: true } });

export const claimStaleDocuments = (staleBefore) => prisma.document.updateMany({ where: { status: 'PROCESSING', processingStartedAt: { lt: staleBefore }, attemptCount: { lt: 3 } }, data: { processingStartedAt: null, processingStep: 'Queued for retry', progress: 0, errorMessage: 'Processing was interrupted and will be retried.' } });

export const failExhaustedStaleDocuments = (staleBefore) => prisma.document.updateMany({ where: { status: 'PROCESSING', processingStartedAt: { lt: staleBefore }, attemptCount: { gte: 3 } }, data: { status: 'FAILED', processingStep: 'Failed', processingStartedAt: null, progress: 0, errorMessage: 'Processing stopped unexpectedly after the maximum retry attempts.' } });
