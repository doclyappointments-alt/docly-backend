import { Router } from "express";
import prisma from "@common/utils/prismaClient.js";
import { authenticate } from "@common/middleware/auth.js";

const router = Router();

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({ user });
});

export default router;
