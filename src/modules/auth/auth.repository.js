import { prisma } from '../../config/database.js';

export const findUserByEmail = (email) => prisma.user.findUnique({ where: { email } });

export const findUserById = (id) => prisma.user.findUnique({ where: { id } });

export const createUser = (data) => prisma.user.create({ data });

export const updateUser = (id, data) => prisma.user.update({ where: { id }, data });

export const createSession = (data) => prisma.session.create({ data });

export const findActiveSessionByHash = (refreshTokenHash) =>
  prisma.session.findFirst({ where: { refreshTokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });

export const findSessionByHash = (refreshTokenHash) =>
  prisma.session.findUnique({ where: { refreshTokenHash }, select: { id: true, familyId: true, userId: true, revokedAt: true, expiresAt: true } });

export const revokeSession = (id) => prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
export const rotateSession = (id) => prisma.session.updateMany({ where: { id, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });

export const revokeSessionByHash = (refreshTokenHash) =>
  prisma.session.updateMany({ where: { refreshTokenHash, revokedAt: null }, data: { revokedAt: new Date() } });

export const revokeAllUserSessions = (userId) =>
  prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

export const revokeSessionFamily = (familyId) => prisma.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });

export const deleteExpiredSessions = () => prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
export const deleteExpiredAuthTokens = () => prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

export const createAuthToken = (data) => prisma.authToken.create({ data });
export const findAuthToken = (tokenHash, type) => prisma.authToken.findFirst({ where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
export const consumeAuthToken = (id) => prisma.authToken.updateMany({ where: { id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
export const updateEmailVerified = (userId) => prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
export const updatePasswordAndRevokeSessions = async (userId, passwordHash) => prisma.$transaction([
  prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
  prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
]);
