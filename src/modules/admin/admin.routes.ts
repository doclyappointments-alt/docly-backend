// src/modules/admin/admin.routes.ts

import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.js";
import { authorizeRoles } from "../../common/middleware/authorizeRoles.js";
import * as AdminController from "./admin.controller.js";
import { reEnableGoogleSync } from "./googleSync.admin.controller.js";

const router = Router();

// 🔒 ADMIN ONLY
router.use(authenticate, authorizeRoles("ADMIN"));

router.get("/metrics/overview", AdminController.getOverviewMetrics);
router.get("/metrics/bookings", AdminController.getBookingMetrics);
router.get("/metrics/providers", AdminController.getProviderMetrics);
router.get("/metrics/heatmap", AdminController.getHeatmapMetrics);
router.get(
  "/metrics/provider-health",
  AdminController.getProviderHealthMetrics,
);
router.get("/metrics/conversions", AdminController.getConversionMetrics);

/**
 * @route   GET /admin/payments
 * @desc    Admin – list payments
 */
router.get("/payments", AdminController.getPayments);

/**
 * @route   GET /admin/payments/:id/audit
 * @desc    Admin – payment audit trail
 */
router.get("/payments/:id/audit", AdminController.getPaymentAudit);

// ✅ Google Sync recovery
router.post("/google-sync/re-enable", reEnableGoogleSync);

export default router;
