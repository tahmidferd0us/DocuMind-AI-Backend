import { AppError } from '../errors/AppError.js';

const formatIssues = (error) => error.issues.map((issue) => ({ field: issue.path.join('.') || '_root', message: issue.message }));

export const validate = (schemas) => (req, _res, next) => {
  for (const key of ['body', 'query', 'params']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key]);
    if (!result.success) return next(AppError.validation(`Invalid request ${key}`, formatIssues(result.error)));
    if (key === 'body') req.body = result.data;
    else req.validated = { ...(req.validated ?? {}), [key]: result.data };
  }
  next();
};
