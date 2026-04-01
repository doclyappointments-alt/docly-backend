// src/modules/admin/metrics/heatmap.metrics.ts
import prisma from '@common/utils/prismaClient.js';
import type { TimeRange } from '../utils/timeRanges.js';

export type HeatmapMatrix = number[][];

export type HeatmapMetrics = {
  byWeekdayHour: HeatmapMatrix;
};

const createEmptyMatrix = (): HeatmapMatrix =>
  Array.from({ length: 7 }, () => Array(24).fill(0));

export const getHeatmapForRange = async (range: TimeRange): Promise<HeatmapMetrics> => {
  const appointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: range.from,
        lte: range.to,
      },
    },
    select: {
      date: true,
    },
  });

  const matrix = createEmptyMatrix();

  for (const appt of appointments) {
    const d = new Date(appt.date);
    const weekday = d.getUTCDay();
    const hour = d.getUTCHours();
    matrix[weekday][hour] += 1;
  }

  return { byWeekdayHour: matrix };
};
