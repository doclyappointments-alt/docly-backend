// src/modules/procedures/procedure.routes.ts
import { Router } from "express"; // ✅ FIX: use "express"
import { authenticate } from "../../common/middleware/auth.js"; // ✅ FIX: correct export
import { authorizeRoles } from "../../common/middleware/authorizeRoles.js"; // ✅ FIX: correct path
import {
  createProcedure,
  listProcedures,
  getProcedure,
  updateProcedure,
  deleteProcedure,
} from "./procedure.controller.js"; // ✅ FIX: correct file location

const router = Router();

// Require authentication for all procedure routes
router.use(authenticate); // ✅ FIX: use correct middleware name

// Create procedure - only PROVIDER and ADMIN
router.post("/", authorizeRoles("PROVIDER", "ADMIN"), createProcedure);

// List procedures - any authenticated user
router.get("/", listProcedures);

// Get a single procedure by ID
router.get("/:id", getProcedure);

// Update procedure - only PROVIDER and ADMIN
router.put("/:id", authorizeRoles("PROVIDER", "ADMIN"), updateProcedure);

// Delete procedure - only PROVIDER and ADMIN
router.delete("/:id", authorizeRoles("PROVIDER", "ADMIN"), deleteProcedure);

export default router;
