// src/modules/admin/googleSync.admin.controller.ts

import { Request, Response } from 'express';
import prisma from '@common/utils/prismaClient.js';

export async function reEnableGoogleSync(req: Request, res: Response) {
  const adminUserId = req.userId; // assume auth middleware sets this
  const { providerId, accessToken, refreshToken, tokenExpiry } = req.body;

  if (!providerId || !accessToken || !refreshToken) {
    return res.status(400).json({
      error: 'providerId, accessToken, and refreshToken are required',
    });
  }

  const provider = await prisma.provider.findUnique({
    where: { id: Number(providerId) },
  });

  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  await prisma.$transaction([
    prisma.provider.update({
      where: { id: provider.id },
      data: {
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
        tokenExpiry: tokenExpiry ? new Date(tokenExpiry) : null,
      },
    }),

    prisma.analyticsLog.create({
      data: {
        userId: adminUserId,
        event: 'GOOGLE_SYNC_RE_ENABLED',
        meta: {
          providerId: provider.id,
          action: 'RE_ENABLED',
          actorRole: 'ADMIN',
        },
      },
    }),
  ]);

  return res.json({
    success: true,
    message: 'Google sync re-enabled',
  });
}
