// src/modules/providerScheduleTemplates/template.controller.ts

import type { Request, Response } from 'express';
import prisma from '@common/utils/prismaClient.js';
import * as TemplateService from './template.service.js';
import { nextMondayUTC as nextMonday } from './utils/dateUtils.js';

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */

async function getProviderId(userId: number) {
  const provider = await prisma.provider.findUnique({
    where: { userId },
  });

  return provider?.id ?? null;
}

/* -------------------------------------------------------
 * Controllers
 * ----------------------------------------------------- */

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const providerId = await getProviderId(req.userId!);
    if (!providerId) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const result = await TemplateService.createTemplate(providerId, req.body);
    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const listTemplates = async (req: Request, res: Response) => {
  try {
    const providerId = await getProviderId(req.userId!);
    if (!providerId) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const result = await TemplateService.listTemplates(providerId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const providerId = await getProviderId(req.userId!);
    if (!providerId) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const templateId = Number(req.params.id);
    const result = await TemplateService.updateTemplate(
      templateId,
      req.body,
    );

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const providerId = await getProviderId(req.userId!);
    if (!providerId) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const templateId = Number(req.params.id);
    const result = await TemplateService.deleteTemplate(templateId);

    return res.json({ message: 'Deleted', result });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const generateSlots = async (req: Request, res: Response) => {
  try {
    const providerId = await getProviderId(req.userId!);
    if (!providerId) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const { weekStart } = req.body;
    const start = weekStart ? new Date(weekStart) : nextMonday();

    const { generateSlotsForProvider } = await import('./slotGenerator.js');
    const { createdCount } = await generateSlotsForProvider(providerId, start);

    return res.json({
      message: `Generated ${createdCount} slots`,
      count: createdCount,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

