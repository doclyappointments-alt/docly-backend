// src/modules/providerScheduleTemplates/slotGenerator.ts

import prisma from '@common/utils/prismaClient.js';
import { createManySlotsIfNoConflicts } from '../slots/slot.service.js';
import { isSlotBlockedByExceptions } from '../slots/availabilityException.util.js';

const SLOT_MINUTES = 15;

const parseTime = (t: string) => {
  const [hour, minute] = t.split(':').map(Number);
  return { hour, minute };
};

export const generateSlotsForProvider = async (
  providerId: number,
  targetWeekStartUTC: Date,
): Promise<{ createdCount: number }> => {
  const templates = await prisma.providerScheduleTemplate.findMany({
    where: { providerId },
  });

  if (!templates.length) {
    return { createdCount: 0 };
  }

  const slotsToCreate: { start: Date; end: Date }[] = [];

  for (const tpl of templates) {
    const day = new Date(
      Date.UTC(
        targetWeekStartUTC.getUTCFullYear(),
        targetWeekStartUTC.getUTCMonth(),
        targetWeekStartUTC.getUTCDate() + tpl.dayOfWeek,
        0,
        0,
        0,
        0,
      ),
    );

    const dayStart = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const exceptions = await prisma.availabilityException.findMany({
      where: {
        providerId,
        date: dayStart,
      },
    });

    const { hour: startHour, minute: startMinute } = parseTime(tpl.startTime);
    const { hour: endHour, minute: endMinute } = parseTime(tpl.endTime);

    let cursorMs = Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      startHour,
      startMinute,
      0,
      0,
    );

    const endMs = Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      endHour,
      endMinute,
      0,
      0,
    );

    while (cursorMs + SLOT_MINUTES * 60_000 <= endMs) {
      const start = new Date(cursorMs);
      const end = new Date(cursorMs + SLOT_MINUTES * 60_000);

      if (!isSlotBlockedByExceptions(start, end, exceptions)) {
        slotsToCreate.push({ start, end });
      }

      cursorMs += SLOT_MINUTES * 60_000;
    }
  }

  if (!slotsToCreate.length) {
    return { createdCount: 0 };
  }

  return createManySlotsIfNoConflicts({
    providerId,
    slots: slotsToCreate,
  });
};
