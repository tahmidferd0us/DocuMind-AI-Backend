import { AppError } from '../errors/AppError.js';

export const notFound = (req, _res, next) => next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
