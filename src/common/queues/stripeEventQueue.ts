// src/common/queues/stripeEventQueue.ts
import { Queue, Worker, Job } from "bullmq";
import redis from "../config/redis.js";
import prisma from "../utils/prismaClient.js";

const isTest = process.env.NODE_ENV === "test";

let stripeQueue: Queue | null = null;

function getQueue() {
  if (isTest) return null;
  if (stripeQueue) return stripeQueue;

  stripeQueue = new Queue("stripe-events", {
    connection: redis,
  });

  return stripeQueue;
}

export async function enqueueStripeEvent(eventId: string) {
  const queue = getQueue();
  if (!queue) return;

  await queue.add(
    "process",
    { eventId },
    {
      removeOnComplete: true,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
    }
  );
}

export function startStripeWorker() {
  if (isTest) return;

  new Worker(
    "stripe-events",
    async (job: Job) => {
      const { eventId } = job.data;

      const stripeEvent = await prisma.stripeEvent.findUnique({
        where: { id: eventId },
      });

      if (!stripeEvent || stripeEvent.processed) return;

      const event = stripeEvent.payload as any;

      switch (event.type) {
        case "checkout.session.completed": {
          const appointmentId = Number(
            event.data?.object?.metadata?.appointmentId
          );

          if (appointmentId) {
            await prisma.appointment.update({
              where: { id: appointmentId },
              data: { status: "CONFIRMED" },
            });
          }
          break;
        }

        case "charge.refunded": {
          const appointmentId = Number(
            event.data?.object?.metadata?.appointmentId
          );

          if (appointmentId) {
            await prisma.appointment.update({
              where: { id: appointmentId },
              data: { status: "CANCELLED" },
            });
          }
          break;
        }

        default:
          console.log(`[STRIPE WORKER] Unhandled type: ${event.type}`);
      }

      await prisma.stripeEvent.update({
        where: { id: eventId },
        data: { processed: true, processedAt: new Date() },
      });
    },
    { connection: redis }
  );

  console.log("[WORKER][stripe-events] online");

// Startup sweep: enqueue any unprocessed events
(async () => {
  const pending = await prisma.stripeEvent.findMany({
    where: { processed: false },
    select: { id: true },
  });

  for (const evt of pending) {
    await enqueueStripeEvent(evt.id);
  }
})();

}
