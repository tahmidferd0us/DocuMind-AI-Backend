import rateLimit from 'express-rate-limit';
import { sendError } from '../http/apiResponse.js';

const handler = (_req, res) => sendError(res, { statusCode: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' });

export const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, handler });

export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, skipSuccessfulRequests: true, handler });
