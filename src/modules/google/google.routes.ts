import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.js";
import { requireVerifiedProvider } from "../../common/middleware/requireVerifiedProvider.js";

const router = Router();
const NODE_ENV = process.env.NODE_ENV;

/* -------------------------------------------------------
 * GOOGLE ROUTES
 * ----------------------------------------------------- */

if (NODE_ENV !== "test") {
  const controller = await import("./google.controller.js");

  const {
    connectGoogleCalendar,
    handleGoogleOAuthCallback,
    syncGoogleCalendarEvents,
  } = controller;

  // Initiate OAuth
  router.get("/connect", connectGoogleCalendar);

  // OAuth callback
  router.get("/callback", handleGoogleOAuthCallback);

  // Sync calendar (verified providers only)
  router.post(
    "/sync",
    authenticate,
    requireVerifiedProvider,
    syncGoogleCalendarEvents
  );
}

export default router;
