// src/modules/providers/provider.controller.ts

import { Request, Response } from "express";
import prisma from "../../common/utils/prismaClient.js";
import { enqueueCalendarSync } from "../../common/queues/calendarSyncQueue.js";
import type { Role } from "../../common/types/express.d.ts";

import { searchProvidersQuerySchema } from "./provider.search.schema.js";
import { searchProviders as searchProvidersService } from "../search/search.service.js";

/* -------------------------------------------------------
 * SEARCH PROVIDERS (Public) — Phase 4 Canonical
 * ----------------------------------------------------- */
export const searchProviders = async (req: Request, res: Response) => {
  try {
    const query = searchProvidersQuerySchema.parse(req.query);
    const result = await searchProvidersService(query);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
};

/* -------------------------------------------------------
 * GET MY PROVIDER PROFILE
 * ----------------------------------------------------- */
export const getMyProvider = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let provider = await prisma.provider.findUnique({
    where: { userId: req.userId },
    include: { user: true, appointmentSlots: true },
  });

  if (!provider) {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    if (user?.role === "PROVIDER") {
      provider = await prisma.provider.create({
        data: {
          userId: req.userId,
          displayName: user.name,
          specialty: "General",
          bio: "",
          photoUrl: "",
          status: "PENDING",
        },
        include: { user: true, appointmentSlots: true },
      });
    } else {
      return res.status(404).json({ error: "Provider not found" });
    }
  }

  return res.json({ provider });
};

/* -------------------------------------------------------
 * GET PROVIDER BY ID
 * ----------------------------------------------------- */
export const getProvider = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid provider ID" });
  }

  const provider = await prisma.provider.findUnique({
    where: { id },
    include: { appointmentSlots: true },
  });

  if (!provider) {
    return res.status(404).json({ error: "Provider not found" });
  }

  return res.json({ provider });
};

/* -------------------------------------------------------
 * CREATE PROVIDER PROFILE
 * ----------------------------------------------------- */
export const createProvider = async (req: Request, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const userRole: Role = req.userRole || "PATIENT";

  if (userRole !== "PROVIDER" && userRole !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const provider = await prisma.provider.create({
    data: {
      userId: req.userId,
      displayName: req.body.displayName,
      specialty: req.body.specialty ?? "General",
      bio: req.body.bio ?? "",
      status: "PENDING",
    },
  });

  await enqueueCalendarSync({ providerId: provider.id });

  return res.status(201).json({ provider });
};

/* -------------------------------------------------------
 * UPDATE MY PROVIDER PROFILE
 * ----------------------------------------------------- */
export const updateMyProfile = async (req: Request, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const provider = await prisma.provider.findUnique({
    where: { userId: req.userId },
  });

  if (!provider) {
    return res.status(404).json({ error: "Provider not found" });
  }

  const updated = await prisma.provider.update({
    where: { id: provider.id },
    data: {
      displayName: req.body.displayName,
      specialty: req.body.specialty,
      bio: req.body.bio,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    },
  });

  await enqueueCalendarSync({ providerId: updated.id });

  return res.json({ provider: updated });
};

/* -------------------------------------------------------
 * DELETE PROVIDER PROFILE
 * ----------------------------------------------------- */
export const deleteProvider = async (req: Request, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  await prisma.provider.delete({
    where: { userId: req.userId },
  });

  return res.json({ message: "Provider deleted" });
};

/* -------------------------------------------------------
 * ADMIN — SET PROVIDER STATUS
 * ----------------------------------------------------- */
export const setProviderStatus = async (req: Request, res: Response) => {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ error: "Admin only" });
  }

  const { providerId, status } = req.body;

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: {
      status,
      verifiedAt: status === "VERIFIED" ? new Date() : null,
      verifiedByAdmin: req.userId!,
    },
  });

  return res.json({ provider: updated });
};
