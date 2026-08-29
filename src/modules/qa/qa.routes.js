import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './qa.controller.js';
import { askSchema, documentIdSchema } from './qa.validation.js';

export const qaRoutes = Router();

qaRoutes.use(requireAuth);

qaRoutes.get('/:documentId', validate(documentIdSchema), controller.history);
qaRoutes.post('/:documentId', validate(askSchema), controller.ask);
qaRoutes.delete('/:documentId', validate(documentIdSchema), controller.clear);
