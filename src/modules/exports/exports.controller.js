import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './exports.service.js';

export const contents = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.getReportContents(req.user.id, req.validated.params.documentId) }),
);

export const download = asyncHandler(async (req, res) => {
  const { documentId, format } = req.validated.params;
  const { buffer, mimeType, filename } = await service.buildReport(req.user.id, documentId, format);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(buffer);
});
