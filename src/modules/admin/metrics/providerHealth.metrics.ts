// src/modules/admin/metrics/providerHealth.metrics.ts
import prisma from '@common/utils/prismaClient.js';
import type { TimeRange } from '../utils/timeRanges.js';
import { calculateProviderHealthScore } from '../utils/healthScores.js';

export type ProviderHealthEntry = {
  providerId: number;
  displayName: string;
  score: number;
};

export type ProviderHealthMetrics = {
  providers: ProviderHealthEntry[];
  avgHealthScore: number;
};

// Detect overlapping time intervals
const hasTimeConflicts = (times: Array<{ start: Date; end: Date }>) => {
  if (times.length < 2) return false;

  const sorted = [...times].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.end > next.start) {
      return true;
    }
  }

  return false;
};

export const getProviderHealthForRange = async (
  range: TimeRange,
): Promise<ProviderHealthMetrics> => {
  const providers = await prisma.provider.findMany({
    select: {
      id: true,
      displayName: true,
      googleAccessToken: true,
    },
  });

  const providerEntries: ProviderHealthEntry[] = [];

  for (const provider of providers) {
    const [appointments, slots, schedules] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          providerId: provider.id,
          date: { gte: range.from, lte: range.to },
        },
        select: {
          date: true,
          duration: true,
          status: true,
        },
      }),

      prisma.appointmentSlot.findMany({
        where: {
          providerId: provider.id,
          start: { gte: range.from, lte: range.to },
        },
        select: {
          start: true,
          end: true,
        },
      }),

      prisma.availabilitySchedule.findMany({
        where: { providerId: provider.id },
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
      }),
    ]);

    // Convert schedules into Date windows
    const scheduleWindows = schedules.map((s: any) => {
      const today = new Date();
      const weekdayOffset = (s.dayOfWeek - today.getUTCDay() + 7) % 7;

      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() + weekdayOffset);

      const [sh, sm] = s.startTime.split(":").map(Number);
      start.setUTCHours(sh, sm, 0, 0);

      const end = new Date(start);
      const [eh, em] = s.endTime.split(":").map(Number);
      end.setUTCHours(eh, em, 0, 0);

      return { start, end };
    });

    // Appointment windows
    const appointmentWindows = appointments.map((a: any) => ({
      start: new Date(a.date),
      end: new Date(new Date(a.date).getTime() + (a.duration ?? 30) * 60000),
    }));

    // Slot windows
    const slotWindows = slots.map((s: any) => ({
      start: new Date(s.start),
      end: new Date(s.end),
    }));

    // Conflict detection
    const slotConflicts = hasTimeConflicts(slotWindows);
    const scheduleConflicts = hasTimeConflicts(scheduleWindows);
    const appointmentConflicts = hasTimeConflicts(appointmentWindows);

    const hasConflicts = slotConflicts || scheduleConflicts || appointmentConflicts;

    const bookings = appointments.length;
    const cancellations = appointments.filter((a: any) => a.status === "CANCELLED").length;

    const score = calculateProviderHealthScore({
      hasSlots: slots.length > 0,
      hasConflicts,
      googleSynced: !!provider.googleAccessToken,
      bookingsCount: bookings,
      cancellationsCount: cancellations,
      hasProfile: !!provider.displayName,
    });

    providerEntries.push({
      providerId: provider.id,
      displayName: provider.displayName,
      score,
    });
  }

  const avg =
    providerEntries.length > 0
      ? providerEntries.reduce((sum, p) => sum + p.score, 0) / providerEntries.length
      : 0;

  return {
    providers: providerEntries,
    avgHealthScore: Math.round(avg),
  };
};
