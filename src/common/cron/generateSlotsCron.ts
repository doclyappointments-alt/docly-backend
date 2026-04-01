// src/common/cron/generateSlotsCron.ts
import cron from 'node-cron';
import prisma from '../utils/prismaClient.js';

async function nextMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = (1 + 7 - day) % 7;
  now.setDate(now.getDate() + diff);
  now.setHours(0, 0, 0, 0);
  return now;
}

export function startWeeklySlotGenerator() {
  if (process.env.NODE_ENV === 'test') {
    console.log('[CRON] Weekly slot generator disabled in test');
    return;
  }

  cron.schedule('59 23 * * 0', async () => {
    const providers = await prisma.provider.findMany({
      select: { id: true },
    });

    const { generateSlotsForProvider } = await import(
      '../../modules/providerScheduleTemplates/slotGenerator.js'
    );

    const weekStart = await nextMonday();

    for (const provider of providers) {
      await generateSlotsForProvider(provider.id, weekStart);
    }
  });
}
