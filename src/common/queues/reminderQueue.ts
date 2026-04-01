// src/common/queues/reminderQueue.ts
import type { Queue, Worker, Job } from 'bullmq';

const isTest = process.env.NODE_ENV === 'test';

let reminderQueue: Queue | null = null;

/* =======================================================
 * TEST-MODE JOB STORE
 * ======================================================= */

type TestReminderJob = {
  id: string;
  name: string;
  data: unknown;
  opts?: unknown;
};

const testReminderJobs = new Map<string, TestReminderJob>();

export async function __getReminderJob(jobId: string) {
  if (isTest) {
    return testReminderJobs.get(jobId) ?? null;
  }

  const q = await getQueue();
  if (!q) return null;
  return q.getJob(jobId);
}

async function getQueue() {
  if (isTest) return null;
  if (reminderQueue) return reminderQueue;

  const { Queue } = await import('bullmq');
  const redis = (await import('../config/redis.js')).default;
  reminderQueue = new Queue('reminders', { connection: redis });
  return reminderQueue;
}

async function waitForRedis() {
  const redis = (await import('../config/redis.js')).default;
  while (true) {
    try {
      await redis.ping();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function enqueueReminderJob(
  name: string,
  payload: unknown,
  opts?: Parameters<Queue['add']>[2]
) {
  if (isTest) {
    const id =
      (opts as { jobId?: string } | undefined)?.jobId ??
      `${name}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    const job: TestReminderJob = {
      id,
      name,
      data: payload,
      opts,
    };

    testReminderJobs.set(id, job);
    return job;
  }

  const q = await getQueue();
  if (!q) return;
  return q.add(name, payload, opts);
}

export async function __enqueueTestReminderJob(input?: {
  simulate?: 'slow';
  ms?: number;
}) {
  return enqueueReminderJob(
    'reminder:test',
    { simulate: input?.simulate ?? 'slow', ms: input?.ms ?? 90000 },
    {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
}

export function startReminderWorker() {
  if (isTest) return;

  void (async () => {
    console.log('[WORKER][reminders] waiting for redis...');
    await waitForRedis();

    const { Worker } = await import('bullmq');
    const redis = (await import('../config/redis.js')).default;

    const worker: Worker = new Worker(
      'reminders',
      async (job: Job) => {
        if (job.name === 'reminder:test' && job.data?.simulate === 'zombie') {
          const start = Date.now();
          while (Date.now() - start < (job.data?.ms ?? 60000)) {}
        }
        if (job.name === 'reminder:test' && job.data?.simulate === 'slow') {
          const ms = Number(job.data?.ms ?? 90000);
          await new Promise((r) => setTimeout(r, ms));
        }
        return { ok: true };
      },
      {
        connection: redis,
        concurrency: 1,
        stalledInterval: 5000,
        maxStalledCount: 5,
      }
    );

    worker.on('completed', (job) =>
      console.log(`[WORKER][reminders] completed job=${job.id}`)
    );
    worker.on('failed', (job, err) =>
      console.log(`[WORKER][reminders] failed job=${job?.id} err=${err}`)
    );

    worker.on('stalled', (jobId) => {
      console.error('[SC-7][ZOMBIE] BullMQ stalled job detected jobId=' + jobId + ' — exiting worker');
      setTimeout(() => process.exit(1), 500);
    });

    startWorkerHeartbeat('reminders');
    startWorkerWatchdog('reminders');
    console.log('[WORKER][reminders] online');
  })();
}

/**
 * Domain-level helper.
 * Services should use THIS, not enqueueReminderJob directly.
 */
export async function enqueueAppointmentReminders(input: {
  appointmentId: number;
  appointmentDate: Date;
}) {
  const { appointmentId, appointmentDate } = input;

  const now = Date.now();
  const start = appointmentDate.getTime();

  const delay24h = start - 24 * 60 * 60 * 1000 - now;
  const delay1h = start - 60 * 60 * 1000 - now;

  if (delay24h > 0) {
    await enqueueReminderJob(
      'reminder:24h',
      { appointmentId },
      {
        jobId: `appointment-${appointmentId}-24h`,
        delay: delay24h,
      }
    );
  }

  if (delay1h > 0) {
    await enqueueReminderJob(
      'reminder:1h',
      { appointmentId },
      {
        jobId: `appointment-${appointmentId}-1h`,
        delay: delay1h,
      }
    );
  }
}

/* =======================================================
 * SC-7 — Worker Heartbeat
 * ======================================================= */

async function startWorkerHeartbeat(workerName: string) {
  const redis = (await import('../config/redis.js')).default;
  const key = `worker:heartbeat:${workerName}:${process.pid}`;

  setInterval(async () => {
    try {
      await redis.set(key, Date.now().toString(), 'EX', 5);
    } catch {
      // heartbeat must never crash worker
    }
  }, 5000);
}

/* =======================================================
 * SC-7 — Zombie Watchdog + Self-Exit Recovery
 * ======================================================= */

let zombieExitTriggered = false;

async function triggerZombieSelfExit(meta: {
  workerName: string;
  pid: number;
  ageMs: number;
}) {
  if (zombieExitTriggered) return;
  zombieExitTriggered = true;

  console.error(
    `[SC-7][RECOVERY] zombie confirmed — exiting process ` +
    `worker=${meta.workerName} pid=${meta.pid} lastHeartbeatMs=${meta.ageMs}`
  );

  setTimeout(() => process.exit(1), 500);
}

async function startWorkerWatchdog(workerName: string) {
  const redis = (await import('../config/redis.js')).default;
  const prefix = `worker:heartbeat:${workerName}:`;

  setInterval(async () => {
    try {
      const keys = await redis.keys(`${prefix}*`);
      const now = Date.now();

      for (const key of keys) {
        const last = await redis.get(key);
        if (!last) continue;

        const ageMs = now - Number(last);
        const pid = Number(key.split(':').pop());

        if (ageMs > 6000) {
          console.error(
            `[SC-7][ZOMBIE] worker=${workerName} pid=${pid} lastHeartbeatMs=${ageMs}`
          );

          await triggerZombieSelfExit({ workerName, pid, ageMs });
        }
      }
    } catch {
      // watchdog must never crash worker
    }
  }, 3000);
}
