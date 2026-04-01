import "dotenv/config";
import assert from "assert";
import { api } from "../helpers/api.ts";
import { __getReminderJob } from "../../src/common/queues/reminderQueue.ts";

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function registerAndLogin(
  email: string,
  password: string,
  role: "PATIENT" | "PROVIDER" | "ADMIN",
) {
  await api("POST", "/auth/register", {
    name: `${role} User`,
    email,
    password,
    role,
  });

  const login = await api("POST", "/auth/login", {
    email,
    password,
  });

  // ✅ api() returns accessToken at top-level, not under .data
  return login.accessToken;
}

console.log("\n🕒 DST FORWARD TEST (Europe/London)");

export default (async () => {
  /* ---------------- SETUP USERS ---------------- */
  const patientToken = await registerAndLogin(
    `patient_dst_${Date.now()}@test.local`,
    "password123",
    "PATIENT",
  );

  const providerToken = await registerAndLogin(
    `provider_dst_${Date.now()}@test.local`,
    "password123",
    "PROVIDER",
  );

  const adminEmail = `admin_dst_${Date.now()}@test.local`;

  await api("POST", "/auth/register", {
    name: "Admin User",
    email: adminEmail,
    password: "pass1234",
    role: "ADMIN",
  });

  const adminLogin = await api("POST", "/auth/login", {
    email: adminEmail,
    password: "pass1234",
  });

  // ✅ fixed shape
  const adminToken = adminLogin.accessToken;

  /* ---------------- VERIFY PROVIDER ---------------- */
  const me = await api("GET", "/provider/me", null, providerToken); // ✅ singular
  assert.equal(me.status, 200);

  // ✅ fixed shape (no .data)
  const providerId = me.provider.id;

  const verify = await api(
    "PATCH",
    "/provider/status",
    { providerId, status: "VERIFIED" },
    adminToken,
  );

  assert.equal(verify.status, 200);

  /* ---------------- CREATE SLOT ---------------- */
  // DST forward in UK: 2026-03-29 clocks go forward
  const slotStartUTC = new Date("2026-03-29T00:30:00Z");

  const slotRes = await api(
    "POST",
    "/slots", // ✅ correct endpoint
    {
      title: "DST Forward Slot",
      start: slotStartUTC.toISOString(),
      duration: 30,
    },
    providerToken,
  );

  assert.equal(slotRes.status, 201);

  // ✅ fixed shape
  const slotId = slotRes.slot.id;

  /* ---------------- BOOK ---------------- */
  const apptRes = await api(
    "POST",
    "/appointments",
    { slotId, title: "DST Forward Appointment" },
    patientToken,
  );

  assert.equal(apptRes.status, 201);

  // ✅ fixed shape
  const appointmentId = apptRes.appointment.id;

  /* ---------------- CONFIRM ---------------- */
  const confirmRes = await api(
    "PATCH",
    `/appointments/${appointmentId}/confirm`,
    {},
    providerToken,
  );

  // ✅ confirm endpoint returns status string
  assert.equal(confirmRes.status, "CONFIRMED");

  /* ---------------- REMINDER QUEUE CHECK ---------------- */
  await sleep(300);

  const job24 = await __getReminderJob(`appointment-${appointmentId}-24h`);
  const job1 = await __getReminderJob(`appointment-${appointmentId}-1h`);

  assert.ok(job24);
  assert.ok(job1);

  console.log("✅ DST forward test passed");
})().catch((err) => {
  console.error(err);
});
