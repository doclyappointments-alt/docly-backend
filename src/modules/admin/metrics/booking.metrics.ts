// src/modules/admin/metrics/booking.metrics.ts
import prisma from '@common/utils/prismaClient.js';
import type { TimeRange } from '../utils/timeRanges.js';

export type BookingStatusCounts = Record<string, number>;

export type BookingMetrics = {
  total: number;
  byStatus: BookingStatusCounts;
  byDay?: Array<{ date: string; count: number }>;
};

export const getBookingMetricsForRange = async (range: TimeRange): Promise<BookingMetrics> => {
  const where = {
    createdAt: {
      gte: range.from,
      lte: range.to,
    },
  };

  const [total, grouped] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({
      by: ['status'],
      _count: { _all: true },
      where,
    }),
  ]);

  const byStatus: BookingStatusCounts = {};
  for (const row of grouped) {
    byStatus[row.status] = row._count._all;
  }

  return {
    total,
    byStatus,
  };
};
