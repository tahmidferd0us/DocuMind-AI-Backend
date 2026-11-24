import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { AppError } from '../../core/errors/AppError.js';
import * as repository from './auth.repository.js';
import { toPublicUser } from './auth.mapper.js';
import { generateRefreshToken, hashAuthToken, hashRefreshToken, refreshTokenExpiry, signAccessToken } from './auth.tokens.js';
import { sendAuthEmail } from '../../services/authEmail.js';

const SALT_ROUNDS = 12;

const issueSession = async (user, context, familyId = crypto.randomUUID()) => {
  const refreshToken = generateRefreshToken();
  await repository.createSession({
    userId: user.id,
    familyId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    userAgent: context?.userAgent ?? null,
    ipAddress: context?.ipAddress ?? null,
    expiresAt: refreshTokenExpiry(),
  });
  return { user: toPublicUser(user), accessToken: signAccessToken(user), refreshToken };
};

export const register = async ({ fullName, email, password }, context) => {
  if (await repository.findUserByEmail(email)) throw AppError.conflict('An account with this email already exists');
  const user = await repository.createUser({ fullName: fullName ?? null, email, passwordHash: await bcrypt.hash(password, SALT_ROUNDS) });
  await sendVerification(user);
  return issueSession(user, context);
};

const createAuthToken = async (user, type, expiresInMs) => {
  const token = crypto.randomBytes(32).toString('hex');
  await repository.createAuthToken({ userId: user.id, tokenHash: hashAuthToken(token), type, expiresAt: new Date(Date.now() + expiresInMs) });
  return token;
};

const sendVerification = async (user) => {
  const token = await createAuthToken(user, 'EMAIL_VERIFICATION', 24 * 60 * 60 * 1000);
  await sendAuthEmail({ to: user.email, subject: 'Verify your DocuMind AI email', action: 'verify-email', token });
};

export const login = async ({ email, password }, context) => {
  const user = await repository.findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw AppError.unauthorized('Email or password is incorrect');
  if (!user.isActive) throw AppError.forbidden('This account has been deactivated');
  if (!user.emailVerifiedAt) throw AppError.forbidden('Verify your email address before logging in');
  await repository.updateUser(user.id, { lastLoginAt: new Date() });
  return issueSession(user, context);
};

export const refresh = async (refreshToken, context) => {
  if (!refreshToken) throw AppError.unauthorized('Refresh token is missing');
  const session = await repository.findActiveSessionByHash(hashRefreshToken(refreshToken));
  if (!session) {
    const usedSession = await repository.findSessionByHash(hashRefreshToken(refreshToken));
    if (usedSession?.revokedAt) await repository.revokeSessionFamily(usedSession.familyId);
    throw AppError.unauthorized('Refresh token is invalid or expired');
  }
  if (!session.user.isActive) throw AppError.forbidden('This account has been deactivated');
  const rotated = await repository.rotateSession(session.id);
  if (!rotated.count) {
    await repository.revokeSessionFamily(session.familyId);
    throw AppError.unauthorized('Refresh token is invalid or expired');
  }
  return issueSession(session.user, context, session.familyId);
};

export const requestPasswordReset = async ({ email }) => {
  const user = await repository.findUserByEmail(email);
  if (user) {
    const token = await createAuthToken(user, 'PASSWORD_RESET', 60 * 60 * 1000);
    await sendAuthEmail({ to: user.email, subject: 'Reset your DocuMind AI password', action: 'reset-password', token });
  }
};

export const verifyEmail = async ({ token }) => {
  const record = await repository.findAuthToken(hashAuthToken(token), 'EMAIL_VERIFICATION');
  if (!record) throw AppError.badRequest('Verification link is invalid or expired');
  const consumed = await repository.consumeAuthToken(record.id);
  if (!consumed.count) throw AppError.badRequest('Verification link is invalid or expired');
  await repository.updateEmailVerified(record.userId);
};

export const resetPassword = async ({ token, password }) => {
  const record = await repository.findAuthToken(hashAuthToken(token), 'PASSWORD_RESET');
  if (!record) throw AppError.badRequest('Password reset link is invalid or expired');
  const consumed = await repository.consumeAuthToken(record.id);
  if (!consumed.count) throw AppError.badRequest('Password reset link is invalid or expired');
  await repository.updatePasswordAndRevokeSessions(record.userId, await bcrypt.hash(password, SALT_ROUNDS));
};

export const logout = async (refreshToken) => {
  if (refreshToken) await repository.revokeSessionByHash(hashRefreshToken(refreshToken));
};

export const getProfile = async (userId) => {
  const user = await repository.findUserById(userId);
  if (!user) throw AppError.notFound('User not found');
  return toPublicUser(user);
};

export const updateProfile = async (userId, { fullName }) => {
  const user = await repository.findUserById(userId);
  if (!user) throw AppError.notFound('User not found');
  const updated = await repository.updateUser(userId, {
    fullName: fullName !== undefined ? fullName.trim() || null : user.fullName,
  });
  return toPublicUser(updated);
};


export const revokeUserSessions = async (userId) => {
  await repository.revokeAllUserSessions(userId);
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await repository.findUserById(userId);
  if (!user) throw AppError.notFound('User not found');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw AppError.unauthorized('Current password is incorrect');
  await repository.updateUser(userId, { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS) });
  await repository.revokeAllUserSessions(userId);
};

export const resendVerification = async ({ email }) => {
  const user = await repository.findUserByEmail(email);
  if (user && !user.emailVerifiedAt) await sendVerification(user);
};
