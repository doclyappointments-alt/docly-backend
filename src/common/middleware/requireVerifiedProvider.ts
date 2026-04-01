import { Request, Response, NextFunction } from "express";
import prisma from "@common/utils/prismaClient.js";

/**
 * Ensures the authenticated user is a VERIFIED provider.
 * Blocks PENDING / REJECTED / SUSPENDED providers.
 */
export async function requireVerifiedProvider(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { provider: true },
  });

  if (!user || user.role !== "PROVIDER" || !user.provider) {
    return res.status(403).json({ error: "Provider access required" });
  }

  if (user.provider.status !== "VERIFIED") {
    return res.status(403).json({
      error: "Provider must be verified to perform this action",
    });
  }

  // Optional attach for downstream use
  (req as any).provider = user.provider;

  next();
}
