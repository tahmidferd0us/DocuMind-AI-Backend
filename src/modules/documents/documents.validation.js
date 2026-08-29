import { z } from 'zod';

export const listDocumentsSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
};

export const documentIdSchema = { params: z.object({ id: z.uuid('Invalid document id') }) };
