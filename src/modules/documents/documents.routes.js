import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { requireEntitlement } from '../../core/middleware/entitlementGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './documents.controller.js';
import { singleDocument } from './documents.upload.js';
import { bulkDocumentSchema, documentIdSchema, listDocumentsSchema, updateDocumentSchema } from './documents.validation.js';

export const documentRoutes = Router();

documentRoutes.use(requireAuth);

documentRoutes.post('/', singleDocument, requireEntitlement('upload'), controller.upload);
documentRoutes.get('/', validate(listDocumentsSchema), controller.list);
documentRoutes.patch('/bulk', validate(bulkDocumentSchema), controller.bulk);
documentRoutes.patch('/:id', validate(updateDocumentSchema), controller.update);
documentRoutes.get('/:id', validate(documentIdSchema), controller.detail);
documentRoutes.get('/:id/text', validate(documentIdSchema), controller.text);
documentRoutes.post('/:id/retry', validate(documentIdSchema), controller.retry);
documentRoutes.delete('/:id', validate(documentIdSchema), controller.remove);
