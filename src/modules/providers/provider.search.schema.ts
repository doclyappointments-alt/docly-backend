// src/modules/providers/provider.search.schema.ts
import { z } from "zod";

export const searchProvidersQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    specialty: z.string().trim().optional(),

    procedureId: z.coerce.number().int().positive().optional(),
    insuranceId: z.coerce.number().int().positive().optional(),

    // Availability window
    dateFrom: z.string().trim().optional(),
    dateTo: z.string().trim().optional(),

    hasAvailability: z
      .enum(["true", "false"])
      .optional()
      .transform((val) => (val ? val === "true" : undefined)),

    // Geo
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().optional(),

    // Sorting
    sort: z.enum(["rating", "recent", "distance"]).optional(),

    // Pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export type SearchProvidersQuery = z.infer<typeof searchProvidersQuerySchema>;
