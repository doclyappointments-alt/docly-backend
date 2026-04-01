// src/modules/admin/utils/normalizers.ts
import type { TimeRange } from './timeRanges.js';
import type { BookingMetrics } from '../metrics/booking.metrics.js';
import type { ProviderMetrics } from '../metrics/provider.metrics.js';
import type { PatientMetrics } from '../metrics/patient.metrics.js';
import type { RevenueMetrics } from '../metrics/revenue.metrics.js';
import type { HeatmapMetrics } from '../metrics/heatmap.metrics.js';
import type { ProviderHealthMetrics } from '../metrics/providerHealth.metrics.js';
import type { ConversionMetrics } from '../metrics/conversion.metrics.js';

type OverviewInput = {
  range: TimeRange;
  bookings: BookingMetrics;
  providers: ProviderMetrics;
  patients: PatientMetrics;
  revenue: RevenueMetrics;
  heatmap: HeatmapMetrics;
  providerHealth: ProviderHealthMetrics;
  conversions: ConversionMetrics;
};

export const normalizeOverview = (input: OverviewInput) => {
  const {
    range,
    bookings,
    providers,
    patients,
    revenue,
    heatmap,
    providerHealth,
    conversions,
  } = input;

  return {
    range,
    summary: {
      totalBookings: bookings.total,
      cancellations: bookings.byStatus.CANCELLED ?? 0,
      completed: bookings.byStatus.COMPLETED ?? 0,
      totalProviders: providers.totalProviders,
      activeProviders: providers.providersWithBookings,
      totalPatients: patients.totalPatients,
      revenue: revenue.totalRevenue,
      conversionRate: conversions.overallConversionRate,
      avgProviderHealthScore: providerHealth.avgHealthScore,
    },
    bookings,
    providers,
    patients,
    revenue,
    heatmap,
    providerHealth,
    conversions,
  };
};
