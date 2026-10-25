import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/database.js';
import { startTestServer, createTestUser, cleanupTestUser } from './helpers/testServer.js';

describe('Tenant Isolation & Object-Level Permission Tests', () => {
  let ctx;
  const userAEmail = 'test-tenant-a@documind.test';
  const userBEmail = 'test-tenant-b@documind.test';
  const adminEmail = 'test-tenant-admin@documind.test';
  let userA;
  let userB;
  let adminUser;
  let docA;

  before(async () => {
    ctx = await startTestServer();
    userA = await createTestUser({ email: userAEmail, role: 'USER' });
    userB = await createTestUser({ email: userBEmail, role: 'USER' });
    adminUser = await createTestUser({ email: adminEmail, role: 'ADMIN' });

    // Seed a document owned by User A
    docA = await prisma.document.create({
      data: {
        userId: userA.user.id,
        filename: 'tenant_a_confidential.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        status: 'READY',
        extractedText: 'Confidential corporate strategy and financial statements for Tenant A.',
        pageCount: 1,
        wordCount: 10,
        charCount: 75,
      },
    });
  });

  after(async () => {
    if (docA?.id) {
      await prisma.document.deleteMany({ where: { id: docA.id } });
    }
    await cleanupTestUser(userAEmail);
    await cleanupTestUser(userBEmail);
    await cleanupTestUser(adminEmail);
    await ctx.close();
  });

  describe('Document Access & Read Isolation', () => {
    it('allows document owner (User A) to retrieve document details', async () => {
      const res = await ctx.request(`/documents/${docA.id}`, { token: userA.token });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.id, docA.id);
      assert.equal(res.data.data.filename, 'tenant_a_confidential.pdf');
    });

    it('denies other tenant (User B) from viewing User A document (returns 404 to prevent ID enumeration)', async () => {
      const res = await ctx.request(`/documents/${docA.id}`, { token: userB.token });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'NOT_FOUND');
    });

    it('denies other tenant (User B) from accessing User A extracted text', async () => {
      const res = await ctx.request(`/documents/${docA.id}/text`, { token: userB.token });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'NOT_FOUND');
    });
  });

  describe('Downstream AI Processing Permission Isolation', () => {
    it('denies other tenant (User B) from querying summaries for User A document', async () => {
      const res = await ctx.request(`/summaries/${docA.id}`, { token: userB.token });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
    });

    it('denies other tenant (User B) from requesting QA history on User A document', async () => {
      const res = await ctx.request(`/qa/${docA.id}`, { token: userB.token });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
    });

    it('denies other tenant (User B) from accessing entity sets on User A document', async () => {
      const res = await ctx.request(`/entities/${docA.id}`, { token: userB.token });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
    });

    it('denies other tenant (User B) from exporting reports on User A document', async () => {
      const res = await ctx.request(`/exports/${docA.id}/pdf`, { token: userB.token });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
    });

    it('denies other tenant (User B) from fetching analytics on User A document', async () => {
      const res = await ctx.request(`/analytics/${docA.id}`, { token: userB.token });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);
    });
  });

  describe('Document Modification and Deletion Isolation', () => {
    it('denies other tenant (User B) from deleting User A document', async () => {
      const res = await ctx.request(`/documents/${docA.id}`, {
        method: 'DELETE',
        token: userB.token,
      });
      assert.equal(res.status, 404);
      assert.equal(res.data.success, false);

      // Verify document still exists in DB
      const exists = await prisma.document.findUnique({ where: { id: docA.id } });
      assert.ok(exists !== null, 'Document must remain untouched');
    });

    it('allows platform administrator to list all documents across all tenants', async () => {
      const res = await ctx.request('/admin/documents', { token: adminUser.token });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      const hasDoc = res.data.data.some((d) => d.id === docA.id);
      assert.ok(hasDoc, 'Admin documents directory must list User A document');
    });

    it('allows platform administrator to delete documents across tenants via admin route', async () => {
      // Create a temporary document to delete
      const tempDoc = await prisma.document.create({
        data: {
          userId: userA.user.id,
          filename: 'to_be_deleted_by_admin.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 500,
          status: 'READY',
        },
      });

      const res = await ctx.request(`/admin/documents/${tempDoc.id}`, {
        method: 'DELETE',
        token: adminUser.token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);

      // Verify deleted from DB
      const check = await prisma.document.findUnique({ where: { id: tempDoc.id } });
      assert.equal(check, null);
    });
  });
});
