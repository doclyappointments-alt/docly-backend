// src/common/cron/reminderSafetyCron.ts
import prisma from '../utils/prismaClient.js';
import { enqueueReminderJob } from '../queues/reminderQueue.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'reminderSafetyCron' });

export function startReminderSafetyCron() {
  if (process.env.NODE_ENV === 'test') {
    console.log('[CRON] reminderSafetyCron disabled in test');
    return;
  }

  setInterval(async () => {
    const now = new Date();

    const upcoming = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        date: { gt: now },
        OR: [
          { reminder24Sent: false },
          { reminder1hSent: false },
        ],
      },
    });

    for (const appt of upcoming) {
      const start = appt.date.getTime();
      const nowMs = Date.now();

      if (!appt.reminder24Sent) {
        const delay = start - 24 * 60 * 60 * 1000 - nowMs;
        if (delay > 0) {
          await enqueueReminderJob(
            'send',
            { appointmentId: appt.id, type: '24h' },
            { delay }
          );
        }
      }

      if (!appt.reminder1hSent) {
        const delay = start - 60 * 60 * 1000 - nowMs;
        if (delay > 0) {
          await enqueueReminderJob(
            'send',
            { appointmentId: appt.id, type: '1h' },
            { delay }
          );
        }
      }
    }

    log.info({ count: upcoming.length }, 'Reminder safety scan completed');
  }, 15 * 60 * 1000);
}
