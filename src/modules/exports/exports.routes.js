import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './exports.controller.js';
import { exportSchema } from './exports.validation.js';
import { documentIdSchema } from '../entities/entities.validation.js';

export const exportRoutes = Router();

exportRoutes.use(requireAuth);

exportRoutes.get('/:documentId', validate(documentIdSchema), controller.contents);
exportRoutes.get('/:documentId/:format', validate(exportSchema), controller.download);
