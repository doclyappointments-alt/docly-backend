// src/modules/auth/auth.schema.ts
import { z } from 'zod';

/**
 * Registration
 */
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters'),

  email: z
    .string()
    .email('Invalid email format'),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),

  role: z.enum(['PATIENT', 'PROVIDER']),
});

/**
 * Login
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format'),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

/**
 * Password reset request:
 * Always returns generic success
 */
export const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Password reset confirm
 * - token: raw token from email/link (hex)
 * - newPassword: new password
 */
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(32, 'Invalid token'),

  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});
