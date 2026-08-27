import { z } from 'zod';

const email = z.email('Enter a valid email address').trim().toLowerCase();
const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters');

export const registerSchema = {
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(80).optional(),
    email,
    password: password.regex(/[a-z]/, 'Password must contain a lowercase letter').regex(/[A-Z]/, 'Password must contain an uppercase letter').regex(/\d/, 'Password must contain a number'),
  }),
};

export const loginSchema = { body: z.object({ email, password: z.string().min(1, 'Password is required') }) };

export const changePasswordSchema = {
  body: z.object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: password }),
};
