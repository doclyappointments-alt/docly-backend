// src/common/dto/appointment.dto.ts
// 20260118-14:55

import type { Appointment, Provider, User } from "@prisma/client";
import { toProviderDTO } from "./provider.dto.js";
import { toUserDTO } from "./user.dto.js";

export interface AppointmentDTO {
  id: number;
  title: string;
  status: string;
  notes?: string; // provider-only
  createdAt: string;
  updatedAt: string;
  slotId: number;
  userId: number;
  providerId: number;
  provider?: ReturnType<typeof toProviderDTO>;
  user?: ReturnType<typeof toUserDTO>;
  date: string;
}

export function toAppointmentDTO(
  appointment: Appointment & {
    provider?: Provider | null;
    user?: User | null;
  },
  role?: string
): AppointmentDTO {
  const dto: AppointmentDTO = {
    id: appointment.id,
    title: appointment.title,
    status: appointment.status,
    slotId: appointment.slotId!,
    userId: appointment.userId!,
    providerId: appointment.providerId!,
    date: appointment.date.toISOString(),
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
    notes: appointment.notes ?? undefined,
    provider: appointment.provider
      ? toProviderDTO(appointment.provider)
      : undefined,
    user: appointment.user ? toUserDTO(appointment.user) : undefined,
  };

  // PATIENT → cannot see notes
  if (role === "PATIENT") {
    delete dto.notes;
  }

  return dto;
}
