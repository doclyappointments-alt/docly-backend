// src/modules/users/user.controller.ts
import { Request, Response } from 'express';
import prisma from '@common/utils/prismaClient.js';
import { logger } from '@common/utils/logger.js';

const userLogger = logger.child({ module: 'userController' });

/**
 * Get logged-in user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      userLogger.info({ msg: 'Unauthorized profile access attempt' });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      userLogger.info({ msg: 'User not found', userId });
      return res.status(404).json({ error: 'User not found' });
    }

    userLogger.info({ msg: 'Fetched user profile', userId });
    res.json({ user });
  } catch (e: unknown) {
    userLogger.error({ err: e, userId: (req as any).userId, route: '/user/profile' });
    res.status(500).json({ error: 'Failed to fetch profile', details: String(e) });
  }
};

/**
 * Update logged-in user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      userLogger.info({ msg: 'Unauthorized profile update attempt' });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, email } = req.body;
    if (!name && !email) {
      userLogger.info({ msg: 'No fields provided for update', userId });
      return res.status(400).json({ error: 'No fields to update' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
      userLogger.info({ msg: 'User not found during update', userId });
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name ?? undefined,
        email:
          email && email.toLowerCase() !== currentUser.email
            ? email.toLowerCase()
            : undefined,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    userLogger.info({ msg: 'Updated user profile', userId });
    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (e: unknown) {
    userLogger.error({ err: e, userId: (req as any).userId, route: '/user/updateProfile' });
    res.status(500).json({ error: 'Failed to update profile', details: String(e) });
  }
};

/**
 * Delete logged-in user
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      userLogger.info({ msg: 'Unauthorized delete user attempt' });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await prisma.user.delete({ where: { id: userId } });

    userLogger.info({ msg: 'Deleted user', userId });
    res.json({ message: 'User deleted successfully' });
  } catch (e: unknown) {
    userLogger.error({ err: e, userId: (req as any).userId, route: '/user/delete' });
    res.status(500).json({ error: 'Failed to delete user', details: String(e) });
  }
};
