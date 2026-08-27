import { prisma } from '../../config/database.js';

export const findUserByEmail = (email) => prisma.user.findUnique({ where: { email } });

export const findUserById = (id) => prisma.user.findUnique({ where: { id } });

export const createUser = (data) => prisma.user.create({ data });

export const updateUser = (id, data) => prisma.user.update({ where: { id }, data });

export const createSession = (data) => prisma.session.create({ data });

export const findActiveSessionByHash = (refreshTokenHash) =>
  prisma.session.findFirst({ where: { refreshTokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });

export const revokeSession = (id) => prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });

export const revokeSessionByHash = (refreshTokenHash) =>
  prisma.session.updateMany({ where: { refreshTokenHash, revokedAt: null }, data: { revokedAt: new Date() } });

export const revokeAllUserSessions = (userId) =>
  prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

export const deleteExpiredSessions = () => prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
