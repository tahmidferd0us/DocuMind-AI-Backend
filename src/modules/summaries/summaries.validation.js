import { z } from 'zod';

export const documentIdSchema = { params: z.object({ documentId: z.uuid('Invalid document id') }) };

export const generateSummarySchema = {
  params: z.object({ documentId: z.uuid('Invalid document id') }),
  body: z.object({
    sentences: z.coerce.number().int().min(1).max(20).default(5),
    method: z.enum(['lexrank', 'lsa', 'luhn']).default('lexrank'),
    format: z.enum(['paragraph', 'bullets']).default('paragraph'),
    length: z.enum(['short', 'standard', 'detailed']).default('standard'),
  }),
};
