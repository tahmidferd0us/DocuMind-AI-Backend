import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const DURATION_UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export const durationToMs = (value) => {
  const match = /^(\d+)([smhd])$/.exec(String(value).trim());
  if (!match) throw new Error(`Unsupported duration format: ${value}`);
  return Number(match[1]) * DURATION_UNITS[match[2]];
};

export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

export const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

export const hashRefreshToken = (token) => crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');

export const refreshTokenExpiry = () => new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));
