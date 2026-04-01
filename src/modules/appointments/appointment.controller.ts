// src/modules/appointments/appointment.controller.ts

import { Request, Response } from 'express';
import prisma from '@common/utils/prismaClient.js';
import { createAppointmentSchema, updateAppointmentSchema } from './appointment.schema.js';
import { logger } from '@common/utils/logger.js';
import { enqueueCalendarSync } from '@common/queues/calendarSyncQueue.js';
import { toAppointmentDTO } from '@common/dto/appointment.dto.js';
import * as AppointmentService from './appointment.service.js';
import { AppointmentStatus } from '@prisma/client';

const log = logger.child({ controller: 'appointments' });

/* -------------------------------------------------------
 * SHARED CONSTANTS / HELPERS
 * ----------------------------------------------------- */

// Global default "lock window" in hours — currently DISABLED in code
// TODO: wire this to a per-provider setting + actually enforce later.
// const DEFAULT_LOCK_HOURS_BEFORE = 24;

/**
 * Lock window logic.
 *
 * ⚠️ Currently disabled (always returns false) so tests and dev flows
 * can freely update/cancel/reschedule right up to start time.
 *
 * TODO: Re-enable this with a proper per-provider setting.
 */
function isInsideLockWindow(_appointmentDate: Date): boolean {
  // Example of future logic:
  //
  // const now = new Date();
  // const diffMs = appointmentDate.getTime() - now.getTime();
  // const diffHours = diffMs / (1000 * 60 * 60);
  // return diffHours < DEFAULT_LOCK_HOURS_BEFORE;
  //
  // For now: no lock.
  return false;
}

/* -------------------------------------------------------
 * CREATE APPOINTMENT (slot-backed)
 * ----------------------------------------------------- */
export const createAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.userId)
      return res.status(401).json({ error: "Unauthorized" });

    // Validate body
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.issues });

    const { slotId, title } = parsed.data;
    const userId = req.userId;

    // Fetch slot
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot)
      return res.status(404).json({ error: "Slot not found" });

    if (slot.booked)
      return res.status(409).json({ error: "Slot already booked" });

    const appointmentDate = slot.start;
    const providerId = slot.providerId;

    // FINAL LOGIC:
    //   nolimit_* → limits OFF
    //   everything else → limits ON

/* -------------------------------------------------------
 * TIME-BASED VALIDATION
 * ----------------------------------------------------- */

const MIN_BOOKING_MINUTES = 60;
const MAX_BOOKING_DAYS = 90;

const now = new Date();
const minutesUntil = (appointmentDate.getTime() - now.getTime()) / 60000;
const daysUntil = minutesUntil / (60 * 24);

// ⬇️ APPLY BOOKING WINDOW ONLY IF APPOINTMENT IS NOT SLOT-BACKED
// Slot-backed appointments represent provider-approved availability
if (!slotId && req.userRole === 'PATIENT') {
  if (minutesUntil < MIN_BOOKING_MINUTES) {
    return res.status(400).json({
      error: `Appointments must be booked at least ${MIN_BOOKING_MINUTES} mins in advance`,
    });
  }

  if (daysUntil > MAX_BOOKING_DAYS) {
    return res.status(400).json({
      error: `Appointments cannot be booked more than ${MAX_BOOKING_DAYS} days in advance`,
    });
  }
}

/* -------------------------------------------------------
 * BOOKING LIMITS — ONLY ACTIVE APPOINTMENTS COUNT
 * ----------------------------------------------------- */

const MAX_PROVIDER_BOOKINGS_PER_DAY = 20;
const MAX_PATIENT_BOOKINGS_PER_DAY = 3;
const MAX_PATIENT_BOOKINGS_PER_WEEK = 10;

const p = appointmentDate;

// Day window in UTC
const dayStart = new Date(Date.UTC(
  p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate(),
  0, 0, 0, 0
));

const dayEnd = new Date(Date.UTC(
  p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate(),
  23, 59, 59, 999
));

// Rolling 7-day window
const weekStart = new Date(appointmentDate);
weekStart.setDate(weekStart.getDate() - 6);
weekStart.setHours(0, 0, 0, 0);

const weekEnd = new Date(appointmentDate);
weekEnd.setHours(23, 59, 59, 999);

const activeStatuses: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

