// src/modules/admin/admin.service.ts

import prisma from "../../common/utils/prismaClient.js";

import { buildTimeRange, type TimeRangeQuery } from "./utils/timeRanges.js";
import { normalizeOverview } from "./utils/normalizers.js";

import { getBookingMetricsForRange } from "./metrics/booking.metrics.js";
import { getProviderMetricsForRange } from "./metrics/provider.metrics.js";
import { getPatientMetricsForRange } from "./metrics/patient.metrics.js";
import { getRevenueMetricsForRange } from "./metrics/revenue.metrics.js";
import { getHeatmapForRange } from "./metrics/heatmap.metrics.js";
import { getProviderHealthForRange } from "./metrics/providerHealth.metrics.js";
import { getConversionMetricsForRange } from "./metrics/conversion.metrics.js";

export const getOverviewMetrics = async (query: TimeRangeQuery) => {
  const range = buildTimeRange(query);

  const [
    bookings,
    providers,
    patients,
    revenue,
    heatmap,
    providerHealth,
    conversions,
  ] = await Promise.all([
    getBookingMetricsForRange(range),
    getProviderMetricsForRange(range),
    getPatientMetricsForRange(range),
    getRevenueMetricsForRange(range),
    getHeatmapForRange(range),
    getProviderHealthForRange(range),
    getConversionMetricsForRange(range),
  ]);

  return normalizeOverview({
    range,
    bookings,
    providers,
    patients,
    revenue,
    heatmap,
    providerHealth,
    conversions,
  });
};

export const getBookingMetrics = async (query: TimeRangeQuery) => {
  const range = buildTimeRange(query);
  return getBookingMetricsForRange(range);
};

export const getProviderMetrics = async (query: TimeRangeQuery) => {
  const range = buildTimeRange(query);
  return getProviderMetricsForRange(range);
};

export const getHeatmapMetrics = async (query: TimeRangeQuery) => {
  const range = buildTimeRange(query);
  return getHeatmapForRange(range);
};

export const getProviderHealthMetrics = async (query: TimeRangeQuery) => {
  const range = buildTimeRange(query);
  return getProviderHealthForRange(range);
};

export const getConversionMetrics = async (query: TimeRangeQuery) => {
  const range = buildTimeRange(query);
  return getConversionMetricsForRange(range);
};

export async function getPayments() {
  return prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true } },
      appointment: { select: { id: true, status: true } },
      auditLogs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getPaymentAudit(paymentId: number) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { id: true, email: true } },
      appointment: { select: { id: true, status: true } },
      auditLogs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
