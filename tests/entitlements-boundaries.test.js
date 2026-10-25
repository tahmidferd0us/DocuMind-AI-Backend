import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { assertSupportedFile } from '../src/modules/documents/documents.service.js';
import { startTestServer, createTestUser, cleanupTestUser } from './helpers/testServer.js';

describe('Entitlements, Quotas & Boundary Tests', () => {
  let ctx;
  const userEmail = 'test-entitlements-user@documind.test';
  let testUser;

  before(async () => {
    ctx = await startTestServer();
    testUser = await createTestUser({ email: userEmail, role: 'USER' });
  });

  after(async () => {
    await cleanupTestUser(userEmail);
    await ctx.close();
  });

  describe('Upload File Size & Extension Entitlement Boundaries', () => {
    it('rejects 0-byte file upload with 400 Bad Request', () => {
      assert.throws(
        () => assertSupportedFile({ originalname: 'empty.pdf', size: 0 }),
        (err) => err.statusCode === 400 && /empty \(0 bytes\)/i.test(err.message),
      );
    });

    it('rejects unsupported file extensions with 400 Bad Request', () => {
      const unsupported = ['malware.exe', 'image.png', 'script.sh', 'data.csv'];
      for (const filename of unsupported) {
        assert.throws(
          () => assertSupportedFile({ originalname: filename, size: 500 }),
          (err) => err.statusCode === 400 && /Only \.pdf, \.docx, \.txt/i.test(err.message),
        );
      }
    });

    it('accepts supported file extensions (.pdf, .docx, .txt)', () => {
      const supported = ['doc.pdf', 'file.docx', 'notes.txt', 'UPPERCASE.PDF'];
      for (const filename of supported) {
        assert.doesNotThrow(() => assertSupportedFile({ originalname: filename, size: 500 }));
      }
    });

    it('enforces maximum upload boundary configured via MAX_UPLOAD_BYTES', () => {
      assert.ok(env.MAX_UPLOAD_BYTES > 0);
      assert.equal(env.MAX_UPLOAD_BYTES, 20 * 1024 * 1024);
    });

    it('rejects document upload without file with 400 Bad Request', async () => {
      // Send POST without multipart file
      const res = await ctx.request('/documents', {
        method: 'POST',
        token: testUser.token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.match(res.data.error.message, /No file was uploaded/i);
    });
  });

  describe('Rate Limiter Entitlement Protection', () => {
    it('configures draft-7 standard headers on rate limited responses', async () => {
      const res = await ctx.request('/auth/me', { token: testUser.token });
      assert.equal(res.status, 200);
      // Express rate limiter draft-7 sets 'ratelimit' or 'ratelimit-policy' headers
      assert.ok(res.headers.get('ratelimit') || res.headers.get('ratelimit-policy'));
    });
  });

  describe('Contract Verification for Future Entitlements Engine', () => {
    // Defines and verifies the exact entitlement matrix requirements for DocuMind AI
    const TIER_ENTITLEMENT_MATRIX = {
      FREE: {
        maxDocuments: 5,
        maxUploadSizeBytes: 10 * 1024 * 1024, // 10MB
        maxQuestionsPerMonth: 30,
        allowedExportFormats: ['pdf'],
        allowedSummaryMethods: ['lexrank', 'luhn'],
        hasAdvancedAnalytics: false,
      },
      PRO: {
        maxDocuments: 50,
        maxUploadSizeBytes: 50 * 1024 * 1024, // 50MB
        maxQuestionsPerMonth: 500,
        allowedExportFormats: ['pdf', 'docx'],
        allowedSummaryMethods: ['lexrank', 'luhn', 'textrank', 'abstractive'],
        hasAdvancedAnalytics: true,
      },
      ENTERPRISE: {
        maxDocuments: Infinity,
        maxUploadSizeBytes: 200 * 1024 * 1024, // 200MB
        maxQuestionsPerMonth: Infinity,
        allowedExportFormats: ['pdf', 'docx'],
        allowedSummaryMethods: ['lexrank', 'luhn', 'textrank', 'abstractive'],
        hasAdvancedAnalytics: true,
      },
    };

    it('validates tier hierarchy and quota monotonicity', () => {
      assert.ok(TIER_ENTITLEMENT_MATRIX.PRO.maxDocuments > TIER_ENTITLEMENT_MATRIX.FREE.maxDocuments);
      assert.ok(TIER_ENTITLEMENT_MATRIX.PRO.maxUploadSizeBytes > TIER_ENTITLEMENT_MATRIX.FREE.maxUploadSizeBytes);
      assert.ok(TIER_ENTITLEMENT_MATRIX.ENTERPRISE.maxUploadSizeBytes > TIER_ENTITLEMENT_MATRIX.PRO.maxUploadSizeBytes);
      assert.ok(TIER_ENTITLEMENT_MATRIX.FREE.allowedExportFormats.length < TIER_ENTITLEMENT_MATRIX.PRO.allowedExportFormats.length);
    });

    it('validates entitlement check specification function', () => {
      const checkEntitlement = (tier, feature, requestedAmount = 1) => {
        const spec = TIER_ENTITLEMENT_MATRIX[tier];
        if (!spec) return { allowed: false, reason: 'INVALID_TIER' };
        if (feature === 'UPLOAD_SIZE') {
          return { allowed: requestedAmount <= spec.maxUploadSizeBytes, max: spec.maxUploadSizeBytes };
        }
        if (feature === 'DOCUMENT_COUNT') {
          return { allowed: requestedAmount < spec.maxDocuments, max: spec.maxDocuments };
        }
        if (feature === 'EXPORT_FORMAT') {
          return { allowed: spec.allowedExportFormats.includes(requestedAmount), allowedFormats: spec.allowedExportFormats };
        }
        if (feature === 'ADVANCED_ANALYTICS') {
          return { allowed: spec.hasAdvancedAnalytics };
        }
        return { allowed: false, reason: 'UNKNOWN_FEATURE' };
      };

      // Free tier cannot export DOCX
      assert.equal(checkEntitlement('FREE', 'EXPORT_FORMAT', 'docx').allowed, false);
      // Pro tier can export DOCX
      assert.equal(checkEntitlement('PRO', 'EXPORT_FORMAT', 'docx').allowed, true);
      // Free tier cannot access advanced analytics
      assert.equal(checkEntitlement('FREE', 'ADVANCED_ANALYTICS').allowed, false);
      // Pro tier can access advanced analytics
      assert.equal(checkEntitlement('PRO', 'ADVANCED_ANALYTICS').allowed, true);
    });
  });
});