// Provider daily limit
const providerDaily = await prisma.appointment.count({
  where: {
    providerId,
    status: { in: activeStatuses },
    date: { gte: dayStart, lte: dayEnd },
  },
});

if (providerDaily >= MAX_PROVIDER_BOOKINGS_PER_DAY) {
  return res.status(400).json({
    error: "Provider has reached maximum daily booking limit",
  });
}

// Patient weekly limit
const weeklyCount = await prisma.appointment.count({
  where: {
    userId,
    status: { in: activeStatuses },
    date: { gte: weekStart, lte: weekEnd },
  },
});

if (weeklyCount >= MAX_PATIENT_BOOKINGS_PER_WEEK) {
  return res.status(400).json({
    error: "You have reached the weekly appointment limit",
  });
}

// Patient daily limit
const dailyCount = await prisma.appointment.count({
  where: {
    userId,
    status: { in: activeStatuses },
    date: { gte: dayStart, lte: dayEnd },
  },
});

if (dailyCount >= MAX_PATIENT_BOOKINGS_PER_DAY) {
  return res.status(400).json({
    error: "You have reached the daily appointment limit",
  });
}

    /* -------------------------------------------------------
     * CREATE APPOINTMENT — TRANSACTION
     * ----------------------------------------------------- */
    const appointment = await prisma.$transaction(async (tx) => {
      const slotClaim = await tx.appointmentSlot.updateMany({
        where: { id: slotId, booked: false },
        data: { booked: true },
      });

      if (slotClaim.count !== 1) {
        const e: any = new Error("Slot already booked");
        e.status = 409;
        throw e;
      }

      return tx.appointment.create({
        data: {
          title,
          date: appointmentDate,
          userId,
          providerId,
          slotId,
          notes: parsed.data.notes ?? null,
        },
        include: { provider: true, user: true, slot: true },
      });
    });

// --------------------
// SCHEDULE REMINDERS
// --------------------

    await enqueueCalendarSync({ providerId });

    return res.status(201).json({
      message: "Appointment created",
      appointment: toAppointmentDTO(appointment, req.userRole),
    });

  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Duplicate booking blocked" });
    }
    log.error({ err, route: "createAppointment" });
    return res.status(err.status || 500).json({
      error: err.message ?? "Failed to create appointment",
      details: String(err),
    });
  }
};

/* -------------------------------------------------------
 * UPDATE APPOINTMENT
 * ----------------------------------------------------- */
export const updateAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const parsed = updateAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.issues });
    }

    const { date, ...rest } = parsed.data;

    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { slot: true, provider: true, user: true },
    });

    if (!appt || appt.userId !== req.userId) {
      return res
        .status(404)
        .json({ error: 'Appointment not found or not owned by user' });
    }

    // Lock window check (currently always false)
    if (req.userRole === 'PATIENT' && isInsideLockWindow(appt.date)) {
      return res.status(400).json({
        error:
          'This appointment is too close to start time to be updated online. Contact provider directly.',
      });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...rest,
        notes: rest.notes ?? appt.notes,
        date: date ? new Date(date) : appt.date,
      },
      include: { provider: true, user: true, slot: true },
    });

    return res.json({
      message: 'Appointment updated',
      appointment: toAppointmentDTO(updated, req.userRole),
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to update appointment',
      details: String(err),
    });
  }
};

/* -------------------------------------------------------
 * LIST APPOINTMENTS
 * ----------------------------------------------------- */
export const listAppointments = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const where: any = {};

    if (req.userRole === "PATIENT") {
      where.userId = req.userId;
    }

    if (req.userRole === "PROVIDER") {
      const provider = await prisma.provider.findUnique({
        where: { userId: req.userId }
      });

      if (!provider) {
        return res.status(404).json({ error: "Provider profile not found" });
      }

      where.providerId = provider.id;
    }

    if (req.userRole === "ADMIN" && req.query.providerId) {
      where.providerId = Number(req.query.providerId);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { date: "asc" },
      include: { provider: true, user: true, slot: true },
    });

    return res.json({
      appointments: appointments.map((a: any) =>
        toAppointmentDTO(a, req.userRole)   // <-- FIXED HERE
      ),
    });

  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to fetch appointments",
      details: String(err),
    });
  }
};

/* -------------------------------------------------------
 * DELETE APPOINTMENT
 * ----------------------------------------------------- */
