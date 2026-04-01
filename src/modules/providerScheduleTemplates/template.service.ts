// src/modules/providerScheduleTemplates/template.service.ts

import prisma from '@common/utils/prismaClient.js';
import { CreateScheduleTemplateDTO, UpdateScheduleTemplateDTO } from './template.dto.js';

export const createTemplate = async (providerId: number, data: CreateScheduleTemplateDTO) => {
  return prisma.providerScheduleTemplate.create({
    data: {
      providerId,
      ...data,
      dayOfWeek: Number((data as any).dayOfWeek),
    },
  });
};

export const listTemplates = async (providerId: number) => {
  return prisma.providerScheduleTemplate.findMany({
    where: { providerId },
    orderBy: { dayOfWeek: 'asc' },
  });
};

export const updateTemplate = async (templateId: number, data: UpdateScheduleTemplateDTO) => {
  return prisma.providerScheduleTemplate.update({
    where: { id: templateId },
    data: {
      ...data,
      dayOfWeek: data.dayOfWeek !== undefined ? Number((data as any).dayOfWeek) : undefined,
    },
  });};

export const deleteTemplate = async (templateId: number) => {
  return prisma.providerScheduleTemplate.delete({
    where: { id: templateId },
  });
};
