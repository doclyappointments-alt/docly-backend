// tests/suites/dst-backward.test.ts

import assert from "assert";
import fetch from "node-fetch";
import { api as apiHelper } from "../helpers/api.ts";
import { __getReminderJob } from "../../src/common/queues/reminderQueue.ts";

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

console.log("\n🕒 DST BACKWARD TEST (Europe/London)");

async function api(method: string, path: string, body?: any, token?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitForReminder(jobId: string, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await __getReminderJob(jobId);
    if (job) return job;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

async function registerAndLogin(
  email: string,
  password: string,
  role: "PATIENT" | "PROVIDER" | "ADMIN",
) {
  await apiHelper("POST", "/auth/register", {
    name: `${role} User`,
    email,
    password,
    role,
  });

  const login = await apiHelper("POST", "/auth/login", { email, password });
  return login.accessToken;
}

export default (async () => {
  const patientToken = await registerAndLogin(
    `patient_dst_back_${Date.now()}@test.local`,
    "password123",
    "PATIENT",
  );

  const providerToken = await registerAndLogin(
    `provider_dst_back_${Date.now()}@test.local`,
    "password123",
    "PROVIDER",
  );

  const adminToken = await registerAndLogin(
    `admin_dst_back_${Date.now()}@test.local`,
    "pass1234",
    "ADMIN",
  );

  /* ---------- VERIFY PROVIDER ---------- */
  const me = await api("GET", "/provider/me", undefined, providerToken);
  assert.equal(me.status, 200);
  const providerId = me.data.provider.id;

  const verify = await api(
    "PATCH",
    "/provider/status",
    { providerId, status: "VERIFIED" },
    adminToken,
  );
  assert.equal(verify.status, 200);

  /* ---------- DST BACKWARD CASE ---------- */
  const firstUTC = new Date("2026-10-25T00:30:00Z");
  const secondUTC = new Date("2026-10-25T01:30:00Z");

  const slotARes = await api(
    "POST",
    "/slots",
    { title: "DST Back A", start: firstUTC.toISOString(), duration: 30 },
    providerToken,
  );

  const slotBRes = await api(
    "POST",
    "/slots",
    { title: "DST Back B", start: secondUTC.toISOString(), duration: 30 },
    providerToken,
  );

  const slotA = slotARes.data.slot.id;
  const slotB = slotBRes.data.slot.id;
  assert.notEqual(slotA, slotB);

  const apptARes = await api(
    "POST",
    "/appointments",
    { slotId: slotA, title: "Appt A" },
    patientToken,
  );

  const apptBRes = await api(
    "POST",
    "/appointments",
    { slotId: slotB, title: "Appt B" },
    patientToken,
  );

  const apptA = apptARes.data.appointment.id;
  const apptB = apptBRes.data.appointment.id;

  await api("PATCH", `/appointments/${apptA}/confirm`, {}, providerToken);
  await api("PATCH", `/appointments/${apptB}/confirm`, {}, providerToken);

  const jobA = await waitForReminder(`appointment-${apptA}-24h`);
  const jobB = await waitForReminder(`appointment-${apptB}-24h`);

  assert.ok(jobA);
  assert.ok(jobB);

  console.log("✅ DST backward duplicate-hour test passed");
})().catch(console.error);
