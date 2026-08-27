import { env } from '../../config/env.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './auth.service.js';
import { durationToMs } from './auth.tokens.js';

const REFRESH_COOKIE = 'documind_refresh_token';

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  domain: env.isProduction ? undefined : env.COOKIE_DOMAIN,
  path: '/api/v1/auth',
  maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
});

const requestContext = (req) => ({ userAgent: req.headers['user-agent'] ?? null, ipAddress: req.ip ?? null });

const setRefreshCookie = (res, refreshToken) => res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());

export const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await service.register(req.body, requestContext(req));
  setRefreshCookie(res, refreshToken);
  sendCreated(res, { data: { user, accessToken }, message: 'Account created successfully' });
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await service.login(req.body, requestContext(req));
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { data: { user, accessToken }, message: 'Logged in successfully' });
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await service.refresh(req.cookies?.[REFRESH_COOKIE], requestContext(req));
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { data: { user, accessToken }, message: 'Session refreshed' });
});

export const logout = asyncHandler(async (req, res) => {
  await service.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => sendSuccess(res, { data: await service.getProfile(req.user.id) }));

export const changePassword = asyncHandler(async (req, res) => {
  await service.changePassword(req.user.id, req.body);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  sendSuccess(res, { message: 'Password changed successfully, please log in again' });
});
