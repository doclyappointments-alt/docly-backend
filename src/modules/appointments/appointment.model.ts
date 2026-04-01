import prisma from "@common/utils/prismaClient.js";

export async function createAppointment(data: {
  userId: number;
  providerId: number;
  slotId: number;
  title: string;
  date: Date;
  notes?: string;
  location?: string;
  duration?: number;
}) {
  return prisma.appointment.create({
    data,
  });
}

export async function listAppointmentsByUser(userId: number) {
  return prisma.appointment.findMany({
    where: { userId },
    include: {
      provider: true,
    },
  });
}

export async function listAppointmentsByProvider(providerId: number) {
  return prisma.appointment.findMany({
    where: { providerId },
    include: {
      user: true,
    },
  });
}
