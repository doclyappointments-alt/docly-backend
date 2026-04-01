// src/modules/slots/slot.bulk.service.ts

import prisma from "@common/utils/prismaClient.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { isSlotBlockedByExceptions } from "./availabilityException.util.js";

dayjs.extend(utc);
dayjs.extend(timezone);

interface BulkSlotInput {
  providerId: number;
  days: string[];
  startTime: string;
  endTime: string;
  breaks: { start: string; end: string }[];
  slotDurationMinutes: number;
  weeks: number;
}

const WEEKDAY_MAP: Record<string, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 0,
};

const TZ = "Europe/London";

export async function bulkGenerateSlots(input: BulkSlotInput) {
  const {
    providerId,
    days,
    startTime,
    endTime,
    breaks,
    slotDurationMinutes,
    weeks,
  } = input;

  const createdSlots = [];
  let requestedCount = 0;

  const now = dayjs().tz(TZ);

  for (let week = 0; week < weeks; week++) {
    for (const day of days) {
      const targetDow = WEEKDAY_MAP[day];
      if (targetDow === undefined) continue;

      const date = now
        .startOf("week")
        .add(week, "week")
        .day(targetDow);

      const dayStart = date.startOf("day").toDate();

      const exceptions = await prisma.availabilityException.findMany({
        where: {
          providerId,
          date: dayStart,
        },
      });

      let slotStart = dayjs.tz(
        `${date.format("YYYY-MM-DD")} ${startTime}`,
        TZ,
      );

      const slotEndBoundary = dayjs.tz(
        `${date.format("YYYY-MM-DD")} ${endTime}`,
        TZ,
      );

      while (
        slotStart
          .add(slotDurationMinutes, "minutes")
          .isBefore(slotEndBoundary)
      ) {
        const slotEnd = slotStart.add(slotDurationMinutes, "minutes");
        requestedCount++;

        /* -----------------------------------------
         * Break window exclusion
         * --------------------------------------- */
        const inBreak = breaks.some(({ start, end }) => {
          const breakStart = dayjs.tz(
            `${date.format("YYYY-MM-DD")} ${start}`,
            TZ,
          );
          const breakEnd = dayjs.tz(
            `${date.format("YYYY-MM-DD")} ${end}`,
            TZ,
          );

          return slotStart.isBefore(breakEnd) && slotEnd.isAfter(breakStart);
        });

        if (inBreak) {
          slotStart = slotEnd;
          continue;
        }

        /* -----------------------------------------
         * Availability exceptions
         * --------------------------------------- */
        if (
          isSlotBlockedByExceptions(
            slotStart.toDate(),
            slotEnd.toDate(),
            exceptions,
          )
        ) {
          slotStart = slotEnd;
          continue;
        }

        /* -----------------------------------------
         * Overlap protection
         * --------------------------------------- */
        const overlapping = await prisma.appointmentSlot.findFirst({
          where: {
            providerId,
            start: { lt: slotEnd.toISOString() },
            end: { gt: slotStart.toISOString() },
          },
        });

        if (!overlapping) {
          const created = await prisma.appointmentSlot.create({
            data: {
              providerId,
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              title: "Bulk Generated",
            },
          });

          createdSlots.push(created);
        }

        slotStart = slotEnd;
      }
    }
  }

  return {
    requestedCount,
    createdCount: createdSlots.length,
    slots: createdSlots,
  };
}
