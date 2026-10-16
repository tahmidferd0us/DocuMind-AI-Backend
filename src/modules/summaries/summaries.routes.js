import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './summaries.controller.js';
import { documentIdSchema, evaluateSummarySchema, generateSummarySchema } from './summaries.validation.js';

export const summaryRoutes = Router();

summaryRoutes.use(requireAuth);

summaryRoutes.get('/:documentId', validate(documentIdSchema), controller.detail);
summaryRoutes.post('/:documentId', validate(generateSummarySchema), controller.generate);
summaryRoutes.post('/:documentId/evaluate', validate(evaluateSummarySchema), controller.evaluate);
