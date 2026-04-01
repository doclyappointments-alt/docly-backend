// src/modules/providers/provider.service.ts

import prisma from "@common/utils/prismaClient.js";
import * as providerModel from "./provider.model.js";
import { Prisma } from "@prisma/client";
import { SearchProvidersQuery } from "./provider.search.schema.js";

/* -------------------------------------------------------
 * INTERNAL HELPERS
 * ----------------------------------------------------- */
function ensureVerified(provider: any) {
  if (provider.status !== "VERIFIED") {
    throw new Error("Provider is not verified");
  }
}

export const providerService = {
  /* -------------------------------------------------------
   * ACCESS VALIDATION (PROVIDER-ONLY ACTIONS)
   * ----------------------------------------------------- */
  async verifyProviderAccess(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || user.role !== "PROVIDER") {
      throw new Error("Access denied: Only providers can perform this action");
    }

    if (!user.provider) {
      throw new Error("Provider profile not found for this user");
    }

    // 🔒 VERIFICATION ENFORCEMENT
    ensureVerified(user.provider);

    return user.provider;
  },

  /* -------------------------------------------------------
   * CREATE PROVIDER PROFILE
   * ----------------------------------------------------- */
  async createProviderProfile(params: {
    currentUserId: number;
    targetUserId: number;
    userRole: string;
    displayName?: string;
    specialty?: string;
    bio?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const {
      currentUserId,
      targetUserId,
      userRole,
      displayName,
      specialty,
      bio,
      latitude,
      longitude,
    } = params;

    if (userRole !== "PROVIDER" && userRole !== "ADMIN") {
      throw new Error("Only PROVIDER or ADMIN may create a provider profile");
    }

    if (userRole === "PROVIDER" && currentUserId !== targetUserId) {
      throw new Error("Providers can only create their own profile");
    }

    const existing = await providerModel.findProviderByUserId(targetUserId);
    if (existing) throw new Error("Provider profile already exists");

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) throw new Error("Target user not found");

    const provider = await providerModel.createProvider({
      userId: targetUserId,
      displayName: displayName || targetUser.name || "Unnamed Provider",
      specialty: specialty || "Unspecified",
      bio: bio || "",
      latitude,
      longitude,
      status: "PENDING", // ⛔ requires admin verification
    });

    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: "PROVIDER" },
    });

    return provider;
  },

  /* -------------------------------------------------------
   * FETCH PROVIDERS
   * ----------------------------------------------------- */
  async getProviderByUserId(userId: number) {
    const provider = await providerModel.findProviderByUserId(userId);
    if (!provider) throw new Error("Provider profile not found");
    return provider;
  },

  async getProviderById(id: number) {
    const provider = await providerModel.findProviderById(id);
    if (!provider) throw new Error("Provider not found");
    return provider;
  },

  async listProviders() {
    return providerModel.listProviders();
  },

  /* -------------------------------------------------------
   * UPDATE PROVIDER PROFILE
   * ----------------------------------------------------- */
  async updateProviderProfile(params: {
    currentUserId: number;
    userRole: string;
    providerId: number;
    data: any;
  }) {
    const { currentUserId, userRole, providerId, data } = params;

    const existing = await providerModel.findProviderById(providerId);
    if (!existing) throw new Error("Provider not found");

    if (userRole !== "ADMIN" && existing.user.id !== currentUserId) {
      throw new Error("Unauthorized");
    }

    const updateData: any = { ...data };

    if (updateData.latitude === undefined) delete updateData.latitude;
    if (updateData.longitude === undefined) delete updateData.longitude;

    return providerModel.updateProvider(providerId, updateData);
  },

  /* -------------------------------------------------------
   * DELETE PROVIDER PROFILE
   * ----------------------------------------------------- */
  async deleteProviderProfile(currentUserId: number, userRole: string) {
    const provider = await providerModel.findProviderByUserId(currentUserId);

    if (!provider) {
      return { success: false, status: 404, message: "Provider not found" };
    }

    if (userRole !== "ADMIN" && provider.userId !== currentUserId) {
      return { success: false, status: 403, message: "Unauthorized" };
    }

    await providerModel.deleteProvider(provider.id);

    return { success: true };
  },

  /* -------------------------------------------------------
   * UPDATE PROVIDER’S GOOGLE TOKENS (VERIFIED ONLY)
   * ----------------------------------------------------- */
  async updateProviderTokens(
    userId: number,
    tokens: {
      googleAccessToken?: string;
      googleRefreshToken?: string;
      tokenExpiry?: string;
    }
  ) {
    const provider = await this.verifyProviderAccess(userId);

    const updateData: any = {};

    if (tokens.googleAccessToken) {
      updateData.googleAccessToken = tokens.googleAccessToken;
    }

    if (tokens.googleRefreshToken) {
      updateData.googleRefreshToken = tokens.googleRefreshToken;
    }

    if (tokens.tokenExpiry) {
      updateData.tokenExpiry = new Date(tokens.tokenExpiry);
    }

    return providerModel.updateProvider(provider.id, updateData);
  },

  /* -------------------------------------------------------
   * PROVIDER SEARCH (PUBLIC — VERIFIED ONLY)
   * ----------------------------------------------------- */
  async searchProviders(params: SearchProvidersQuery) {
    const {
      q,
      specialty,
      procedureId,
      insuranceId,
      dateFrom,
      dateTo,
      hasAvailability,
      page,
      pageSize,
    } = params;

    const where: Prisma.ProviderWhereInput = {
      status: "VERIFIED",
    };

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

    let slotFilter: Prisma.AppointmentSlotWhereInput | undefined;

    if (dateFrom || dateTo || hasAvailability) {
      slotFilter = { booked: false };
      slotFilter.start = {};
      if (dateFrom) (slotFilter.start as any).gte = new Date(dateFrom);
      if (dateTo) (slotFilter.start as any).lte = new Date(dateTo);
    }

    if (slotFilter) {
      where.appointmentSlots = { some: slotFilter };
    }

    const pg = page ?? 1;
    const ps = pageSize ?? 10;

    const [items, total] = await prisma.$transaction([
      prisma.provider.findMany({
        where,
        skip: (pg - 1) * ps,
        take: ps,
        orderBy: [
          { ratingAverage: "desc" },
          { ratingCount: "desc" },
          { id: "asc" },
        ],
        include: {
          locations: true,
          procedures: true,
          insurancesAccepted: {
            include: { plan: { include: { insuranceProvider: true } } },
          },
          appointmentSlots: slotFilter
            ? { where: slotFilter, orderBy: { start: "asc" }, take: 3 }
            : undefined,
        },
      }),
      prisma.provider.count({ where }),
    ]);

    return {
      items,
      total,
      page: pg,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  },

  /* -------------------------------------------------------
   * ADMIN — SET PROVIDER STATUS
   * ----------------------------------------------------- */
  async setProviderStatus(params: {
    adminId: number;
    providerId: number;
    status: "VERIFIED" | "REJECTED" | "SUSPENDED";
  }) {
    const { adminId, providerId, status } = params;

    return prisma.provider.update({
      where: { id: providerId },
      data: {
        status,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
        verifiedByAdmin: adminId,
      },
    });
  },
};
