import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/database.js';
import { startTestServer, createTestUser, cleanupTestUser } from './helpers/testServer.js';
import {
  incrementDocumentCount,
  incrementQaCount,
  upsertSubscription,
} from '../src/modules/subscriptions/subscriptions.repository.js';

describe('Subscription, Entitlement & Metered Quota Lifecycle Tests', () => {
  let ctx;
  const userEmail = 'subscription-lifecycle-user@documind.test';
  let testUser;
  let testDoc;

  before(async () => {
    ctx = await startTestServer();
    testUser = await createTestUser({ email: userEmail, role: 'USER', fullName: 'Quota Test User' });

    // Seed a ready document for Q&A and export tests
    testDoc = await prisma.document.create({
      data: {
        userId: testUser.user.id,
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'READY',
        extractedText: 'DocuMind AI provides advanced document intelligence and semantic search.',
      },
    });
  });

  after(async () => {
    await prisma.document.deleteMany({ where: { userId: testUser.user.id } });
    await prisma.subscription.deleteMany({ where: { userId: testUser.user.id } });
    await prisma.usageQuota.deleteMany({ where: { userId: testUser.user.id } });
    await cleanupTestUser(userEmail);
    await ctx.close();
  });

  describe('1. Default Subscription & Tier Retrieval', () => {
    it('retrieves default FREE tier status and limits for new users', async () => {
      const res = await ctx.request('/subscriptions/me', {
        method: 'GET',
        token: testUser.token,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      const data = res.data.data;
      assert.equal(data.tier, 'FREE');
      assert.equal(data.status, 'ACTIVE');
      assert.equal(data.limits.maxDocuments, 5);
      assert.equal(data.limits.maxQuestionsPerMonth, 30);
      assert.deepEqual(data.limits.allowedExportFormats, ['pdf']);
      assert.equal(data.usage.documentsStored, 1);
    });
  });

  describe('2. Quota Metering & Incrementation', () => {
    it('increments monthly Q&A question quota and reflects in status', async () => {
      await incrementQaCount(testUser.user.id);
      await incrementQaCount(testUser.user.id);

      const res = await ctx.request('/subscriptions/me', {
        method: 'GET',
        token: testUser.token,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.data.usage.qaQuestionsAsked, 2);
    });

    it('increments document count and storage bytes', async () => {
      await incrementDocumentCount(testUser.user.id, undefined, 2, 2048);

      const res = await ctx.request('/subscriptions/me', {
        method: 'GET',
        token: testUser.token,
      });

      assert.equal(res.status, 200);
      assert.ok(res.data.data.usage.storageBytesUsed >= 2048);
    });
  });

  describe('3. Entitlement Guard & Route Blocking (HTTP 402)', () => {
    it('blocks DOCX export for FREE tier with HTTP 402 UPGRADE_REQUIRED', async () => {
      const res = await ctx.request(`/exports/${testDoc.id}/docx`, {
        method: 'GET',
        token: testUser.token,
      });

      assert.equal(res.status, 402);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'UPGRADE_REQUIRED');
      assert.equal(res.data.error.details.tier, 'FREE');
      assert.equal(res.data.error.details.requiredTier, 'PRO');
      assert.equal(res.data.error.details.upgradeUrl, '/profile/billing');
    });

    it('blocks Q&A when monthly question limit is exceeded with HTTP 402 QUOTA_EXCEEDED', async () => {
      // Simulate exhausting the 30 question limit
      const currentMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      await prisma.usageQuota.upsert({
        where: { userId_periodMonth: { userId: testUser.user.id, periodMonth: currentMonth } },
        create: { userId: testUser.user.id, periodMonth: currentMonth, qaQuestionsCount: 30 },
        update: { qaQuestionsCount: 30 },
      });

      const res = await ctx.request(`/qa/${testDoc.id}`, {
        method: 'POST',
        token: testUser.token,
        json: { question: 'What is DocuMind?' },
      });

      assert.equal(res.status, 402);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'QUOTA_EXCEEDED');
      assert.equal(res.data.error.details.tier, 'FREE');
      assert.equal(res.data.error.details.limit, 30);
      assert.equal(res.data.error.details.current, 30);
    });

    it('blocks document upload when document storage limit (5) is reached with HTTP 402 QUOTA_EXCEEDED', async () => {
      // Seed remaining documents so count reaches 5
      const extraDocs = [2, 3, 4, 5].map((i) => ({
        userId: testUser.user.id,
        filename: `extra-${i}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        status: 'READY',
      }));
      await prisma.document.createMany({ data: extraDocs });

      // Total count is now >= 5. Attempt upload
      const boundaryRes = await ctx.request('/documents', {
        method: 'POST',
        token: testUser.token,
      });

      assert.equal(boundaryRes.status, 402);
      assert.equal(boundaryRes.data.success, false);
      assert.equal(boundaryRes.data.error.code, 'QUOTA_EXCEEDED');
      assert.equal(boundaryRes.data.error.details.tier, 'FREE');
      assert.equal(boundaryRes.data.error.details.limit, 5);
      assert.equal(boundaryRes.data.error.details.current, 5);
    });
  });

  describe('4. Checkout Session & Portal Initiation', () => {
    it('creates a checkout session for PRO plan upgrade', async () => {
      const res = await ctx.request('/subscriptions/checkout', {
        method: 'POST',
        token: testUser.token,
        json: {
          tier: 'PRO',
          successUrl: 'http://localhost:5173/profile/billing?success=true',
          cancelUrl: 'http://localhost:5173/profile/billing?canceled=true',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.data.sessionId);
      assert.ok(res.data.data.url);
    });

    it('creates a customer portal session', async () => {
      const res = await ctx.request('/subscriptions/portal', {
        method: 'POST',
        token: testUser.token,
        json: {
          returnUrl: 'http://localhost:5173/profile/billing',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.data.url);
    });
  });

  describe('5. Webhook Processing: Upgrade & Downgrade Lifecycle', () => {
    it('upgrades user tier to PRO on checkout.session.completed webhook', async () => {
      const webhookPayload = {
        id: 'evt_test_checkout_' + Date.now(),
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_123',
            client_reference_id: testUser.user.id,
            customer: 'cus_test_documind_1',
            subscription: 'sub_test_documind_pro',
            metadata: {
              userId: testUser.user.id,
              tier: 'PRO',
            },
          },
        },
      };

      const res = await ctx.request('/subscriptions/webhook', {
        method: 'POST',
        json: webhookPayload,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);

      // Verify user tier is now PRO
      const statusRes = await ctx.request('/subscriptions/me', {
        method: 'GET',
        token: testUser.token,
      });

      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.data.data.tier, 'PRO');
      assert.equal(statusRes.data.data.status, 'ACTIVE');
      assert.equal(statusRes.data.data.limits.maxDocuments, 100);
      assert.equal(statusRes.data.data.limits.maxQuestionsPerMonth, 600);
      assert.ok(statusRes.data.data.limits.allowedExportFormats.includes('docx'));
    });

    it('downgrades user to FREE on customer.subscription.deleted webhook', async () => {
      const webhookPayload = {
        id: 'evt_test_sub_deleted_' + Date.now(),
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_documind_pro',
            customer: 'cus_test_documind_1',
            status: 'canceled',
          },
        },
      };

      const res = await ctx.request('/subscriptions/webhook', {
        method: 'POST',
        json: webhookPayload,
      });

      assert.equal(res.status, 200);

      // Verify user tier is downgraded to FREE
      const statusRes = await ctx.request('/subscriptions/me', {
        method: 'GET',
        token: testUser.token,
      });

      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.data.data.tier, 'FREE');
      assert.equal(statusRes.data.data.status, 'CANCELED');
      assert.equal(statusRes.data.data.limits.maxDocuments, 5);
    });
  });
});
