import prisma from '@common/utils/prismaClient.js';

export async function createProcedure(data: {
  name: string;
  description?: string;
  price: number;
  providerId: number;
}) {
  return prisma.procedure.create({ data });
}

export async function getProcedureById(id: number) {
  return prisma.procedure.findUnique({ where: { id } });
}

export async function listProcedures(providerId?: number) {
  return prisma.procedure.findMany({
    where: providerId ? { providerId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateProcedure(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    price: number;
  }>,
) {
  return prisma.procedure.update({ where: { id }, data });
}

export async function deleteProcedure(id: number) {
  return prisma.procedure.delete({ where: { id } });
}
