import { Router } from 'express';
import authModule from './auth/index.js';
import documentsModule from './documents/index.js';
import entitiesModule from './entities/index.js';
import exportsModule from './exports/index.js';
import healthModule from './health/index.js';
import qaModule from './qa/index.js';
import summariesModule from './summaries/index.js';

export const modules = [healthModule, authModule, documentsModule, summariesModule, qaModule, entitiesModule, exportsModule];

export const buildModuleRouter = () => {
  const router = Router();
  for (const module of modules) router.use(module.basePath, module.router);
  return router;
};
