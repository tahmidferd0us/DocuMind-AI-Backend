import crypto from 'node:crypto';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors/AppError.js';
import { logger } from '../../core/utils/logger.js';
import { getTierLimits, PLAN_TIERS } from '../../config/entitlements.js';
import * as repository from './subscriptions.repository.js';
import { findUserById } from '../auth/auth.repository.js';

let stripeClient = null;
const getStripe = () => {
  if (!stripeClient && env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
};

const mapStripeStatus = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'trialing': return 'TRIALING';
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled': return 'CANCELED';
    case 'unpaid': return 'UNPAID';
    default: return 'ACTIVE';
  }
};

export const getSubscriptionStatus = async (userId) => {
  const [subscription, usage, docCount, totalStorageBytes] = await Promise.all([
    repository.findSubscriptionByUserId(userId),
    repository.getMonthlyUsage(userId),
    repository.countUserDocuments(userId),
    repository.sumUserStorageBytes(userId),
  ]);

  const activeTier = subscription?.tier || PLAN_TIERS.FREE;
  const limits = getTierLimits(activeTier);

  return {
    tier: activeTier,
    status: subscription?.status || 'ACTIVE',
    currentPeriodStart: subscription?.currentPeriodStart || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    stripeCustomerId: subscription?.stripeCustomerId || null,
    stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
    usage: {
      periodMonth: usage.periodMonth,
      documentsStored: docCount,
      qaQuestionsAsked: usage.qaQuestionsCount,
      summariesGenerated: usage.summariesCount,
      storageBytesUsed: Number(usage.storageBytesUsed || totalStorageBytes),
    },
    limits: {
      name: limits.name,
      tier: limits.tier,
      maxDocuments: limits.maxDocuments,
      maxUploadSizeBytes: limits.maxUploadSizeBytes,
      maxQuestionsPerMonth: limits.maxQuestionsPerMonth,
      allowedSummaryMethods: limits.allowedSummaryMethods,
      allowedExportFormats: limits.allowedExportFormats,
      hasAdvancedAnalytics: limits.hasAdvancedAnalytics,
      analyticsLevel: limits.analyticsLevel,
      priceMonthly: limits.priceMonthly,
      description: limits.description,
    },
  };
};

export const createCheckoutSession = async (userId, { tier = 'PRO', successUrl, cancelUrl }) => {
  const targetTier = (tier || '').toUpperCase();
  if (![PLAN_TIERS.STARTER, PLAN_TIERS.PRO, PLAN_TIERS.ENTERPRISE].includes(targetTier)) {
    throw AppError.badRequest('Invalid target tier for checkout. Select STARTER, PRO, or ENTERPRISE.');
  }

  const user = await findUserById(userId);
  if (!user) throw AppError.notFound('User not found');

  const tierLimits = getTierLimits(targetTier);
  const existingSub = await repository.findSubscriptionByUserId(userId);
  const stripe = getStripe();

  if (stripe) {
    let customerId = existingSub?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await repository.upsertSubscription(userId, {
        tier: existingSub?.tier || PLAN_TIERS.FREE,
        status: existingSub?.status || 'ACTIVE',
        stripeCustomerId: customerId,
      });
    }

    const priceId = targetTier === 'STARTER'
      ? env.STRIPE_PRICE_ID_STARTER
      : targetTier === 'PRO'
        ? env.STRIPE_PRICE_ID_PRO
        : env.STRIPE_PRICE_ID_ENTERPRISE;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `DocuMind AI ${tierLimits.name} Plan`,
                  description: tierLimits.description,
                },
                unit_amount: tierLimits.priceMonthly * 100,
                recurring: { interval: 'month' },
              },
              quantity: 1,
            },
          ],
      metadata: { userId, tier: targetTier },
      subscription_data: {
        metadata: { userId, tier: targetTier },
      },
      success_url: successUrl || `${env.corsOrigins[0]}/profile/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: cancelUrl || `${env.corsOrigins[0]}/profile/billing?canceled=true`,
    });

    return { sessionId: session.id, url: session.url };
  }

  // Simulated fallback when Stripe secret key is not configured (e.g. testing or local dev)
  const mockSessionId = `cs_test_${crypto.randomUUID()}`;
  const mockUrl = `${successUrl || `${env.corsOrigins[0]}/profile/billing`}?session_id=${mockSessionId}&tier=${targetTier}&mock=true`;
  return { sessionId: mockSessionId, url: mockUrl };
};

export const createCustomerPortalSession = async (userId, returnUrl) => {
  const existingSub = await repository.findSubscriptionByUserId(userId);
  const stripe = getStripe();

  if (stripe && existingSub?.stripeCustomerId) {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: existingSub.stripeCustomerId,
      return_url: returnUrl || `${env.corsOrigins[0]}/profile/billing`,
    });
    return { url: portalSession.url };
  }

  return { url: returnUrl || `${env.corsOrigins[0]}/profile/billing` };
};

export const handleStripeWebhook = async (event) => {
  logger.info('Processing Stripe webhook event', { type: event?.type, id: event?.id });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.userId;
      const tier = session.metadata?.tier || PLAN_TIERS.PRO;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (userId) {
        await repository.upsertSubscription(userId, {
          tier,
          status: 'ACTIVE',
          stripeCustomerId: stripeCustomerId || undefined,
          stripeSubscriptionId: stripeSubscriptionId || undefined,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        });
        logger.info('Subscription activated via checkout session', { userId, tier, stripeCustomerId });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const stripeSubscriptionId = sub.id;
      const status = mapStripeStatus(sub.status);
      const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
      const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : new Date();
      const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
      const tier = sub.metadata?.tier;

      const existing = await repository.findSubscriptionByStripeSubscriptionId(stripeSubscriptionId)
        || (sub.customer ? await repository.findSubscriptionByStripeCustomerId(sub.customer) : null);

      if (existing) {
        await repository.upsertSubscription(existing.userId, {
          ...(tier ? { tier } : {}),
          status,
          cancelAtPeriodEnd,
          currentPeriodStart,
          currentPeriodEnd,
          stripeSubscriptionId,
        });
        logger.info('Subscription updated', { userId: existing.userId, status, tier });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const stripeSubscriptionId = sub.id;

      const existing = await repository.findSubscriptionByStripeSubscriptionId(stripeSubscriptionId)
        || (sub.customer ? await repository.findSubscriptionByStripeCustomerId(sub.customer) : null);

      if (existing) {
        await repository.upsertSubscription(existing.userId, {
          tier: PLAN_TIERS.FREE,
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(),
        });
        logger.info('Subscription canceled and downgraded to FREE', { userId: existing.userId });
      }
      break;
    }

    default:
      logger.info(`Unhandled stripe event type: ${event.type}`);
  }

  return { received: true };
};
