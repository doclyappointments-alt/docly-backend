import express from "express";
import { handleStripeWebhook } from "./payment.webhook.controller.js";

const router = express.Router();

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

export default router;
