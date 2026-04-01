import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.js";
import {
  createPayment,
  getPaymentStatus,
  updatePaymentStatus,
  refundPaymentV2,
} from "./payment.controller.js";

const router = Router();

router.post("/", authenticate, createPayment);
router.post("/v2", authenticate, createPayment);
router.get("/:id", authenticate, getPaymentStatus);
router.patch("/:id", authenticate, updatePaymentStatus);
router.post("/v2/:id/refund", authenticate, refundPaymentV2);

export default router;
