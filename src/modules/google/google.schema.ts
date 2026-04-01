// src/modules/google/google.schema.ts
import { z } from 'zod';

export const googleEventSchema = z.object({
  providerId: z.number(),

  title: z.string().min(1, 'Title is required'),

  startTime: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid start time'),

  endTime: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid end time'),

  description: z.string().max(500).optional(),

  location: z.string().max(200).optional(),
});
