import type { Request, Response } from "express";
import Stripe from "stripe";
import prisma from "../../common/utils/prismaClient.js";
import { enqueueStripeEvent } from "../../common/queues/stripeEventQueue.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing Stripe signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return res
      .status(400)
      .send(`Webhook signature verification failed: ${err}`);
  }

  // === SS-5 Intake Persistence (Idempotency Wall) ===
  try {
    await prisma.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
        payload: event as any,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.json({ received: true, duplicate: true });
    }
    throw err;
  }

  // === Async Isolation ===
  await enqueueStripeEvent(event.id);

  // Immediate ACK (prevents retry storm amplification)
  res.json({ received: true });
};