export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const appt = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appt || appt.userId !== req.userId) {
      return res.status(404).json({
        error: 'Appointment not found or not owned by user',
      });
    }

    // Lock window (currently disabled via isInsideLockWindow)
    if (req.userRole === 'PATIENT' && isInsideLockWindow(appt.date)) {
      return res.status(400).json({
        error:
          'Too close to start time to cancel online. Contact provider directly.',
      });
    }

    await prisma.appointment.delete({ where: { id } });

    if (appt.providerId) {
      await enqueueCalendarSync({ providerId: appt.providerId });
    }

    return res.json({ message: 'Appointment deleted' });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to delete appointment',
      details: String(err),
    });
  }
};

/* -------------------------------------------------------
 * CONFIRM APPOINTMENT
 * ----------------------------------------------------- */
export async function confirmAppointment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const userId = req.userId!;

    // 1️⃣ Perform status transition (side-effects + reminders)
    await AppointmentService.confirm(id, userId);

    // 2️⃣ Re-fetch with required relations for DTO
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        provider: true,
        user: true,
        slot: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found after confirm' });
    }

    return res.json(toAppointmentDTO(appointment, req.userRole));
  } catch (err: any) {
    return res.status(err.status || 500).json({
      message: err.message ?? 'Failed to confirm appointment',
    });
  }
}

/* -------------------------------------------------------
 * CANCEL APPOINTMENT
 * ----------------------------------------------------- */
export async function cancelAppointment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const userId = req.userId!;

    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Lock window (currently disabled)
    if (
      req.userRole === 'PATIENT' &&
      appt.userId === userId &&
      isInsideLockWindow(appt.date)
    ) {
      return res.status(400).json({
        message:
          'Too close to start time to cancel online. Contact provider directly.',
      });
    }

    const result = await AppointmentService.cancel(id, userId);

    return res.json({
      success: true,
      appointment: toAppointmentDTO(result, req.userRole),
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      message: err.message ?? 'Failed to cancel appointment',
    });
  }
}

/* -------------------------------------------------------
 * RESCHEDULE APPOINTMENT (Controller)
 * ----------------------------------------------------- */
export const rescheduleAppointment = async (req: Request, res: Response) => {
  try {
    const appointmentId = Number(req.params.id);
    const newSlotId = Number(req.body.newSlotId);
    const userId = req.userId!;

    if (!appointmentId || !newSlotId) {
      return res.status(400).json({ message: "Appointment ID and newSlotId are required" });
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, userId: true, date: true, status: true },
    });

    if (!appt)
      return res.status(404).json({ message: "Appointment not found" });

    // Lock window (disabled)
    if (req.userRole === "PATIENT" && appt.userId === userId && isInsideLockWindow(appt.date)) {
      return res.status(400).json({
        message: "Too close to start time to reschedule online. Contact provider directly.",
      });
    }

    // Delegate to service — booking limits DO NOT APPLY here
    const updated = await AppointmentService.reschedule(appointmentId, newSlotId, userId);

    return res.json({
      success: true,
      appointment: toAppointmentDTO(updated, req.userRole),
    });

  } catch (err: any) {
    return res.status(err.status || 500).json({
      message: err.message ?? "Failed to reschedule appointment",
    });
  }
};

/* -------------------------------------------------------
 * UPDATE APPOINTMENT STATUS
 * ----------------------------------------------------- */
export const updateAppointmentStatus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const userRole = req.userRole!;
  const userId = req.userId!;

  if (!['ADMIN', 'PROVIDER'].includes(userRole)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  try {
    const updated = await AppointmentService.setStatus(id, status, userId);

    return res.json({
      success: true,
      appointment: toAppointmentDTO(updated, req.userRole),
    });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

/* -------------------------------------------------------
 * AUDIT LOGS
 * ----------------------------------------------------- */
export const getAppointmentAuditLog = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const role = req.userRole;
    const userId = req.userId;

    if (!id) {
      return res.status(400).json({ message: 'Appointment ID is required' });
    }

    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (role === 'PATIENT') {
      return res.status(403).json({ message: 'Not allowed' });
    }

    if (role === 'PROVIDER') {
      const provider = await prisma.provider.findUnique({
        where: { userId: userId! },
      });

      if (!provider || provider.id !== appt.providerId) {
        return res.status(403).json({ message: 'Not allowed' });
      }
    }

    const logs = await prisma.appointmentAuditLog.findMany({
      where: { appointmentId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return res.json({ logs });
  } catch (err: any) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

