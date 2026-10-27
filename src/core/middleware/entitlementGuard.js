import { AppError } from '../errors/AppError.js';
import { getTierLimits, isFeatureAllowed } from '../../config/entitlements.js';
import {
  findSubscriptionByUserId,
  getMonthlyUsage,
  countUserDocuments,
} from '../../modules/subscriptions/subscriptions.repository.js';

export const requireEntitlement = (checkType) => async (req, _res, next) => {
  try {
    if (!req.user?.id) {
      return next(AppError.unauthorized('Authentication required'));
    }

    const subscription = await findSubscriptionByUserId(req.user.id);
    const tier = subscription?.tier || 'FREE';
    const limits = getTierLimits(tier);

    // 1. Document upload quota check
    if (checkType === 'document_upload' || checkType === 'upload' || checkType === 'documents') {
      const docCount = await countUserDocuments(req.user.id);
      if (docCount >= limits.maxDocuments) {
        return next(
          AppError.quotaExceeded(
            `You have reached your ${limits.name.toLowerCase()} plan document limit. Please upgrade to Pro for additional storage.`,
            {
              tier: limits.tier,
              limit: limits.maxDocuments,
              current: docCount,
              upgradeUrl: '/profile/billing',
            },
          ),
        );
      }

      if (req.file && req.file.size > limits.maxUploadSizeBytes) {
        const limitMb = Math.round(limits.maxUploadSizeBytes / (1024 * 1024));
        return next(
          AppError.quotaExceeded(
            `File size exceeds the ${limits.name} plan limit of ${limitMb}MB. Please upgrade your plan.`,
            {
              tier: limits.tier,
              limitBytes: limits.maxUploadSizeBytes,
              sizeBytes: req.file.size,
              upgradeUrl: '/profile/billing',
            },
          ),
        );
      }

      return next();
    }

    // 2. Q&A question monthly volume check
    if (checkType === 'qa_message' || checkType === 'qa' || checkType === 'ask') {
      const usage = await getMonthlyUsage(req.user.id);
      if (usage.qaQuestionsCount >= limits.maxQuestionsPerMonth) {
        return next(
          AppError.quotaExceeded(
            `You have reached your monthly Q&A question limit (${limits.maxQuestionsPerMonth} questions). Please upgrade to Pro for higher limits.`,
            {
              tier: limits.tier,
              limit: limits.maxQuestionsPerMonth,
              current: usage.qaQuestionsCount,
              upgradeUrl: '/profile/billing',
            },
          ),
        );
      }

      return next();
    }

    // 3. Export format check (e.g. DOCX for Free tier)
    if (checkType === 'export' || checkType === 'export_format' || checkType === 'docx_export') {
      const requestedFormat = (req.params?.format || req.validated?.params?.format || '').toLowerCase();
      if (requestedFormat === 'docx' && !isFeatureAllowed(tier, 'docx')) {
        return next(
          AppError.upgradeRequired(
            'DOCX exports are available on Pro and Enterprise plans. Please upgrade your plan to unlock DOCX downloads.',
            {
              tier: limits.tier,
              requiredTier: 'PRO',
              feature: 'docx_export',
              upgradeUrl: '/profile/billing',
            },
          ),
        );
      }

      return next();
    }

    if (typeof checkType === 'function') {
      await checkType(req, limits);
      return next();
    }

    next();
  } catch (error) {
    next(error);
  }
};
