import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './summaries.service.js';

export const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.getSummary(req.user.id, req.validated.params.documentId) }),
);

export const generate = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.generateSummary(req.user.id, req.validated.params.documentId, req.body), message: 'Summary generated' }),
);
