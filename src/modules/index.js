import { Router } from 'express';
import authModule from './auth/index.js';
import healthModule from './health/index.js';

export const modules = [healthModule, authModule];

export const buildModuleRouter = () => {
  const router = Router();
  for (const module of modules) router.use(module.basePath, module.router);
  return router;
};
