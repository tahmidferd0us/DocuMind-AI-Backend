import { prisma } from '../../config/database.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendSuccess } from '../../core/http/apiResponse.js';
import { env } from '../../config/env.js';

export const liveness = (_req, res) => sendSuccess(res, { data: { status: 'ok', uptime: Math.round(process.uptime()), environment: env.NODE_ENV } });

export const readiness = asyncHandler(async (_req, res) => {
  let database = 'up';
  try { await prisma.$queryRaw`SELECT 1`; } catch { database = 'down'; }
  sendSuccess(res, { data: { status: database === 'up' ? 'ready' : 'degraded', database }, statusCode: database === 'up' ? 200 : 503 });
});
