import { asyncHandler } from '../../core/http/asyncHandler.js';
import { sendPaginated, sendSuccess } from '../../core/http/apiResponse.js';
import * as service from './admin.service.js';

export const getAnalytics = asyncHandler(async (_req, res) => {
  const analytics = await service.getAnalytics();
  sendSuccess(res, { data: analytics, message: 'Platform analytics retrieved successfully' });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, status } = req.validated.query;
  const { items, total } = await service.listUsers({ page, limit, search, role, status });
  sendPaginated(res, { items, page, limit, total });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { isActive } = req.body;
  const user = await service.updateUserStatus(req.user.id, id, { isActive });
  sendSuccess(res, { data: user, message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { role } = req.body;
  const user = await service.updateUserRole(req.user.id, id, { role });
  sendSuccess(res, { data: user, message: `User role updated to ${role}` });
});

export const listDocuments = asyncHandler(async (req, res) => {
  const { page, limit, search, status } = req.validated.query;
  const { items, total } = await service.listDocuments({ page, limit, search, status });
  sendPaginated(res, { items, page, limit, total });
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  await service.deleteDocument(id);
  sendSuccess(res, { message: 'Document deleted successfully by administrator' });
});
