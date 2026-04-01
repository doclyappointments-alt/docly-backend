// src/modules/providerScheduleTemplates/template.validation.ts

import { z } from 'zod';

export const createTemplateSchema = z.object({
  dayOfWeek: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY"
  ]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().min(5).max(120),
  isActive: z.boolean().optional()
});

export const updateTemplateSchema = createTemplateSchema.partial();
