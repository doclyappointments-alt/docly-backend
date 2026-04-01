// src/modules/notifications/notification.controller.ts
import { Request, Response } from 'express';
import * as NotificationService from './notification.service.js';

export const sendNotification = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as number | undefined;

    const {
      userId,
      channel,
      subject,
      message,
      emailOverride,
    }: {
      userId?: number;
      channel: 'EMAIL' | 'SMS' | 'PUSH';
      subject?: string;
      message: string;
      emailOverride?: string;
    } = req.body;

    if (!channel || !message) {
      return res.status(400).json({ message: 'channel and message are required' });
    }

    const targetUserId = userId ?? authUserId;
    if (!targetUserId) {
      return res
        .status(400)
        .json({ message: 'userId is required if not authenticated as a user' });
    }

    const logEntry = await NotificationService.sendNotification({
      userId: targetUserId,
      channel,
      subject,
      message,
      emailOverride,
    });

    return res.status(201).json(logEntry);
  } catch (err: any) {
    console.error('sendNotification error:', err);
    return res.status(500).json({ message: err.message || 'Failed to send notification' });
  }
};

export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as number | undefined;
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const notifications = await NotificationService.getNotificationsForUser(authUserId);
    return res.json(notifications);
  } catch (err: any) {
    console.error('getMyNotifications error:', err);
    return res.status(500).json({ message: err.message || 'Failed to fetch notifications' });
  }
};

export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ message: 'Invalid userId' });

    const notifications = await NotificationService.getNotificationsForUser(userId);
    return res.json(notifications);
  } catch (err: any) {
    console.error('getUserNotifications error:', err);
    return res.status(500).json({ message: err.message || 'Failed to fetch notifications' });
  }
};
