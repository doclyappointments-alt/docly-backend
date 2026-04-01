// src/common/types/express.d.ts
import { Role as PrismaRole } from '@prisma/client';

export type Role = PrismaRole;

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: Role;

      user?: {
        id: number;
        role: Role;
        email?: string;
      };
    }
  }
}

export {};
