import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendSuccess } from '../../core/http/apiResponse.js';
import { AppError } from '../../core/errors/AppError.js';
import * as service from './subscriptions.service.js';

export const me = asyncHandler(async (req, res) => {
  const status = await service.getSubscriptionStatus(req.user.id);
  sendSuccess(res, { data: status, message: 'Subscription details retrieved' });
});

export const checkout = asyncHandler(async (req, res) => {
  const { tier, successUrl, cancelUrl } = req.body;
  const session = await service.createCheckoutSession(req.user.id, { tier, successUrl, cancelUrl });
  sendSuccess(res, { data: session, message: 'Checkout session created' });
});

export const portal = asyncHandler(async (req, res) => {
  const { returnUrl } = req.body;
  const session = await service.createCustomerPortalSession(req.user.id, returnUrl);
  sendSuccess(res, { data: session, message: 'Customer portal session created' });
});

export const webhook = asyncHandler(async (req, res) => {
  let event = req.body;

  const sig = req.headers['stripe-signature'];
  if (env.STRIPE_WEBHOOK_SECRET && sig && env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      const rawBody = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      throw AppError.badRequest(`Webhook signature verification failed: ${err.message}`);
    }
  }

  const result = await service.handleStripeWebhook(event);
  sendSuccess(res, { data: result, message: 'Webhook processed' });
});
