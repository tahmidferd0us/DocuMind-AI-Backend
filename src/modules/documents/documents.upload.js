import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors/AppError.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 } });

export const singleDocument = (req, res, next) =>
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(AppError.badRequest(`File is larger than the ${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit`));
    if (error.code === 'LIMIT_UNEXPECTED_FILE') return next(AppError.badRequest('Upload the file under the field name "file"'));
    return next(AppError.badRequest(error.message));
  });
