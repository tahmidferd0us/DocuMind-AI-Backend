import { z } from 'zod';

export const documentIdSchema = { params: z.object({ documentId: z.uuid('Invalid document id') }) };

export const askSchema = {
  params: z.object({ documentId: z.uuid('Invalid document id') }),
  body: z.object({
    question: z.string().trim().min(3, 'Ask a question of at least 3 characters').max(1000),
    topK: z.coerce.number().int().min(1).max(10).default(4),
  }),
};
