import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/config/database.js';
import { startTestServer, createTestUser, cleanupTestUser } from './helpers/testServer.js';
import { signAccessToken } from '../src/modules/auth/auth.tokens.js';

describe('Auth & Permission Lifecycle Tests', () => {
  let ctx;
  const standardEmail = 'test-standard-user@documind.test';
  const adminEmail = 'test-admin-user@documind.test';
  const secondaryAdminEmail = 'test-admin-user2@documind.test';
  let standardUser;
  let adminUser;
  let secondaryAdmin;

  before(async () => {
    ctx = await startTestServer();
    standardUser = await createTestUser({ email: standardEmail, role: 'USER' });
    adminUser = await createTestUser({ email: adminEmail, role: 'ADMIN' });
    secondaryAdmin = await createTestUser({ email: secondaryAdminEmail, role: 'ADMIN' });
  });

  after(async () => {
    await cleanupTestUser(standardEmail);
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(secondaryAdminEmail);
    await ctx.close();
  });

  describe('Authentication & Token Verification', () => {
    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await ctx.request('/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'UNAUTHORIZED');
    });

    it('rejects tampered or malformed bearer tokens with 401', async () => {
      const res = await ctx.request('/auth/me', { token: 'invalid.token.here' });
      assert.equal(res.status, 401);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'UNAUTHORIZED');
    });

    it('accepts valid bearer token and returns current user profile with role', async () => {
      const res = await ctx.request('/auth/me', { token: standardUser.token });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.data.email, standardEmail);
      assert.equal(res.data.data.role, 'USER');
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('blocks USER role from accessing admin analytics with 403 Forbidden', async () => {
      const res = await ctx.request('/admin/analytics', { token: standardUser.token });
      assert.equal(res.status, 403);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'FORBIDDEN');
    });

    it('blocks USER role from accessing admin users directory with 403 Forbidden', async () => {
      const res = await ctx.request('/admin/users', { token: standardUser.token });
      assert.equal(res.status, 403);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'FORBIDDEN');
    });

    it('blocks USER role from accessing admin platform documents with 403 Forbidden', async () => {
      const res = await ctx.request('/admin/documents', { token: standardUser.token });
      assert.equal(res.status, 403);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, 'FORBIDDEN');
    });

    it('allows ADMIN role to access admin analytics with 200 OK', async () => {
      const res = await ctx.request('/admin/analytics', { token: adminUser.token });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.data.users);
      assert.ok(res.data.data.system);
    });

    it('allows ADMIN role to access admin user directory with 200 OK', async () => {
      const res = await ctx.request('/admin/users', { token: adminUser.token });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.ok(typeof res.data.meta.total === 'number');
    });
  });

  describe('Administrative Safeguards & Session Revocation Lifecycle', () => {
    it('prevents an administrator from deactivating their own account with 400 Bad Request', async () => {
      const res = await ctx.request(`/admin/users/${adminUser.user.id}/status`, {
        method: 'PATCH',
        token: adminUser.token,
        json: { isActive: false },
      });
      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error.message, /cannot deactivate your own/i);
    });

    it('prevents demoting an administrator if only one active administrator remains', async () => {
      // Ensure adminUser is active admin
      await prisma.user.update({
        where: { id: adminUser.user.id },
        data: { role: 'ADMIN', isActive: true },
      });

      // Temporarily deactivate all other active admins except adminUser
      const otherAdmins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true, NOT: { id: adminUser.user.id } },
        select: { id: true },
      });

      await prisma.user.updateMany({
        where: { id: { in: otherAdmins.map((a) => a.id) } },
        data: { isActive: false },
      });

      try {
        const res = await ctx.request(`/admin/users/${adminUser.user.id}/role`, {
          method: 'PATCH',
          token: adminUser.token,
          json: { role: 'USER' },
        });
        assert.equal(res.status, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.error.message, /at least one active administrator is required/i);
      } finally {
        // Restore other admins
        await prisma.user.updateMany({
          where: { id: { in: otherAdmins.map((a) => a.id) } },
          data: { isActive: true },
        });
      }
    });

    it('revokes all sessions when a user is deactivated by an administrator', async () => {
      // Create a dummy session for standard user
      const testSession = await prisma.session.create({
        data: {
          userId: standardUser.user.id,
          refreshTokenHash: 'dummy_hash_for_session_revocation_test',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      assert.equal(testSession.revokedAt, null);

      // Admin deactivates the user
      const res = await ctx.request(`/admin/users/${standardUser.user.id}/status`, {
        method: 'PATCH',
        token: adminUser.token,
        json: { isActive: false },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.data.isActive, false);

      // Verify that all sessions for that user were revoked
      const updatedSession = await prisma.session.findUnique({
        where: { id: testSession.id },
      });
      assert.ok(updatedSession.revokedAt !== null, 'Session should have been revoked');

      // Reactivate user for subsequent tests
      await prisma.user.update({
        where: { id: standardUser.user.id },
        data: { isActive: true },
      });
    });

    it('revokes all sessions when a user role is changed by an administrator', async () => {
      const testSession = await prisma.session.create({
        data: {
          userId: secondaryAdmin.user.id,
          refreshTokenHash: 'dummy_hash_for_role_change_revocation_test',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      assert.equal(testSession.revokedAt, null);

      // Admin demotes secondary admin to USER
      const res = await ctx.request(`/admin/users/${secondaryAdmin.user.id}/role`, {
        method: 'PATCH',
        token: adminUser.token,
        json: { role: 'USER' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.data.role, 'USER');

      // Verify session revocation
      const updatedSession = await prisma.session.findUnique({
        where: { id: testSession.id },
      });
      assert.ok(updatedSession.revokedAt !== null, 'Session should have been revoked on role change');

      // Restore secondary admin role
      await prisma.user.update({
        where: { id: secondaryAdmin.user.id },
        data: { role: 'ADMIN' },
      });
    });
  });
});
