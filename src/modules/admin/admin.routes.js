import { Router } from 'express';
import { requireAuth, requireRole } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './admin.controller.js';
import {
  adminDocumentIdSchema,
  listAdminDocumentsSchema,
  listUsersSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from './admin.validation.js';

export const adminRoutes = Router();

// Protect all admin endpoints: user must be authenticated AND have ADMIN role
adminRoutes.use(requireAuth, requireRole('ADMIN'));

// Platform Analytics & System Health
adminRoutes.get('/analytics', controller.getAnalytics);

// Platform User Management
adminRoutes.get('/users', validate(listUsersSchema), controller.listUsers);
adminRoutes.patch('/users/:id/status', validate(updateUserStatusSchema), controller.updateUserStatus);
adminRoutes.patch('/users/:id/role', validate(updateUserRoleSchema), controller.updateUserRole);

// Platform Documents Management
adminRoutes.get('/documents', validate(listAdminDocumentsSchema), controller.listDocuments);
adminRoutes.delete('/documents/:id', validate(adminDocumentIdSchema), controller.deleteDocument);
