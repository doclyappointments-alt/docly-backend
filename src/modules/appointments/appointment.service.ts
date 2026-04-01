// src/modules/appointments/appointment.service.ts

import prisma from "@common/utils/prismaClient.js";
import { enqueueAppointmentReminders } from "@common/queues/reminderQueue.js";
import { logger } from "@common/utils/logger.js";

const log = logger.child({ service: "appointments" });

type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

function isConfirmed(status: string): status is "CONFIRMED" {
  return status === "CONFIRMED";
}

/**
 * IMPORTANT ASSUMPTION:
 * - Your Appointment model has:
 *   - date: Date (start time)
 *   - status: AppointmentStatus
 *   - reminder24Sent: boolean
 *   - reminder1hSent: boolean
 * If your field names differ, tell me and I’ll align them.
 */

export async function createAppointment(data: {
  userId: number;
  providerId: number;
  slotId: number;
  title: string;
  date: Date;
  notes?: string;
  location?: string;
  duration?: number;
  status?: AppointmentStatus;
}) {
  // ---------- ✅ BOOKING WINDOW ENFORCEMENT ----------
  const now = new Date();

  const MIN_BOOKING_MINUTES = 60;
  const MAX_BOOKING_DAYS = 90;

  const diffMinutes = (data.date.getTime() - now.getTime()) / 60000;

  if (diffMinutes < MIN_BOOKING_MINUTES) {
    throw new Error("Appointments must be booked at least 60 mins in advance");
  }

  if (diffMinutes > MAX_BOOKING_DAYS * 24 * 60) {
    throw new Error("Appointments cannot be booked more than 90 days in advance");
  }
  // ---------------------------------------------------

  // Default to PENDING unless explicitly set
  const status = data.status ?? "PENDING";

  const appointment = await prisma.appointment.create({
    data: {
      userId: data.userId,
      providerId: data.providerId,
      slotId: data.slotId,
      title: data.title,
      date: data.date,
      notes: data.notes,
      location: data.location,
      duration: data.duration,
      status,

      // safe defaults
      reminder24Sent: false,
      reminder1hSent: false,
    },
  });

  // If created as CONFIRMED (rare), enqueue reminders immediately
  if (isConfirmed(appointment.status)) {
    await enqueueAppointmentReminders({
      appointmentId: appointment.id,
      appointmentDate: appointment.date,
    });
  }

  return appointment;
}

export async function listAppointmentsByUser(userId: number) {
  return prisma.appointment.findMany({
    where: { userId },
    include: { provider: true },
    orderBy: { date: "asc" },
  });
}

export async function listAppointmentsByProvider(providerId: number) {
  return prisma.appointment.findMany({
    where: { providerId },
    include: { user: true },
    orderBy: { date: "asc" },
  });
}

/**
 * Transition status with proper reminder scheduling.
 * Enqueues reminders ONLY on transition -> CONFIRMED.
 */
export async function updateAppointmentStatus(params: {
  appointmentId: number;
  status: AppointmentStatus;
}) {
  const { appointmentId, status } = params;

  return prisma.$transaction(async (tx: any) => {
    const existing = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        date: true,
      },
    });

    if (!existing) {
      throw new Error("Appointment not found");
    }

    const wasConfirmed = existing.status === "CONFIRMED";
    const willBeConfirmed = status === "CONFIRMED";

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status },
    });

    // We intentionally do NOT enqueue inside the transaction
    return {
      updated,
      wasConfirmed,
      willBeConfirmed,
      date: existing.date,
    };
  }).then(async (result: any) => {
    const { updated, wasConfirmed, willBeConfirmed, date } = result;

    if (!wasConfirmed && willBeConfirmed) {
      try {
        await enqueueAppointmentReminders({
          appointmentId: updated.id,
          appointmentDate: date,
        });

        log.info(
          { appointmentId: updated.id },
          "Appointment confirmed → reminders enqueued",
        );
      } catch (err) {
        log.error(
          { err, appointmentId: updated.id },
          "Failed to enqueue reminders — appointment still confirmed",
        );
      }
    }

    return updated;
  });
}

