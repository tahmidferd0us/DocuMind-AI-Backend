import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './analytics.service.js';

export const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.getDocumentAnalytics(req.user.id, req.validated.params.documentId) }),
);
