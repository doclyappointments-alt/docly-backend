// src/modules/slots/slot.service.ts

import prisma from "@common/utils/prismaClient.js";
import { AppointmentSlot } from "@prisma/client";

import { isSlotBlockedByExceptions } from "./availabilityException.util.js";

/* -------------------------------------------------------
 * Error helpers
 * ----------------------------------------------------- */

function badRequest(msg: string) {
  const err: any = new Error(msg);
  err.status = 400;
  return err;
}

function conflict(msg: string) {
  const err: any = new Error(msg);
  err.status = 409;
  return err;
}

/* -------------------------------------------------------
 * Utils
 * ----------------------------------------------------- */

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function validateSlotWindow(start: Date, end: Date) {
  const startMs = start.getTime();
  const endMs = end.getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw badRequest("Invalid start or end datetime");
  }

  if (endMs - startMs <= 0) {
    throw badRequest("Slot end must be after start");
  }
}

/* -------------------------------------------------------
 * Conflict detection
 * ----------------------------------------------------- */

export async function hasSlotConflict(
  providerId: number,
  start: Date,
  end: Date,
  excludeSlotId?: number,
): Promise<boolean> {
  const conflictSlot = await prisma.appointmentSlot.findFirst({
    where: {
      providerId,
      id: excludeSlotId ? { not: excludeSlotId } : undefined,
      start: { lt: end },
      end: { gt: start },
    },
  });

  return !!conflictSlot;
}

/* -------------------------------------------------------
 * Create single slot
 * ----------------------------------------------------- */

export async function createSlotForProvider(params: {
  providerId: number;
  start: Date;
  end: Date;
  title?: string;
}): Promise<AppointmentSlot> {
  const { providerId, start, end, title } = params;

  validateSlotWindow(start, end);

  const dayStart = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );

  const exceptions = await prisma.availabilityException.findMany({
    where: {
      providerId,
      date: dayStart,
    },
  });

  if (isSlotBlockedByExceptions(start, end, exceptions)) {
    throw badRequest("Slot blocked by availability exception");
  }

  if (await hasSlotConflict(providerId, start, end)) {
    throw conflict("Slot conflicts with an existing slot");
  }

  return prisma.appointmentSlot.create({
    data: {
      providerId,
      start,
      end,
      title: title ?? "Slot",
      booked: false,
    },
  });
}

/* -------------------------------------------------------
 * Bulk create slots (safe, filtered)
 * ----------------------------------------------------- */

export async function createManySlotsIfNoConflicts(params: {
  providerId: number;
  slots: { start: Date; end: Date; title?: string }[];
}): Promise<{ createdCount: number; requestedCount: number }> {
  const { providerId, slots } = params;

  if (!slots.length) {
    return { createdCount: 0, requestedCount: 0 };
  }

  // Validate all windows
  for (const s of slots) {
    validateSlotWindow(s.start, s.end);
  }

  const requestedCount = slots.length;

  // Determine bounding range
  let minStart = slots[0].start;
  let maxEnd = slots[0].end;

  for (const s of slots) {
    if (s.start < minStart) minStart = s.start;
    if (s.end > maxEnd) maxEnd = s.end;
  }

  // Load existing slots once
  const existingSlots = await prisma.appointmentSlot.findMany({
    where: {
      providerId,
      start: { lt: maxEnd },
      end: { gt: minStart },
    },
  });

  // Cache exceptions per-day
  const exceptionCache = new Map<string, any[]>();
  const accepted: typeof slots = [];

  for (const s of slots) {
    const key = s.start.toISOString().slice(0, 10);

    if (!exceptionCache.has(key)) {
      const dayStart = new Date(
        Date.UTC(
          s.start.getUTCFullYear(),
          s.start.getUTCMonth(),
          s.start.getUTCDate(),
        ),
      );

      const ex = await prisma.availabilityException.findMany({
        where: {
          providerId,
          date: dayStart,
        },
      });

      exceptionCache.set(key, ex);
    }

    // Availability exceptions
    if (
      isSlotBlockedByExceptions(
        s.start,
        s.end,
        exceptionCache.get(key)!,
      )
    ) {
      continue;
    }

    // Overlaps with DB slots or accepted batch
    if (
      existingSlots.some((es: any) =>
        overlaps(s.start, s.end, es.start, es.end),
      ) ||
      accepted.some((es: any) =>
        overlaps(s.start, s.end, es.start, es.end),
      )
    ) {
      continue;
    }

    accepted.push(s);
  }

  if (!accepted.length) {
    return { createdCount: 0, requestedCount };
  }

  const result = await prisma.appointmentSlot.createMany({
    data: accepted.map((s: any) => ({
      providerId,
      start: s.start,
      end: s.end,
      title: s.title ?? "Slot",
      booked: false,
    })),
    skipDuplicates: true,
  });

  return {
    createdCount: result.count,
    requestedCount,
  };
}

/* -------------------------------------------------------
 * Update slot
 * ----------------------------------------------------- */

export async function updateSlotForProvider(params: {
  providerId: number;
  slotId: number;
  start?: Date;
  end?: Date;
  title?: string;
}) {
  const { providerId, slotId, start, end, title } = params;

  const slot = await prisma.appointmentSlot.findUnique({
    where: { id: slotId },
  });

  if (!slot || slot.providerId !== providerId) {
    throw conflict("Slot not found or not owned by provider");
  }

  if (slot.booked) {
    throw badRequest("Cannot update a booked slot");
  }

  const newStart = start ?? slot.start;
  const newEnd = end ?? slot.end;

  validateSlotWindow(newStart, newEnd);

  if (await hasSlotConflict(providerId, newStart, newEnd, slotId)) {
    throw conflict("Slot conflicts with an existing slot");
  }

  return prisma.appointmentSlot.update({
    where: { id: slotId },
    data: {
      start: newStart,
      end: newEnd,
      title,
    },
  });
}
