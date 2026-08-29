import { z } from 'zod';

export const exportSchema = {
  params: z.object({ documentId: z.uuid('Invalid document id'), format: z.enum(['pdf', 'docx']) }),
};
