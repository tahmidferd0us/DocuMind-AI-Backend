import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './qa.service.js';

export const history = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.getHistory(req.user.id, req.validated.params.documentId) }),
);

export const ask = asyncHandler(async (req, res) =>
  sendCreated(res, { data: await service.ask(req.user.id, req.validated.params.documentId, req.body), message: 'Answer generated' }),
);

export const clear = asyncHandler(async (req, res) => {
  await service.clearHistory(req.user.id, req.validated.params.documentId);
  sendSuccess(res, { message: 'Conversation cleared' });
});
