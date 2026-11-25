import { prisma } from '../../config/database.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendSuccess } from '../../core/http/apiResponse.js';
import { env } from '../../config/env.js';
import { nlpClient } from '../../services/nlpClient.js';

export const liveness = (_req, res) => sendSuccess(res, { data: { status: 'ok', uptime: Math.round(process.uptime()), environment: env.NODE_ENV } });

export const readiness = asyncHandler(async (_req, res) => {
  let database = 'up';
  let nlp = 'up';
  try { await prisma.$queryRaw`SELECT 1`; } catch { database = 'down'; }
  try { await nlpClient.health(); } catch { nlp = 'down'; }
  const ready = database === 'up' && nlp === 'up';
  sendSuccess(res, { data: { status: ready ? 'ready' : 'degraded', database, nlp, storage: env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'database-fallback' }, statusCode: ready ? 200 : 503 });
});
