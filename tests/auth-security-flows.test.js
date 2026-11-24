import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/config/database.js';
import * as auth from '../src/modules/auth/auth.service.js';
import { hashAuthToken, hashRefreshToken } from '../src/modules/auth/auth.tokens.js';
import { runCleanup } from '../src/core/utils/cron.js';

describe('Account security flows', () => {
  let user;
  const email = `auth-security-${randomUUID()}@documind.test`;

  before(async () => {
    user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash('Password123!', 4) } });
  });

  after(async () => {
    if (user) await prisma.user.delete({ where: { id: user.id } });
  });

  it('requires verification before login and consumes verification tokens once', async () => {
    await assert.rejects(auth.login({ email, password: 'Password123!' }), /Verify your email/);
    const token = randomUUID();
    await prisma.authToken.create({ data: { userId: user.id, type: 'EMAIL_VERIFICATION', tokenHash: hashAuthToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    await auth.verifyEmail({ token });
    await assert.rejects(auth.verifyEmail({ token }), /invalid or expired/);
    const session = await auth.login({ email, password: 'Password123!' });
    assert.ok(session.accessToken);
  });

  it('revokes every session in a family when a rotated refresh token is reused', async () => {
    const familyId = randomUUID();
    const oldToken = randomUUID();
    await prisma.session.create({ data: { userId: user.id, familyId, refreshTokenHash: hashRefreshToken(oldToken), expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() } });
    const current = await prisma.session.create({ data: { userId: user.id, familyId, refreshTokenHash: hashRefreshToken(randomUUID()), expiresAt: new Date(Date.now() + 60_000) } });
    await assert.rejects(auth.refresh(oldToken), /invalid or expired/);
    const revoked = await prisma.session.findUnique({ where: { id: current.id } });
    assert.ok(revoked.revokedAt);
  });

  it('resets password and revokes active sessions', async () => {
    const refreshToken = randomUUID();
    const session = await prisma.session.create({ data: { userId: user.id, familyId: randomUUID(), refreshTokenHash: hashRefreshToken(refreshToken), expiresAt: new Date(Date.now() + 60_000) } });
    const token = randomUUID();
    await prisma.authToken.create({ data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: hashAuthToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    await auth.resetPassword({ token, password: 'NewPassword123!' });
    const updated = await prisma.session.findUnique({ where: { id: session.id } });
    assert.ok(updated.revokedAt);
    assert.equal(await bcrypt.compare('NewPassword123!', (await prisma.user.findUnique({ where: { id: user.id } })).passwordHash), true);
  });

  it('removes expired sessions and expired account tokens during housekeeping', async () => {
    const session = await prisma.session.create({ data: { userId: user.id, familyId: randomUUID(), refreshTokenHash: hashRefreshToken(randomUUID()), expiresAt: new Date(Date.now() - 60_000) } });
    const token = await prisma.authToken.create({ data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: hashAuthToken(randomUUID()), expiresAt: new Date(Date.now() - 60_000) } });
    const result = await runCleanup();
    assert.ok(result.count >= 1);
    assert.ok(result.tokenCount >= 1);
    assert.equal(await prisma.session.findUnique({ where: { id: session.id } }), null);
    assert.equal(await prisma.authToken.findUnique({ where: { id: token.id } }), null);
  });
});
