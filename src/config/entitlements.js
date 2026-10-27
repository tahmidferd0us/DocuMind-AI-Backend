export const PLAN_TIERS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
};

export const TIER_LIMITS = {
  [PLAN_TIERS.FREE]: {
    name: 'Free',
    tier: PLAN_TIERS.FREE,
    maxDocuments: 5,
    maxUploadSizeBytes: 10 * 1024 * 1024, // 10MB
    maxQuestionsPerMonth: 30,
    allowedSummaryMethods: ['lexrank', 'luhn'],
    allowedExportFormats: ['pdf'],
    hasAdvancedAnalytics: false,
    analyticsLevel: 'basic',
    priceMonthly: 0,
    description: 'Essential document intelligence for individuals getting started.',
  },
  [PLAN_TIERS.STARTER]: {
    name: 'Starter',
    tier: PLAN_TIERS.STARTER,
    maxDocuments: 25,
    maxUploadSizeBytes: 25 * 1024 * 1024, // 25MB
    maxQuestionsPerMonth: 150,
    allowedSummaryMethods: ['lexrank', 'luhn', 'textrank'],
    allowedExportFormats: ['pdf'],
    hasAdvancedAnalytics: true,
    analyticsLevel: 'standard',
    priceMonthly: 12,
    description: 'Perfect for students, researchers, and solo knowledge workers.',
  },
  [PLAN_TIERS.PRO]: {
    name: 'Pro',
    tier: PLAN_TIERS.PRO,
    maxDocuments: 100,
    maxUploadSizeBytes: 50 * 1024 * 1024, // 50MB
    maxQuestionsPerMonth: 600,
    allowedSummaryMethods: ['lexrank', 'luhn', 'textrank', 'abstractive'],
    allowedExportFormats: ['pdf', 'docx'],
    hasAdvancedAnalytics: true,
    analyticsLevel: 'full',
    priceMonthly: 29,
    description: 'Power tools, DOCX exports, and deep Q&A for professionals and teams.',
  },
  [PLAN_TIERS.ENTERPRISE]: {
    name: 'Enterprise',
    tier: PLAN_TIERS.ENTERPRISE,
    maxDocuments: Infinity,
    maxUploadSizeBytes: 200 * 1024 * 1024, // 200MB
    maxQuestionsPerMonth: Infinity,
    allowedSummaryMethods: ['lexrank', 'luhn', 'textrank', 'abstractive'],
    allowedExportFormats: ['pdf', 'docx'],
    hasAdvancedAnalytics: true,
    analyticsLevel: 'full',
    priceMonthly: 99,
    description: 'Unlimited documents, dedicated compute, and priority support.',
  },
};

export const getTierLimits = (tier = PLAN_TIERS.FREE) => {
  const normalized = (tier || '').toUpperCase();
  return TIER_LIMITS[normalized] || TIER_LIMITS[PLAN_TIERS.FREE];
};

export const canUploadFile = (tier, fileSizeBytes = 0, currentDocCount = 0) => {
  const limits = getTierLimits(tier);
  const sizeAllowed = fileSizeBytes <= limits.maxUploadSizeBytes;
  const countAllowed = currentDocCount < limits.maxDocuments;
  return {
    allowed: sizeAllowed && countAllowed,
    sizeAllowed,
    countAllowed,
    maxUploadSizeBytes: limits.maxUploadSizeBytes,
    maxDocuments: limits.maxDocuments,
  };
};

export const canAskQuestion = (tier, currentMonthQuestionCount = 0) => {
  const limits = getTierLimits(tier);
  const allowed = currentMonthQuestionCount < limits.maxQuestionsPerMonth;
  return {
    allowed,
    maxQuestionsPerMonth: limits.maxQuestionsPerMonth,
    currentMonthQuestionCount,
  };
};

export const isFeatureAllowed = (tier, featureName) => {
  const limits = getTierLimits(tier);
  const feature = (featureName || '').toLowerCase().trim();

  if (feature === 'docx' || feature === 'docx_export' || feature === 'export_docx') {
    return limits.allowedExportFormats.includes('docx');
  }
  if (feature === 'pdf' || feature === 'pdf_export' || feature === 'export_pdf') {
    return limits.allowedExportFormats.includes('pdf');
  }
  if (feature === 'abstractive' || feature === 'abstractive_summary') {
    return limits.allowedSummaryMethods.includes('abstractive');
  }
  if (feature === 'advanced_analytics' || feature === 'analytics_full') {
    return limits.hasAdvancedAnalytics;
  }
  if (limits.allowedExportFormats.includes(feature)) {
    return true;
  }
  if (limits.allowedSummaryMethods.includes(feature)) {
    return true;
  }
  return false;
};
