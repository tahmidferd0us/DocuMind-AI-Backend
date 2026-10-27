import { z } from 'zod';

export const checkoutSchema = {
  body: z.object({
    tier: z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  }),
};

export const portalSchema = {
  body: z.object({
    returnUrl: z.string().url().optional(),
  }),
};
