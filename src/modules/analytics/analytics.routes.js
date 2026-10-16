import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './analytics.controller.js';
import { documentIdSchema } from './analytics.validation.js';

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth);

analyticsRoutes.get('/:documentId', validate(documentIdSchema), controller.detail);
