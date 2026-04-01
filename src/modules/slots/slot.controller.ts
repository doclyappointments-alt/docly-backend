// src/modules/slots/slot.controller.ts

import { Request, Response } from "express";
import prisma from "@common/utils/prismaClient.js";

import {
  createSlotForProvider,
  updateSlotForProvider,
} from "./slot.service.js";

import { bulkGenerateSlots } from "./slot.bulk.service.js";

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */

async function getProviderForUser(userId: number | undefined) {
  if (!userId) return null;

  return prisma.provider.findUnique({
    where: { userId },
  });
}

/* -------------------------------------------------------
 * CREATE SLOT
 * ----------------------------------------------------- */

export async function createSlot(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const provider = await getProviderForUser(req.userId);
    if (!provider) {
      return res.status(404).json({ error: "Provider profile not found" });
    }

    const { start, end, duration, title } = req.body;

    if (!start) {
      return res.status(400).json({ error: "start is required" });
    }

    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "Invalid start datetime" });
    }

    let endDate: Date;

    if (end !== undefined) {
      endDate = new Date(end);
    } else if (duration !== undefined) {
      const minutes = Number(duration);

      if (!Number.isFinite(minutes) || minutes <= 0) {
        return res.status(400).json({
          error: "duration must be a positive number (minutes)",
        });
      }

      endDate = new Date(startDate.getTime() + minutes * 60_000);
    } else {
      return res.status(400).json({
        error: "Either end or duration is required",
      });
    }

    if (Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid end datetime" });
    }

    const slot = await createSlotForProvider({
      providerId: provider.id,
      start: startDate,
      end: endDate,
      title: title ?? "Slot",
    });

    return res.status(201).json({ slot });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      message: err.message || "Failed to create slot",
    });
  }
}

/* -------------------------------------------------------
 * LIST SLOTS
 * ----------------------------------------------------- */

export async function listSlots(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const provider = await getProviderForUser(req.userId);
    if (!provider) {
      return res.status(404).json({ error: "Provider profile not found" });
    }

    const slots = await prisma.appointmentSlot.findMany({
      where: { providerId: provider.id },
      orderBy: { start: "asc" },
    });

    return res.json({ slots });
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to list slots",
      details: String(err),
    });
  }
}

/* -------------------------------------------------------
 * UPDATE SLOT
 * ----------------------------------------------------- */

export async function updateSlot(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const provider = await getProviderForUser(req.userId);
    if (!provider) {
      return res.status(404).json({ error: "Provider profile not found" });
    }

    const slotId = Number(req.params.id);
    if (!slotId) {
      return res.status(400).json({ error: "Slot ID is required" });
    }

    const { start, end, title } = req.body;

    const updated = await updateSlotForProvider({
      providerId: provider.id,
      slotId,
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      title,
    });

    return res.json({ slot: updated });
  } catch (err: any) {
    return res.status(err.status || 500).json({
      error: err.message,
    });
  }
}

/* -------------------------------------------------------
 * DELETE SLOT
 * ----------------------------------------------------- */

export async function deleteSlot(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const provider = await getProviderForUser(req.userId);
    if (!provider) {
      return res.status(404).json({ error: "Provider profile not found" });
    }

    const slotId = Number(req.params.id);
    if (!slotId) {
      return res.status(400).json({ error: "Slot ID is required" });
    }

    const slot = await prisma.appointmentSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot || slot.providerId !== provider.id) {
      return res.status(404).json({
        error: "Slot not found or not owned by provider",
      });
    }

    if (slot.booked) {
      return res.status(400).json({
        error: "Cannot delete a booked slot",
      });
    }

    await prisma.appointmentSlot.delete({
      where: { id: slotId },
    });

    return res.json({ message: "Slot deleted" });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
    });
  }
}

/* -------------------------------------------------------
 * BULK CREATE SLOTS
 * ----------------------------------------------------- */

export async function bulkCreateSlots(req: Request, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const provider = await getProviderForUser(req.userId);
    if (!provider) {
      return res.status(404).json({ message: "Provider profile not found" });
    }

    const payload = req.body;

    const result = await bulkGenerateSlots({
      providerId: provider.id,
      ...payload,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({
      message: "Failed to generate bulk slots",
      details: String(err),
    });
  }
}
