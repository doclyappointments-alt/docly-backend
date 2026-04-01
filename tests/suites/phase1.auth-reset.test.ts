// tests/suites/phase1.auth-reset.test.ts

import assert from "assert";
import { api } from "../helpers/api.ts";

/**
 * Phase 1 — AUTH: Password Reset
 *
 * Acceptance criteria:
 * - Request reset (existing email) → 200 (generic)
 * - Request reset (non-existent email) → 200 (generic)
 * - Reset with valid token → password changes
 * - Reset with expired/invalid token → 400
 * - Token cleared after use
 */

(async function runPhase1AuthReset() {
  console.log("🧪 Phase 1 — Auth Password Reset");

  const email = "reset-user@test.local";
  const password = "OldPassword123!";
  const newPassword = "NewPassword456!";

  /* -------------------------------------------------------
   * SETUP USER
   * ----------------------------------------------------- */
  await api("POST", "/auth/register", {
    name: "Reset Test User",
    email,
    password,
    role: "PATIENT",
  });

  /* -------------------------------------------------------
   * REQUEST RESET — EXISTING EMAIL
   * ----------------------------------------------------- */
  const req1 = await api(
    "POST",
    "/auth/password-reset/request",
    { email },
    undefined,
    true
  );

  assert.equal(req1.status, 200);
  assert.ok(req1.data?.message || req1.message);

  /* -------------------------------------------------------
   * REQUEST RESET — NON-EXISTENT EMAIL
   * ----------------------------------------------------- */
  const req2 = await api(
    "POST",
    "/auth/password-reset/request",
    { email: "ghost@test.local" },
    undefined,
    true
  );

  assert.equal(req2.status, 200);
  assert.ok(req2.data?.message || req2.message);

  /* -------------------------------------------------------
   * CAPTURE TOKEN (DEV MODE)
   * ----------------------------------------------------- */
  /**
   * IMPORTANT:
   * In dev/test mode, reset tokens are printed to console.
   * You must copy the token from test output once and paste
   * it here on first run.
   *
   * After confirming test logic works, you can automate this
   * later by intercepting logs if desired.
   */
  const RESET_TOKEN = process.env.TEST_RESET_TOKEN;

  if (!RESET_TOKEN) {
    console.warn(
      "⚠️ TEST_RESET_TOKEN not set — skipping confirm step"
    );
    console.warn(
      "➡️  Re-run with: TEST_RESET_TOKEN=<token> npm run test:api"
    );
    return;
  }

  /* -------------------------------------------------------
   * CONFIRM RESET — VALID TOKEN
   * ----------------------------------------------------- */
  const confirm = await api(
    "POST",
    "/auth/password-reset/confirm",
    {
      token: RESET_TOKEN,
      newPassword,
    },
    undefined,
    true
  );

  assert.equal(confirm.status, 200);

  /* -------------------------------------------------------
   * TOKEN CANNOT BE REUSED
   * ----------------------------------------------------- */
  const reuse = await api(
    "POST",
    "/auth/password-reset/confirm",
    {
      token: RESET_TOKEN,
      newPassword: "AnotherPass789!",
    },
    undefined,
    true
  );

  assert.equal(reuse.status, 400);

  /* -------------------------------------------------------
   * LOGIN WITH NEW PASSWORD WORKS
   * ----------------------------------------------------- */
  const login = await api("POST", "/auth/login", {
    email,
    password: newPassword,
  });

  assert.ok(login.accessToken);

  console.log("✅ Phase 1 — Auth Password Reset PASSED");
})();
