import { AppError } from '../errors/AppError.js';
import { verifyAccessToken } from '../../modules/auth/auth.tokens.js';

const extractBearer = (req) => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

export const requireAuth = (req, _res, next) => {
  const token = extractBearer(req);
  if (!token) return next(AppError.unauthorized('Authentication token is missing'));
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Authentication token is invalid or expired'));
  }
};

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(AppError.forbidden('You do not have permission to perform this action'));
