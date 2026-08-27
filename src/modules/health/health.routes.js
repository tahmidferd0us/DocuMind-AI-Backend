import { Router } from 'express';
import * as controller from './health.controller.js';

export const healthRoutes = Router();

healthRoutes.get('/', controller.liveness);
healthRoutes.get('/ready', controller.readiness);
