// src/common/queues/calendarSyncQueue.ts
import type { Queue } from 'bullmq';

const isTest = process.env.NODE_ENV === 'test';

let calendarSyncQueue: Queue | null = null;

async function getQueue() {
  if (isTest) return null;
  if (calendarSyncQueue) return calendarSyncQueue;

  const { Queue } = await import('bullmq');
  const redis = (await import('../config/redis.js')).default;
  calendarSyncQueue = new Queue('calendar-sync', { connection: redis });
  return calendarSyncQueue;
}

export async function enqueueCalendarSync(payload: unknown) {
  const q = await getQueue();
  if (!q) return;
  return q.add('sync', payload);
}

export function startCalendarSyncWorker() {
  // wired later (not part of SC-7 yet)
}
