// src/modules/users/user.schema
import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['USER', 'PROVIDER', 'ADMIN']).optional(), // match your roles enum
});
