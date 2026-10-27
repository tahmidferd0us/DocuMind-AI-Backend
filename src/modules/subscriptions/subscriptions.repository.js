import { prisma } from '../../config/database.js';

export const getCurrentPeriodMonth = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const findSubscriptionByUserId = (userId) =>
  prisma.subscription.findUnique({ where: { userId } });

export const upsertSubscription = (userId, data) =>
  prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

export const findSubscriptionByStripeCustomerId = (stripeCustomerId) =>
  prisma.subscription.findUnique({ where: { stripeCustomerId } });

export const findSubscriptionByStripeSubscriptionId = (stripeSubscriptionId) =>
  prisma.subscription.findUnique({ where: { stripeSubscriptionId } });

export const updateSubscriptionByStripeSubscriptionId = (stripeSubscriptionId, data) =>
  prisma.subscription.update({
    where: { stripeSubscriptionId },
    data,
  });

export const getMonthlyUsage = async (userId, periodMonth = getCurrentPeriodMonth()) => {
  const quota = await prisma.usageQuota.findUnique({
    where: { userId_periodMonth: { userId, periodMonth } },
  });
  if (!quota) {
    return {
      userId,
      periodMonth,
      documentsCount: 0,
      qaQuestionsCount: 0,
      summariesCount: 0,
      storageBytesUsed: 0n,
    };
  }
  return quota;
};

export const incrementDocumentCount = (userId, periodMonth = getCurrentPeriodMonth(), increment = 1, storageBytes = 0) =>
  prisma.usageQuota.upsert({
    where: { userId_periodMonth: { userId, periodMonth } },
    create: {
      userId,
      periodMonth,
      documentsCount: increment,
      storageBytesUsed: BigInt(storageBytes),
    },
    update: {
      documentsCount: { increment },
      storageBytesUsed: { increment: BigInt(storageBytes) },
    },
  });

export const incrementQaCount = (userId, periodMonth = getCurrentPeriodMonth(), increment = 1) =>
  prisma.usageQuota.upsert({
    where: { userId_periodMonth: { userId, periodMonth } },
    create: {
      userId,
      periodMonth,
      qaQuestionsCount: increment,
    },
    update: {
      qaQuestionsCount: { increment },
    },
  });

export const incrementSummaryCount = (userId, periodMonth = getCurrentPeriodMonth(), increment = 1) =>
  prisma.usageQuota.upsert({
    where: { userId_periodMonth: { userId, periodMonth } },
    create: {
      userId,
      periodMonth,
      summariesCount: increment,
    },
    update: {
      summariesCount: { increment },
    },
  });

export const countUserDocuments = (userId) =>
  prisma.document.count({ where: { userId } });

export const sumUserStorageBytes = async (userId) => {
  const aggregate = await prisma.document.aggregate({
    where: { userId },
    _sum: { sizeBytes: true },
  });
  return aggregate._sum.sizeBytes || 0;
};
