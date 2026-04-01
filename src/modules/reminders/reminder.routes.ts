// src/modules/reminders/reminder.routes.ts

import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.js";
import { authorizeRoles } from "../../common/middleware/authorizeRoles.js";
import { sendReminder } from "./reminder.service.js";

const router = Router();

/**
 * Manual reminder triggers
 *
 * 🛡️ Production Safe:
 * - Only ADMIN can trigger these endpoints
 * - Fully disabled unless ALLOW_REMINDER_TEST=true
 *
 * 🧪 Dev Usage:
 * - Set ALLOW_REMINDER_TEST=true in .env
 * - Restart the server
 *
 * Routes:
 * POST /reminders/trigger/24h/:appointmentId
 * POST /reminders/trigger/1h/:appointmentId
 */

const allowTest = process.env.ALLOW_REMINDER_TEST === "true";

if (allowTest) {
  router.post(
    "/trigger/24h/:appointmentId",
    authenticate,
    authorizeRoles("ADMIN"),
    async (req, res) => {
      const appointmentId = Number(req.params.appointmentId);

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointmentId" });
      }

      await sendReminder(appointmentId, "24h");

      return res.json({
        ok: true,
        message: "Executed 24h reminder job",
      });
    },
  );

  router.post(
    "/trigger/1h/:appointmentId",
    authenticate,
    authorizeRoles("ADMIN"),
    async (req, res) => {
      const appointmentId = Number(req.params.appointmentId);

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointmentId" });
      }

      await sendReminder(appointmentId, "1h");

      return res.json({
        ok: true,
        message: "Executed 1h reminder job",
      });
    },
  );
} else {
  router.use((_req, res) => {
    return res.status(403).json({
      ok: false,
      message: "Reminder test endpoints are disabled in this environment.",
    });
  });
}

export default router;
