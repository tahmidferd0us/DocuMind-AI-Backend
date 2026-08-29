import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './documents.controller.js';
import { singleDocument } from './documents.upload.js';
import { documentIdSchema, listDocumentsSchema } from './documents.validation.js';

export const documentRoutes = Router();

documentRoutes.use(requireAuth);

documentRoutes.post('/', singleDocument, controller.upload);
documentRoutes.get('/', validate(listDocumentsSchema), controller.list);
documentRoutes.get('/:id', validate(documentIdSchema), controller.detail);
documentRoutes.get('/:id/text', validate(documentIdSchema), controller.text);
documentRoutes.delete('/:id', validate(documentIdSchema), controller.remove);
