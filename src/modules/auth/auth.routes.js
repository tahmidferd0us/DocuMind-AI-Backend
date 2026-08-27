import { Router } from 'express';
import { authLimiter } from '../../core/middleware/rateLimiters.js';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './auth.controller.js';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.validation.js';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, validate(registerSchema), controller.register);
authRoutes.post('/login', authLimiter, validate(loginSchema), controller.login);
authRoutes.post('/refresh', controller.refresh);
authRoutes.post('/logout', controller.logout);
authRoutes.get('/me', requireAuth, controller.me);
authRoutes.patch('/password', requireAuth, validate(changePasswordSchema), controller.changePassword);
