// src/modules/google/googleEvent.model.ts

import prisma from '@common/utils/prismaClient.js';
import { GoogleEventDTO } from '@common/dto/googleEvent.dto.js';

/**
 * Retrieve all Google Calendar events for a provider.
 */
export async function findGoogleEventByProvider(providerId: number) {
  return prisma.googleEvent.findMany({
    where: { providerId },
    orderBy: { startTime: 'asc' },
  });
}

/**
 * Upsert a Google Calendar event.
 *
 * Unique key = (eventId, providerId)
 *
 * ⚠️ Invariant:
 * - userId MUST be the provider's userId
 * - never null, never faked
 */
export async function upsertGoogleEvent(data: GoogleEventDTO) {
  return prisma.googleEvent.upsert({
    where: {
      eventId_providerId: {
        eventId: data.googleEventId,
        providerId: data.providerId,
      },
    },
    update: {
      summary: data.summary,
      description: data.description,
      startTime: data.start,
      endTime: data.end,
      status: data.status,
      updatedAt: data.updatedAt,
    },
    create: {
      eventId: data.googleEventId,
      providerId: data.providerId,
      userId: data.userId, // ✅ REQUIRED BY SCHEMA
      summary: data.summary,
      description: data.description,
      startTime: data.start,
      endTime: data.end,
      status: data.status,
      updatedAt: data.updatedAt,
    },
  });
}

/**
 * Delete a Google event by composite key.
 */
export async function deleteGoogleEvent(
  eventId: string,
  providerId: number
) {
  return prisma.googleEvent.delete({
    where: {
      eventId_providerId: { eventId, providerId },
    },
  });
}
