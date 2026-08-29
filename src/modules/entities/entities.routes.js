import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './entities.controller.js';
import { documentIdSchema } from './entities.validation.js';

export const entityRoutes = Router();

entityRoutes.use(requireAuth);

entityRoutes.get('/:documentId', validate(documentIdSchema), controller.detail);
entityRoutes.post('/:documentId', validate(documentIdSchema), controller.extract);
