import prisma from "@common/utils/prismaClient.js";

export type UserRole = "PATIENT" | "PROVIDER" | "ADMIN";

export async function findUserById(id: number) {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}) {
  return prisma.user.create({
    data,
  });
}
