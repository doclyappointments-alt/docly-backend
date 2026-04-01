import type { AppointmentSlot } from '@prisma/client';

export interface SlotDTO {
  id: number;
  providerId: number;
  title: string | null;
  start: string;
  end: string;
  booked: boolean;
}

export function toSlotDTO(slot: AppointmentSlot): SlotDTO {
  return {
    id: slot.id,
    providerId: slot.providerId,
    title: slot.title,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    booked: slot.booked,
  };
}
