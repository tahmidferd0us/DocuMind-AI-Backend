export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details = null) { return new AppError(message, 400, 'BAD_REQUEST', details); }
  static unauthorized(message = 'Unauthorized', details = null) { return new AppError(message, 401, 'UNAUTHORIZED', details); }
  static forbidden(message = 'Forbidden', details = null) { return new AppError(message, 403, 'FORBIDDEN', details); }
  static notFound(message = 'Resource not found', details = null) { return new AppError(message, 404, 'NOT_FOUND', details); }
  static conflict(message = 'Resource already exists', details = null) { return new AppError(message, 409, 'CONFLICT', details); }
  static validation(message = 'Validation failed', details = null) { return new AppError(message, 422, 'VALIDATION_ERROR', details); }
  static tooManyRequests(message = 'Too many requests', details = null) { return new AppError(message, 429, 'TOO_MANY_REQUESTS', details); }
  static internal(message = 'Something went wrong', details = null) { return new AppError(message, 500, 'INTERNAL_ERROR', details); }
}