/**
 * Reschedule an appointment (changes date).
 * If appointment is CONFIRMED, we reset reminder flags and enqueue new reminders.
 */
export async function rescheduleAppointment(params: {
  appointmentId: number;
  newDate: Date;
}) {
  const { appointmentId, newDate } = params;

  return prisma.$transaction(async (tx: any) => {
    const existing = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      throw new Error("Appointment not found");
    }

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        date: newDate,

        // If it's confirmed, reset reminder sent flags
        ...(existing.status === "CONFIRMED"
          ? {
              reminder24Sent: false,
              reminder1hSent: false,
            }
          : {}),
      },
    });

    return {
      updated,
      wasConfirmed: existing.status === "CONFIRMED",
    };
  }).then(async (result: any) => {
    const { updated, wasConfirmed } = result;

    if (wasConfirmed) {
      await enqueueAppointmentReminders({
        appointmentId: updated.id,
        appointmentDate: updated.date,
      });

      log.info(
        {
          appointmentId: updated.id,
          newDate: updated.date.toISOString(),
        },
        "Appointment rescheduled (confirmed) → reminders re-enqueued",
      );
    }

    return updated;
  });
}

export async function cancelAppointment(appointmentId: number) {
  return prisma.$transaction(async (tx: any) => {
    const appt = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, slotId: true },
    });

    if (!appt) {
      throw new Error("Appointment not found");
    }

    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    if (appt.slotId) {
      await tx.appointmentSlot.update({
        where: { id: appt.slotId },
        data: { booked: false },
      });
    }

    return tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { provider: true, user: true, slot: true },
    });
  });
}

export async function deleteAppointment(appointmentId: number) {
  return prisma.appointment.delete({
    where: { id: appointmentId },
  });
}

// =======================================================
// CONTROLLER-COMPATIBILITY EXPORTS
// Controllers still call these legacy names
// =======================================================

export async function confirm(
  appointmentId: number,
  _userId: number,
) {
  const updated = await updateAppointmentStatus({
    appointmentId,
    status: "CONFIRMED",
  });

  const fullAppointment = await prisma.appointment.findUnique({
    where: { id: updated.id },
    include: {
      provider: true,
      user: true,
      slot: true,
    },
  });

  if (!fullAppointment) {
    throw new Error("Appointment not found after confirmation");
  }

  return fullAppointment;
}

// ✅ FIX — ownership enforcement + 403-style error
export async function cancel(
  appointmentId: number,
  userId: number,
) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { userId: true },
  });

  if (!appt) {
    throw new Error("Appointment not found");
  }

  if (appt.userId !== userId) {
    throw new Error("FORBIDDEN");
  }

  return cancelAppointment(appointmentId);
}

export async function reschedule(
  appointmentId: number,
  newSlotId: number,
  _userId: number,
) {
  const slot = await prisma.appointmentSlot.findUnique({
    where: { id: newSlotId },
  });

  if (!slot) {
    throw new Error("Slot not found");
  }

  // ✅ FIX — coded error instead of generic throw
  if ((slot as any).booked) {
    const err = new Error("Slot already booked");
    (err as any).code = "SLOT_BOOKED";
    throw err;
  }

  const updated = await rescheduleAppointment({
    appointmentId,
    newDate: slot.start,
  });

  const fullAppointment = await prisma.appointment.findUnique({
    where: { id: updated.id },
    include: {
      provider: true,
      user: true,
      slot: true,
    },
  });

  if (!fullAppointment) {
    throw new Error("Appointment not found after reschedule");
  }

  return fullAppointment;
}

export async function setStatus(
  appointmentId: number,
  status: AppointmentStatus,
  _userId: number,
) {
  const updated = await updateAppointmentStatus({
    appointmentId,
    status,
  });

  const fullAppointment = await prisma.appointment.findUnique({
    where: { id: updated.id },
    include: {
      provider: true,
      user: true,
      slot: true,
    },
  });

  if (!fullAppointment) {
    throw new Error("Appointment not found after status update");
  }

  return fullAppointment;
}
