// src/modules/slots/slot.routes.ts

import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.js";
import { requireVerifiedProvider } from "../../common/middleware/requireVerifiedProvider.js";

import {
  createSlot,
  listSlots,
  updateSlot,
  deleteSlot,
  bulkCreateSlots,
} from "./slot.controller.js";

const router = Router();

/* -------------------------------------------------------
 * SLOT CRUD — VERIFIED PROVIDERS ONLY
 * ----------------------------------------------------- */

// Create single slot
router.post(
  "/",
  authenticate,
  requireVerifiedProvider,
  createSlot,
);

// List own slots
router.get(
  "/",
  authenticate,
  requireVerifiedProvider,
  listSlots,
);

// Update slot
router.patch(
  "/:id",
  authenticate,
  requireVerifiedProvider,
  updateSlot,
);

// Delete slot
router.delete(
  "/:id",
  authenticate,
  requireVerifiedProvider,
  deleteSlot,
);

// Bulk generate slots
router.post(
  "/bulk",
  authenticate,
  requireVerifiedProvider,
  bulkCreateSlots,
);

export default router;
