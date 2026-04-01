// src/modules/admin/metrics/conversion.metrics.ts
import prisma from '@common/utils/prismaClient.js';
import type { TimeRange } from '../utils/timeRanges.js';

export type ConversionMetrics = {
  overallConversionRate: number;
  steps?: {
    bookingsCompleted?: number;
    paymentsSucceeded?: number;
  };
};

export const getConversionMetricsForRange = async (
  range: TimeRange,
): Promise<ConversionMetrics> => {
  const [bookingsInRange, successfulPayments] = await Promise.all([
    prisma.appointment.count({
      where: {
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
    }),
    prisma.appointmentPayment.count({
      where: {
        status: "SUCCEEDED",
        createdAt: {
          gte: range.from,
          lte: range.to,
        },
      },
    }),
  ]);

  const overallConversionRate =
    bookingsInRange > 0 ? successfulPayments / bookingsInRange : 0;

  return {
    overallConversionRate,
    steps: {
      bookingsCompleted: bookingsInRange,
      paymentsSucceeded: successfulPayments,
    },
  };
};
