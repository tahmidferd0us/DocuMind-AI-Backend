import { Router } from 'express';
import { authLimiter } from '../../core/middleware/rateLimiters.js';
import { requireAuth } from '../../core/middleware/authGuard.js';
import { validate } from '../../core/middleware/validate.js';
import * as controller from './auth.controller.js';
import { changePasswordSchema, emailOnlySchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema, updateProfileSchema } from './auth.validation.js';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, validate(registerSchema), controller.register);
authRoutes.post('/login', authLimiter, validate(loginSchema), controller.login);
authRoutes.post('/verify-email', authLimiter, validate(tokenSchema), controller.verifyEmail);
authRoutes.post('/resend-verification', authLimiter, validate(emailOnlySchema), controller.resendVerification);
authRoutes.post('/forgot-password', authLimiter, validate(emailOnlySchema), controller.forgotPassword);
authRoutes.post('/reset-password', authLimiter, validate(resetPasswordSchema), controller.resetPassword);
authRoutes.post('/refresh', controller.refresh);
authRoutes.post('/logout', controller.logout);
authRoutes.get('/me', requireAuth, controller.me);
authRoutes.patch('/profile', requireAuth, validate(updateProfileSchema), controller.updateProfile);
authRoutes.patch('/password', requireAuth, validate(changePasswordSchema), controller.changePassword);

