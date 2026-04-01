import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.js";
import {
  createPayment,
  getPaymentStatus,
  updatePaymentStatus,
  refundPaymentV2,
} from "./payment.controller.js";

const router = Router();

// v2 canonical API
router.post("/", authenticate, createPayment);
router.get("/:id", authenticate, getPaymentStatus);
router.patch("/:id", authenticate, updatePaymentStatus);
router.post("/:id/refund", authenticate, refundPaymentV2);

export default router;
