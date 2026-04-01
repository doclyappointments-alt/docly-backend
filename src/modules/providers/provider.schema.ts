// src/modules/providers/provider.schema.ts

import { z } from 'zod';

export const createProviderSchema = z.object({
  userId: z.number(),
  specialty: z.string().min(2, 'Specialty is required'),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
});

export const updateProviderSchema = z.object({
  specialty: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
});
