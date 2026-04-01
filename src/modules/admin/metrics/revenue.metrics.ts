// src/modules/admin/metrics/revenue.metrics.ts
import prisma from '@common/utils/prismaClient.js';
import type { TimeRange } from '../utils/timeRanges.js';

export type RevenueMetrics = {
  totalRevenue: number;
  paidAppointments: number;
};

export const getRevenueMetricsForRange = async (
  range: TimeRange,
): Promise<RevenueMetrics> => {
  const payments = await prisma.appointmentPayment.findMany({
    where: {
      status: "SUCCEEDED",
      createdAt: {
        gte: range.from,
        lte: range.to,
      },
    },
    select: {
      amount: true,
    },
  });

  const totalRevenue = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

  return {
    totalRevenue,
    paidAppointments: payments.length,
  };
};
