import { z } from 'zod';

export const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    status: z.enum(['all', 'active', 'inactive']).optional(),
  }),
};

export const userIdParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const updateUserStatusSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
};

export const updateUserRoleSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    role: z.enum(['USER', 'ADMIN']),
  }),
};

export const listAdminDocumentsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    status: z.enum(['PROCESSING', 'READY', 'FAILED']).optional(),
  }),
};

export const adminDocumentIdSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};
