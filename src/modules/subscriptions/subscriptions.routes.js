import { Router } from 'express';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './subscriptions.controller.js';
import { checkoutSchema, portalSchema } from './subscriptions.validation.js';

export const subscriptionRoutes = Router();

// Public webhook route (Stripe calls this directly)
subscriptionRoutes.post('/webhook', controller.webhook);

// Protected routes
subscriptionRoutes.get('/me', requireAuth, controller.me);
subscriptionRoutes.post('/checkout', requireAuth, validate(checkoutSchema), controller.checkout);
subscriptionRoutes.post('/portal', requireAuth, validate(portalSchema), controller.portal);
