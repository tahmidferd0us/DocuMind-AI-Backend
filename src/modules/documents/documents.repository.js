import { prisma } from '../../config/database.js';

const LIST_FIELDS = { id: true, filename: true, displayName: true, folder: true, tags: true, mimeType: true, sizeBytes: true, status: true, errorMessage: true, processingStep: true, progress: true, attemptCount: true, pageCount: true, wordCount: true, charCount: true, createdAt: true };

export const createDocument = (data) => prisma.document.create({ data });

export const updateDocument = (id, data) => prisma.document.update({ where: { id }, data });

export const findDocumentById = (id, userId) => prisma.document.findFirst({ where: { id, userId } });

export const findDocumentSummary = (id, userId) => prisma.document.findFirst({ where: { id, userId }, select: LIST_FIELDS });

export const listDocuments = ({ userId, skip, take, search, status, tag, folder, sort }) => {
  const where = {
    userId,
    ...(status ? { status } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(folder ? { folder: { equals: folder, mode: 'insensitive' } } : {}),
    ...(search ? { OR: [{ filename: { contains: search, mode: 'insensitive' } }, { displayName: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const orderBy = sort === 'name' ? [{ displayName: 'asc' }, { filename: 'asc' }] : sort === 'oldest' ? { createdAt: 'asc' } : sort === 'size' ? { sizeBytes: 'desc' } : { createdAt: 'desc' };
  return prisma.$transaction([
    prisma.document.findMany({ where, select: LIST_FIELDS, orderBy, skip, take }),
    prisma.document.count({ where }),
  ]);
};

export const deleteDocument = (id, userId) => prisma.document.deleteMany({ where: { id, userId } });
export const updateOwnedDocument = (id, userId, data) => prisma.document.updateMany({ where: { id, userId }, data });
export const findOwnedDocument = (id, userId) => prisma.document.findFirst({ where: { id, userId }, select: { id: true, sizeBytes: true, storagePath: true, status: true } });
export const findOwnedDocuments = (ids, userId) => prisma.document.findMany({ where: { id: { in: ids }, userId }, select: { id: true, sizeBytes: true, storagePath: true } });
export const decrementDocumentUsage = async (userId, sizeBytes) => {
  const periodMonth = new Date().toISOString().slice(0, 7);
  await prisma.usageQuota.upsert({
    where: { userId_periodMonth: { userId, periodMonth } },
    create: { userId, periodMonth, documentsCount: 0, storageBytesUsed: 0n },
    update: { documentsCount: { decrement: 1 }, storageBytesUsed: { decrement: BigInt(sizeBytes) } },
  });
  await prisma.usageQuota.updateMany({ where: { userId, periodMonth, documentsCount: { lt: 0 } }, data: { documentsCount: 0 } });
  await prisma.usageQuota.updateMany({ where: { userId, periodMonth, storageBytesUsed: { lt: 0n } }, data: { storageBytesUsed: 0n } });
};

export const findNextQueuedDocument = () => prisma.document.findFirst({ where: { status: 'PROCESSING', processingStartedAt: null, sourceFile: { not: null } }, orderBy: { createdAt: 'asc' } });

export const claimDocument = (id) => prisma.document.updateMany({ where: { id, status: 'PROCESSING', processingStartedAt: null }, data: { processingStartedAt: new Date(), attemptCount: { increment: 1 }, processingStep: 'Extracting text', progress: 10, errorMessage: null } });

export const findDocumentForProcessing = (id) => prisma.document.findUnique({ where: { id } });

export const findDocumentForRetry = (id, userId) => prisma.document.findFirst({ where: { id, userId }, select: { id: true, status: true, sourceFile: true, storagePath: true } });

export const claimStaleDocuments = (staleBefore) => prisma.document.updateMany({ where: { status: 'PROCESSING', processingStartedAt: { lt: staleBefore }, attemptCount: { lt: 3 } }, data: { processingStartedAt: null, processingStep: 'Queued for retry', progress: 0, errorMessage: 'Processing was interrupted and will be retried.' } });

export const failExhaustedStaleDocuments = (staleBefore) => prisma.document.updateMany({ where: { status: 'PROCESSING', processingStartedAt: { lt: staleBefore }, attemptCount: { gte: 3 } }, data: { status: 'FAILED', processingStep: 'Failed', processingStartedAt: null, progress: 0, errorMessage: 'Processing stopped unexpectedly after the maximum retry attempts.' } });
