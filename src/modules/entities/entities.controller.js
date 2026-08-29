import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './entities.service.js';

export const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.getEntities(req.user.id, req.validated.params.documentId) }),
);

export const extract = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.extractEntities(req.user.id, req.validated.params.documentId), message: 'Entities extracted' }),
);
