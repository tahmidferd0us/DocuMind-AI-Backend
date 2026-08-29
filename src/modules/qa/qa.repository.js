import { prisma } from '../../config/database.js';

export const listMessages = (documentId) => prisma.qaMessage.findMany({ where: { documentId }, orderBy: { createdAt: 'asc' } });

export const createMessage = (data) => prisma.qaMessage.create({ data });

export const clearMessages = (documentId) => prisma.qaMessage.deleteMany({ where: { documentId } });
