// src/modules/notifications/notification.schema.ts

import { z } from 'zod';

export const sendNotificationSchema = z.object({
  userId: z.number(),

  type: z.enum(['EMAIL', 'SMS']),

  templateId: z.string(),

  variables: z
    .record(z.string(), z.string())
    .optional(),
});
