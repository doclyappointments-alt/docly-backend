// src/modules/search/search.service.ts

import prisma from "../../common/utils/prismaClient.js";
import { Prisma } from "@prisma/client";
import { haversineDistance } from "../../common/utils/geo.js";

export interface SearchProvidersParams {
  q?: string;
  specialty?: string;
  procedureId?: number;
  insuranceId?: number;
  dateFrom?: string;
  dateTo?: string;
  hasAvailability?: boolean;
  sort?: "rating" | "recent" | "distance";
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Long-term typing:
 * - Define the exact Provider payload shape returned by Prisma (with includes).
 * - If distance sorting is requested, we return an enriched view with distanceKm.
 */
type ProviderPayload = Prisma.ProviderGetPayload<{
  include: {
    locations: true;
    procedures: true;
    insurancesAccepted: {
      include: {
        plan: { include: { insuranceProvider: true } };
      };
    };
    appointmentSlots:
      | {
          where: Prisma.AppointmentSlotWhereInput;
          orderBy: { start: "asc" };
          take: 3;
        }
      | false
      | undefined;
  };
}>;

type ProviderWithDistance = ProviderPayload & { distanceKm: number };

export async function searchProviders(params: SearchProvidersParams) {
  const {
    q,
    specialty,
    procedureId,
    insuranceId,
    dateFrom,
    dateTo,
    hasAvailability,
    sort,
    lat,
    lng,
    radiusKm,
    page = 1,
    pageSize = 10,
  } = params;

  // 🔒 VERIFIED PROVIDERS ONLY
  const where: Prisma.ProviderWhereInput = {
    status: "VERIFIED",
    latitude: lat !== undefined ? { not: null } : undefined,
    longitude: lng !== undefined ? { not: null } : undefined,
  };

  /* -------------------------------------------------------
   * TEXT / METADATA FILTERS
   * ----------------------------------------------------- */
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { specialty: { contains: q, mode: "insensitive" } },
      { bio: { contains: q, mode: "insensitive" } },
      { specializations: { has: q } },
    ];
  }

  if (specialty) {
    where.specialty = { contains: specialty, mode: "insensitive" };
  }

  if (procedureId) {
    where.procedures = { some: { id: procedureId } };
  }

  if (insuranceId) {
    where.insurancesAccepted = { some: { planId: insuranceId } };
  }

  /* -------------------------------------------------------
   * AVAILABILITY FILTER
   * ----------------------------------------------------- */
  let slotFilter: Prisma.AppointmentSlotWhereInput | undefined;

  if (hasAvailability || dateFrom || dateTo) {
    slotFilter = { booked: false };

    if (dateFrom || dateTo) {
      slotFilter.start = {};
      if (dateFrom) slotFilter.start.gte = new Date(dateFrom);
      if (dateTo) slotFilter.start.lte = new Date(dateTo);
    }

    where.appointmentSlots = { some: slotFilter };
  }

  /* -------------------------------------------------------
   * DB QUERY (non-distance sorting)
   * ----------------------------------------------------- */
  let orderBy: Prisma.ProviderOrderByWithRelationInput[] = [
    { ratingAverage: "desc" },
    { ratingCount: "desc" },
    { id: "asc" },
  ];

  if (sort === "recent") {
    orderBy = [{ verifiedAt: "desc" }, { id: "asc" }];
  }

  const skip = (page - 1) * pageSize;

  const providers: ProviderPayload[] = await prisma.provider.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: sort === "distance" ? undefined : orderBy,
    include: {
      locations: true,
      procedures: true,
      insurancesAccepted: {
        include: {
          plan: { include: { insuranceProvider: true } },
        },
      },
      appointmentSlots: slotFilter
        ? {
            where: slotFilter,
            orderBy: { start: "asc" },
            take: 3,
          }
        : undefined,
    },
  });

  /* -------------------------------------------------------
   * GEO FILTER + SORT (APP-LEVEL)
   * ----------------------------------------------------- */
  let items: Array<ProviderPayload | ProviderWithDistance> = providers;

  if (lat !== undefined && lng !== undefined) {
    const enriched: ProviderWithDistance[] = providers.map((p) => ({
      ...p,
      distanceKm: haversineDistance(lat, lng, p.latitude!, p.longitude!),
    }));

    const filtered =
      radiusKm !== undefined
        ? enriched.filter((p) => p.distanceKm <= radiusKm)
        : enriched;

    items =
      sort === "distance"
        ? [...filtered].sort((a, b) => a.distanceKm - b.distanceKm)
        : filtered;
  }

  const total = items.length;

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
