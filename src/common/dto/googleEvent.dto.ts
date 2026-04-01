//src/common/dto/googleEvent.dto.ts 20260118 15:03

import type { GoogleEvent } from '@prisma/client';

export interface GoogleEventDTO {
  googleEventId: string;
  providerId: number;

  /**
   * REQUIRED by Prisma schema
   * Must be provider.userId
   */
  userId: number;

  summary: string;
  description?: string;
  start: Date;
  end: Date;
  status?: string;
  updatedAt: Date;
}

/**
 * Convert Prisma GoogleEvent → DTO.
 */
export function toGoogleEventDTO(event: GoogleEvent): GoogleEventDTO {
  return {
    googleEventId: event.eventId,
    providerId: event.providerId,
    userId: event.userId,              // ✅ FIX
    summary: event.summary,
    description: event.description ?? undefined,
    start: event.startTime!,            // invariant already enforced
    end: event.endTime!,
    status: event.status ?? undefined,
    updatedAt: event.updatedAt,
  };
}
