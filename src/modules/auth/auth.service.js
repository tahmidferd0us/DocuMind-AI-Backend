import bcrypt from 'bcryptjs';
import { AppError } from '../../core/errors/AppError.js';
import * as repository from './auth.repository.js';
import { toPublicUser } from './auth.mapper.js';
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiry, signAccessToken } from './auth.tokens.js';

const SALT_ROUNDS = 12;

const issueSession = async (user, context) => {
  const refreshToken = generateRefreshToken();
  await repository.createSession({
    userId: user.id,
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
  return issueSession(user, context);
};

export const login = async ({ email, password }, context) => {
  const user = await repository.findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw AppError.unauthorized('Email or password is incorrect');
  if (!user.isActive) throw AppError.forbidden('This account has been deactivated');
  await repository.updateUser(user.id, { lastLoginAt: new Date() });
  return issueSession(user, context);
};

export const refresh = async (refreshToken, context) => {
  if (!refreshToken) throw AppError.unauthorized('Refresh token is missing');
  const session = await repository.findActiveSessionByHash(hashRefreshToken(refreshToken));
  if (!session) throw AppError.unauthorized('Refresh token is invalid or expired');
  if (!session.user.isActive) throw AppError.forbidden('This account has been deactivated');
  await repository.revokeSession(session.id);
  return issueSession(session.user, context);
};

export const logout = async (refreshToken) => {
  if (refreshToken) await repository.revokeSessionByHash(hashRefreshToken(refreshToken));
};

export const getProfile = async (userId) => {
  const user = await repository.findUserById(userId);
  if (!user) throw AppError.notFound('User not found');
  return toPublicUser(user);
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await repository.findUserById(userId);
  if (!user) throw AppError.notFound('User not found');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw AppError.unauthorized('Current password is incorrect');
  await repository.updateUser(userId, { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS) });
  await repository.revokeAllUserSessions(userId);
};
