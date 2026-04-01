// src/modules/admin/metrics/provider.metrics.ts
import prisma from '@common/utils/prismaClient.js';
import type { TimeRange } from '../utils/timeRanges.js';

export type ProviderMetrics = {
  totalProviders: number;
  providersWithBookings: number;
  providersWithoutBookings: number;
};

export const getProviderMetricsForRange = async (
  range: TimeRange,
): Promise<ProviderMetrics> => {
  const [totalProviders, providersWithBookingsDistinct] = await Promise.all([
    prisma.provider.count(),
    prisma.appointment.findMany({
      where: {
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        providerId: true,
      },
      distinct: ['providerId'],
    }),
  ]);

  return {
    totalProviders,
    providersWithBookings: providersWithBookingsDistinct.length,
    providersWithoutBookings:
      totalProviders - providersWithBookingsDistinct.length,
  };
};
