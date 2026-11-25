import { z } from 'zod';

export const listDocumentsSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().trim().optional(),
    status: z.enum(['READY', 'PROCESSING', 'FAILED']).optional(),
    tag: z.string().trim().min(1).max(40).optional(),
    folder: z.string().trim().min(1).max(80).optional(),
    sort: z.enum(['newest', 'oldest', 'name', 'size']).default('newest'),
  }),
};

export const documentIdSchema = { params: z.object({ id: z.uuid('Invalid document id') }) };
export const updateDocumentSchema = { params: z.object({ id: z.uuid('Invalid document id') }), body: z.object({ displayName: z.string().trim().min(1).max(200).optional(), folder: z.string().trim().max(80).nullable().optional(), tags: z.array(z.string().trim().min(1).max(40)).max(20).optional() }).refine((body) => Object.keys(body).length > 0) };
export const bulkDocumentSchema = { body: z.object({ ids: z.array(z.uuid()).min(1).max(100), action: z.enum(['delete', 'move', 'tag']), folder: z.string().trim().max(80).optional(), tag: z.string().trim().min(1).max(40).optional() }).refine((body) => body.action !== 'move' || body.folder !== undefined).refine((body) => body.action !== 'tag' || body.tag !== undefined) };
