//src/modules/appointments/appointment.schema.ts

import { z } from 'zod';

/* -------------------------------------------------------
 * CREATE APPOINTMENT (slot-based)
 * ----------------------------------------------------- */
export const createAppointmentSchema = z
  .object({
    slotId: z.number().min(1, 'slotId is required'),

    providerId: z.number().optional(),

    title: z.string().trim().min(1, 'Title is required').max(100),

    notes: z.string().max(500).optional(),
    location: z.string().max(200).optional(),
    duration: z.number().int().min(1).max(1440).optional(),

    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
  })
  .strict();

/* -------------------------------------------------------
 * UPDATE APPOINTMENT
 * ----------------------------------------------------- */
export const updateAppointmentSchema = z
  .object({
    providerId: z.number().int().optional(),
    date: z.coerce.date().optional(),

    title: z.string().trim().min(1).max(100).optional(),
    notes: z.string().max(500).optional(),
    location: z.string().max(200).optional(),
    duration: z.number().int().min(1).max(1440).optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).optional(),
  })
  .strict();

/* -------------------------------------------------------
 * RESCHEDULE APPOINTMENT
 * ----------------------------------------------------- */
export const rescheduleSchema = z
  .object({
    newSlotId: z.number().min(1, 'newSlotId is required'),
  })
  .strict();
