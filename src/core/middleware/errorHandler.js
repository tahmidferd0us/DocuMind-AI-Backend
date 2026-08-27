import { AppError } from '../errors/AppError.js';
import { sendError } from '../http/apiResponse.js';
import { logger } from '../utils/logger.js';
import { env } from '../../config/env.js';

const PRISMA_MESSAGES = { P2002: 'A record with these details already exists', P2025: 'Record not found' };
const PRISMA_STATUS = { P2002: 409, P2025: 404 };

const normalise = (error) => {
  if (error instanceof AppError) return error;
  if (error?.code && PRISMA_MESSAGES[error.code]) return new AppError(PRISMA_MESSAGES[error.code], PRISMA_STATUS[error.code], error.code);
  if (error?.type === 'entity.parse.failed') return AppError.badRequest('Request body is not valid JSON');
  if (error?.type === 'entity.too.large') return AppError.badRequest('Request body is too large');
  return AppError.internal(env.isProduction ? 'Something went wrong' : error?.message);
};

export const errorHandler = (error, req, res, _next) => {
  const normalised = normalise(error);
  if (normalised.statusCode >= 500) logger.error(`${req.method} ${req.originalUrl}`, { message: error?.message, stack: error?.stack });
  sendError(res, { statusCode: normalised.statusCode, code: normalised.code, message: normalised.message, details: normalised.details });
};
