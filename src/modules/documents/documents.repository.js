import { prisma } from '../../config/database.js';

const LIST_FIELDS = { id: true, filename: true, mimeType: true, sizeBytes: true, status: true, errorMessage: true, pageCount: true, wordCount: true, charCount: true, createdAt: true };

export const createDocument = (data) => prisma.document.create({ data });

export const updateDocument = (id, data) => prisma.document.update({ where: { id }, data });

export const findDocumentById = (id, userId) => prisma.document.findFirst({ where: { id, userId } });

export const findDocumentSummary = (id, userId) => prisma.document.findFirst({ where: { id, userId }, select: LIST_FIELDS });

export const listDocuments = ({ userId, skip, take }) =>
  prisma.$transaction([
    prisma.document.findMany({ where: { userId }, select: LIST_FIELDS, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.document.count({ where: { userId } }),
  ]);

export const deleteDocument = (id, userId) => prisma.document.deleteMany({ where: { id, userId } });
