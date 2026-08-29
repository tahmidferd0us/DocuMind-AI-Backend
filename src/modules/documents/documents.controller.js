import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendCreated, sendPaginated, sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './documents.service.js';

export const upload = asyncHandler(async (req, res) => {
  const document = await service.ingestDocument(req.user.id, req.file);
  sendCreated(res, { data: document, message: 'Document uploaded and parsed' });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = req.validated.query;
  const { items, total } = await service.listDocuments(req.user.id, { page, limit });
  sendPaginated(res, { items, page, limit, total });
});

export const detail = asyncHandler(async (req, res) => sendSuccess(res, { data: await service.getDocument(req.user.id, req.validated.params.id) }));

export const text = asyncHandler(async (req, res) => {
  const document = await service.getDocumentText(req.user.id, req.validated.params.id);
  sendSuccess(res, { data: { id: document.id, filename: document.filename, text: document.extractedText } });
});

export const remove = asyncHandler(async (req, res) => {
  await service.removeDocument(req.user.id, req.validated.params.id);
  sendSuccess(res, { message: 'Document deleted' });
});
