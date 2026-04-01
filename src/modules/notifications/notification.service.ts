// src/modules/notifications/notification.service.ts

import prisma from '@common/utils/prismaClient.js';
import { sendEmail } from './channels/email.sender.js';
import { sendSms } from './channels/sms.sender.js';
import { sendPush } from './channels/push.sender.js';

type Channel = 'EMAIL' | 'SMS' | 'PUSH';

interface SendNotificationParams {
  userId: number;
  channel: Channel;
  subject?: string;
  message: string;
  emailOverride?: string;
}

export const sendNotification = async ({
  userId,
  channel,
  subject,
  message,
  emailOverride,
}: SendNotificationParams) => {
  // Fetch user (email now, phone/push token later)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user && channel !== 'PUSH') {
    throw new Error('Target user not found');
  }

  let status: 'QUEUED' | 'SENT' | 'FAILED' = 'QUEUED';
  let error: string | null = null;

  try {
    switch (channel) {
      case 'EMAIL': {
        const to = emailOverride || user?.email;
        if (!to) throw new Error('No email address available for user');

        await sendEmail({
          to,
          subject: subject || 'Notification from Docly',
          text: message,
        });

        status = 'SENT';
        break;
      }

      case 'SMS': {
        // Dummy SMS sender for now
        await sendSms({
          to: 'DUMMY_NUMBER',
          message,
        });

        status = 'SENT';
        break;
      }

      case 'PUSH': {
        await sendPush({
          target: `user-${userId}`,
          title: subject || 'Notification',
          body: message,
        });

        status = 'SENT';
        break;
      }

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  } catch (err: any) {
    console.error('Notification send error:', err);
    status = 'FAILED';
    error = err.message || 'Unknown error';
  }

  const log = await prisma.notificationLog.create({
    data: {
      userId,
      channel: channel as any, // matches Prisma enum
      status: status as any,
      message: error
        ? `${message} (ERROR: ${error})`
        : message,
    },
  });

  return log;
};

export const getNotificationsForUser = async (userId: number) => {
  return prisma.notificationLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};
