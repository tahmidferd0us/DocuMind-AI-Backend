export const sendSuccess = (res, { data = null, message = 'Success', statusCode = 200, meta = null } = {}) =>
  res.status(statusCode).json({ success: true, message, data, ...(meta ? { meta } : {}) });

export const sendCreated = (res, { data = null, message = 'Created' } = {}) => sendSuccess(res, { data, message, statusCode: 201 });

export const sendPaginated = (res, { items, page, limit, total, message = 'Success' }) =>
  sendSuccess(res, { data: items, message, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), hasNext: page * limit < total, hasPrev: page > 1 } });

export const sendError = (res, { statusCode = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details = null }) =>
  res.status(statusCode).json({ success: false, message, error: { code, message, ...(details ? { details } : {}) } });
