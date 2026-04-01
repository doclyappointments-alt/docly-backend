// src/modules/providers/provider.routes.ts

import { Router } from "express";
import {
  searchProviders,
  getMyProvider,
  updateMyProfile,
  createProvider,
  deleteProvider,
  getProvider,
  setProviderStatus,
} from "./provider.controller.js";

import { authenticate } from "../../common/middleware/auth.js";
import { authorizeRoles } from "../../common/middleware/authorizeRoles.js";

const router = Router();

/* -------------------------------------------------------
 * PROVIDER SEARCH (Public)
 * ----------------------------------------------------- */
router.get("/search", searchProviders);

/* -------------------------------------------------------
 * PROVIDER PROFILE (Self)
 * ----------------------------------------------------- */

// Get own provider profile
router.get("/me", authenticate, authorizeRoles("PROVIDER"), getMyProvider);

// Update own provider profile
router.patch(
  "/me/profile",
  authenticate,
  authorizeRoles("PROVIDER"),
  updateMyProfile,
);

/* -------------------------------------------------------
 * PROVIDER PROFILE CRUD
 * ----------------------------------------------------- */
router.post(
  "/",
  authenticate,
  authorizeRoles("PROVIDER", "ADMIN"),
  createProvider,
);

router.delete(
  "/",
  authenticate,
  authorizeRoles("PROVIDER", "ADMIN"),
  deleteProvider,
);

router.get("/:id", authenticate, getProvider);

/* -------------------------------------------------------
 * ADMIN — PROVIDER VERIFICATION
 * ----------------------------------------------------- */
router.patch(
  "/status",
  authenticate,
  authorizeRoles("ADMIN"),
  setProviderStatus,
);

export default router;
