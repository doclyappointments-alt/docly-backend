//src/common/cron/syncCron.ts

import { enqueueCalendarSync } from '../queues/calendarSyncQueue.js';
import prisma from '../utils/prismaClient.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'syncCron' });

// Interval in minutes for periodic sync (default 15)
const SYNC_INTERVAL_MINUTES = parseInt(process.env.CALENDAR_SYNC_INTERVAL_MINUTES || '15', 10);
const CRON_ENABLED = process.env.CALENDAR_SYNC_ENABLED === 'true';

export const startCalendarSyncCron = () => {
  if (!CRON_ENABLED) {
    log.info({ msg: 'Calendar sync cron disabled via environment variable' });
    return;
  }

  log.info({ msg: `Starting calendar sync cron: every ${SYNC_INTERVAL_MINUTES} minutes` });

  const syncAllProviders = async () => {
    try {
      log.info({ msg: 'Triggering calendar sync for all providers' });

      const providers = await prisma.provider.findMany({
        where: { googleAccessToken: { not: null }, googleRefreshToken: { not: null } },
        select: { id: true, displayName: true },
      });

      for (const provider of providers) {
        await enqueueCalendarSync({ providerId: provider.id });
        log.info({
          msg: `Enqueued sync job for provider`,
          providerId: provider.id,
          displayName: provider.displayName,
        });
      }

      log.info({ msg: `Enqueued sync jobs for ${providers.length} providers` });
    } catch (err: unknown) {
      log.error({ msg: 'Failed to enqueue periodic calendar sync', err });
    }
  };

  // Run immediately on startup
  syncAllProviders();

  // Schedule repeated runs
  setInterval(syncAllProviders, SYNC_INTERVAL_MINUTES * 60 * 1000);
};
