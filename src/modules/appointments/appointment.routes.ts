// src/modules/appointments/appointment.routes.ts

import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.js";
import * as appointmentController from "./appointment.controller.js";

const router = Router();

// CRUD
router.post("/", authenticate, appointmentController.createAppointment);
router.get("/", authenticate, appointmentController.listAppointments);
router.patch("/:id", authenticate, appointmentController.updateAppointment);
router.delete("/:id", authenticate, appointmentController.deleteAppointment);

// Status actions
router.patch(
  "/:id/confirm",
  authenticate,
  appointmentController.confirmAppointment,
);
router.patch(
  "/:id/cancel",
  authenticate,
  appointmentController.cancelAppointment,
);
router.post(
  "/:id/reschedule",
  authenticate,
  appointmentController.rescheduleAppointment,
);

// Admin / provider-only
router.patch(
  "/:id/status",
  authenticate,
  appointmentController.updateAppointmentStatus,
);

// Audit logs
router.get(
  "/:id/audit",
  authenticate,
  appointmentController.getAppointmentAuditLog,
);

export default router;
