import { stripeClient, stripeBreaker } from "../../common/stripe/stripeBreaker.js";
import express from "express";
import prisma from "../../common/utils/prismaClient.js";

const router = express.Router();

/**
 * @route POST /payments/checkout/session
 * SS-8 — Booking Integrity (Metadata binding)
 */
router.post("/session", async (req, res) => {
  if (process.env.STRIPE_DISABLED === "true") {
    return res.status(202).json({
      status: "PAYMENT_PENDING",
      message:
        "Payment system temporarily unavailable. Your booking is saved and will complete automatically.",
    });
  }

  try {
    const { type, appointmentId } = req.body as {
      type: "single" | "5pack" | "10pack";
      appointmentId: number;
    };

    if (!appointmentId) {
      return res.status(400).json({ error: "Missing appointmentId" });
    }

    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status !== "PENDING") {
      return res.status(400).json({ error: "Checkout not allowed for this appointment status" });
    }

    let amount: number;

    switch (type) {
      case "single":
        amount = 3000;
        break;
      case "5pack":
        amount = 12000;
        break;
      case "10pack":
        amount = 21000;
        break;
      default:
        return res.status(400).json({ error: "Invalid type" });
    }

    const session = await stripeBreaker.exec(() =>
      stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: `${type} appointment pack`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          appointmentId: String(appointmentId),
        },
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      })
    );

    return res.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE_ERROR:", err);
    return res.status(202).json({
      status: "PAYMENT_PENDING",
      message:
        "Payment system temporarily unavailable. Your booking is saved and will complete automatically.",
    });
  }
});

export default router;
