// src/modules/admin/metrics/patient.metrics.ts
import prisma from '@common/utils/prismaClient.js';
import type { TimeRange } from '../utils/timeRanges.js';

export type PatientMetrics = {
  totalPatients: number;
  patientsWithBookings: number;
  newPatientsInRange: number;
};

export const getPatientMetricsForRange = async (
  range: TimeRange,
): Promise<PatientMetrics> => {
  const [totalPatients, patientsWithBookingsDistinct, newPatientsInRange] = await Promise.all([
    prisma.user.count({ where: { role: "PATIENT" } }),

    prisma.appointment.findMany({
      where: {
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    }),

    prisma.user.count({
      where: {
        role: "PATIENT",
        createdAt: {
          gte: range.from,
          lte: range.to,
        },
      },
    }),
  ]);

  return {
    totalPatients,
    patientsWithBookings: patientsWithBookingsDistinct.length,
    newPatientsInRange,
  };
};
