// src/modules/auth/auth.routes.ts

import { Router, Request, Response } from "express";
import { google } from "googleapis";

import { validate } from "@common/middleware/validate.js";
import {
  register,
  login,
  refreshToken,
  logout,
  requestPasswordResetHandler,
  resetPasswordHandler,
} from "./auth.controller.js";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "./auth.schema.js";

const router = Router();

/* -------------------------------------------------------
 * AUTH ROUTES
 * ----------------------------------------------------- */
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

/* -------------------------------------------------------
 * PASSWORD RESET ROUTES
 * ----------------------------------------------------- */
router.post(
  "/password-reset/request",
  validate(requestPasswordResetSchema),
  requestPasswordResetHandler,
);

router.post(
  "/password-reset/confirm",
  validate(resetPasswordSchema),
  resetPasswordHandler,
);

/* -------------------------------------------------------
 * GOOGLE OAUTH CALLBACK
 * ----------------------------------------------------- */
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

router.get("/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send("No code in query params");
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // DEV ONLY — do not log in production
    if (process.env.NODE_ENV !== "production") {
      console.log("Access Token:", tokens.access_token);
      console.log("Refresh Token:", tokens.refresh_token);
      console.log("Expiry Date:", tokens.expiry_date);
    }

    res.send("OAuth successful! Check backend console for tokens.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error exchanging code for tokens");
  }
});

export default router;
