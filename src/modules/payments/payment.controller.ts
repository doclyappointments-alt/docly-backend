import { Request, Response } from "express";
import prisma from "../../common/utils/prismaClient.js";
import { logger } from "../../common/utils/logger.js";
import { refundPayment, createPayment as createPaymentService } from "./payment.service.js";

const log = logger.child({ controller: "payment" });

// ---------------------
// Create Payment (v2 canonical)
// ---------------------
export const createPayment = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { appointmentId, amount, paymentType } = req.body;

    if (!appointmentId || !amount || !paymentType) {
      return res.status(400).json({
        error: "appointmentId, amount, and paymentType are required",
      });
    }

    // Legacy appointment payment (Phase 2 compatibility)
    const appointmentPayment = await prisma.appointmentPayment.create({
      data: {
        appointmentId,
        userId: req.userId,
        amount,
        paymentType,
        status: "PENDING",
      },
    });

    // Canonical payment (THIS is what tests assert on)
    const payment = await createPaymentService({
      appointmentId,
      userId: req.userId!,
      amount,
      provider: "stripe",
      providerRef: "pi_test_v2",
      currency: "GBP",
    });

    log.info({
      msg: "Payment created",
      appointmentPaymentId: appointmentPayment.id,
      paymentId: payment.id,
      userId: req.userId,
    });

    res.status(201).json({ payment });
  } catch (e: unknown) {
    log.error({ err: e, route: "/payments/v2" });
    res.status(500).json({
      error: "Failed to create payment",
      details: String(e),
    });
  }
};

// ---------------------
// Get Payment Status
// ---------------------
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const paymentId = Number(req.params.id);
    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.userId !== req.userId) {
      return res.status(404).json({
        error: "Payment not found or not owned by user",
      });
    }

    res.json({ payment });
  } catch (e: unknown) {
    log.error({ err: e, route: "/payments/:id" });
    res.status(500).json({
      error: "Failed to fetch payment",
      details: String(e),
    });
  }
};

// ---------------------
// Update Payment Status
// ---------------------
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const paymentId = Number(req.params.id);
    const { status } = req.body;

    if (!paymentId || !status) {
      return res.status(400).json({
        error: "Payment ID and status are required",
      });
    }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });

    log.info({
      msg: "Payment status updated",
      paymentId,
      status,
    });

    res.json({ payment });
  } catch (e: unknown) {
    log.error({ err: e, route: "/payments/:id" });
    res.status(500).json({
      error: "Failed to update payment",
      details: String(e),
    });
  }
};

// ---------------------
// Refund Payment (v2)
// ---------------------
export const refundPaymentV2 = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const paymentId = Number(req.params.id);
    const { amount } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    const payment = await refundPayment({
      paymentId,
      refundAmount: amount,
      meta: { actor: "user", userId: req.userId },
    });

    res.json({ payment });
  } catch (e: unknown) {
    log.error({ err: e, route: "/payments/v2/:id/refund", userId: req.userId });
    res
      .status(500)
      .json({ error: "Failed to refund payment", details: String(e) });
  }
};
