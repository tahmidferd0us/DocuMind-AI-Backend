import { z } from 'zod';

export const documentIdSchema = { params: z.object({ documentId: z.uuid('Invalid document id') }) };
