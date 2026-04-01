// src/modules/providers/provider.model.ts
import prisma from '@common/utils/prismaClient.js';

export async function findProviderById(id: number) {
  return prisma.provider.findUnique({
    where: { id },
    include: { appointmentSlots: true, appointments: true, user: true },
  });
}

export async function findProviderByUserId(userId: number) {
  return prisma.provider.findUnique({
    where: { userId },
    include: { appointmentSlots: true, appointments: true, user: true },
  });
}

export async function listProviders() {
  return prisma.provider.findMany({
    include: { appointmentSlots: true, user: true },
    orderBy: { id: 'asc' },
  });
}

export async function createProvider(data: {
  userId: number;
  displayName: string;
  specialty: string;
  bio: string;
  latitude?: number;
  longitude?: number;
  status?: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
}) {
  const prismaData: any = {
    userId: data.userId,
    displayName: data.displayName,
    specialty: data.specialty,
    bio: data.bio,
  };
  if (data.latitude !== undefined && data.latitude !== null)
    prismaData.latitude = data.latitude;
  if (data.longitude !== undefined && data.longitude !== null)
    prismaData.longitude = data.longitude;

  return prisma.provider.create({ data: prismaData });
}

export async function updateProvider(
  id: number,
  data: Partial<{
    displayName: string;
    specialty: string;
    bio: string;
    latitude?: number;
    longitude?: number;
  }>
) {
  const prismaData: any = { ...data };
  if (prismaData.latitude === undefined || prismaData.latitude === null)
    delete prismaData.latitude;
  if (prismaData.longitude === undefined || prismaData.longitude === null)
    delete prismaData.longitude;

  return prisma.provider.update({
    where: { id },
    data: prismaData,
  });
}

export async function deleteProvider(id: number) {
  return prisma.provider.delete({ where: { id } });
}
