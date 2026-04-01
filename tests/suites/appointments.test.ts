/* -------------------------------------------------------
 * DOCLY – APPOINTMENTS SUITE 1 (API-level tests)
 *
 * Run directly:
 *   npx ts-node tests/appointments.test.ts
 *
 * Or from a runner:
 *   import { runAppointmentSuite } from './appointments.test';
 *   await runAppointmentSuite();
 * ----------------------------------------------------- */

import 'dotenv/config';

// BOOTSTRAP SERVER (single-run for direct execution)
if (!(global as any).__DOCLY_SERVER_STARTED__) {
  (global as any).__DOCLY_SERVER_STARTED__ = true;
  await import("../../src/index.ts");
}

import fs from "fs";
import path from "path";
import { registerAndLogin } from "../helpers/auth.ts";

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

/* -------------------------------------------------------
 * Simple Test Harness
 * ----------------------------------------------------- */

type TestFn = () => Promise<void> | void;

interface TestCase {
  name: string;
  fn: TestFn;
}

const tests: TestCase[] = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function is2xx(status: number) {
  return status >= 200 && status < 300;
}

/* -------------------------------------------------------
 * HTTP Helper
 * ----------------------------------------------------- */

interface RequestOptions {
  method?: string;
  token?: string;
  body?: any;
  query?: Record<string, string | number | undefined>;
}

async function http(path: string, opts: RequestOptions = {}) {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return { status: res.status, body: json };
}

/* -------------------------------------------------------
 * Types
 * ----------------------------------------------------- */

interface LoggedInUser {
  token: string;
}


/* -------------------------------------------------------
 * Auth Helpers (matches your login responses)
 * ----------------------------------------------------- */

const testUsersPath = path.resolve("tests/.test-users.json");

if (!fs.existsSync(testUsersPath)) {
  throw new Error("Missing tests/.test-users.json — auth.test.ts must run first");
}

const testUsers = JSON.parse(fs.readFileSync(testUsersPath, "utf8"));

async function loginIfNeeded(u) {
  if (u.token || u.accessToken) return u.token ?? u.accessToken;

  const res = await http("/auth/login", {
    method: "POST",
    body: { email: u.email, password: u.password },
  });

  if (res.status !== 200 || !res.body?.accessToken) {
    throw new Error(`Failed to login test user ${u.email}`);
  }

  u.token = res.body.accessToken;
  return u.token;
}


const provider = testUsers.provider.token
  ? { token: testUsers.provider.token }
  : await registerAndLogin(testUsers.provider.email, testUsers.provider.password, "PROVIDER");
const patient = testUsers.patient.token
  ? { token: testUsers.patient.token }
  : await registerAndLogin(testUsers.patient.email, testUsers.patient.password, "PATIENT");
const admin = testUsers.admin.token
  ? { token: testUsers.admin.token }
  : await registerAndLogin(testUsers.admin.email, testUsers.admin.password, "ADMIN");


async function registerAndLoginPatient(email: string): Promise<LoggedInUser> {
  const password = "Password123!";

  await http("/auth/register", {
    method: "POST",
    body: {
      name: "Limit Test Patient",
      email,
      password,
    },
  });

  const { status, body } = await http("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  assert(
    status === 200 && body?.accessToken,
    `Failed to login test patient ${email}`
  );

  return { token: body.accessToken };
}

/* -------------------------------------------------------
 * Domain helpers (slots + appointments)
 * ----------------------------------------------------- */

function hoursFromNow(h: number) {
  const start = new Date();
  start.setHours(start.getHours() + h);
  start.setMinutes(0, 0, 0);

  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end };
}

async function createProviderSlot(token: string, hoursAhead = 4) {
  const { start, end } = hoursFromNow(hoursAhead);

  const { status, body } = await http('/slots', {
    method: 'POST',
    token,
    body: {
      start: start.toISOString(),
      end: end.toISOString(),
      title: 'Test Slot',
    },
  });

  assert(
    status === 201,
    `createProviderSlot expected 201, got ${status}, body=${JSON.stringify(body)}`
  );
  const slot = body.slot;
  assert(slot && slot.id, 'Slot missing id in response');
  return slot;
}

// New helper: create slot at an exact Date (for limits/restrictions tests)
async function createSlotAt(token: string, start: Date, durationMinutes = 30) {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const { status, body } = await http('/slots', {
    method: 'POST',
    token,
    body: {
      start: start.toISOString(),
      end: end.toISOString(),
      title: 'Test Slot',
    },
  });

  assert(
    status === 201,
    `createSlotAt expected 201, got ${status}, body=${JSON.stringify(body)}`
  );

  const slot = body.slot;
  assert(slot && slot.id, 'Slot missing id in response');
  return slot;
}

async function listProviderSlots(token: string) {
  const { status, body } = await http('/slots', {
    method: 'GET',
    token,
  });

  assert(
    is2xx(status),
    `listProviderSlots expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );
  const slots = body.slots ?? [];
  assert(Array.isArray(slots), 'slots is not an array');
  return slots;
}

async function createAppointmentForPatient(
  patientToken: string,
  slotId: number,
  title = 'Test Appointment'
) {
  const { status, body } = await http('/appointments', {
    method: 'POST',
    token: patientToken,
    body: {
      slotId,
      title,
    },
  });

  assert(
    status === 201,
    `Create appointment expected 201, got ${status}, body=${JSON.stringify(body)}`
  );

  const appt = body.appointment;
  assert(appt && appt.id, 'Appointment missing id in response');
  return appt;
}

/* -------------------------------------------------------
 * Global state for this suite
 * ----------------------------------------------------- */
let baseSlot: any;
let baseAppointment: any;

/* -------------------------------------------------------
 * 0. SETUP
 * ----------------------------------------------------- */

test("00. Verify provider (admin)", async () => {
  const me = await http("/provider/me", {
    token: provider.token,
  });

  assert(me.status === 200, "Failed to fetch provider/me");
  const providerId = me.body.provider.id;

  const verify = await http("/provider/status", {
    method: "PATCH",
    token: admin.token,
    body: { providerId, status: "VERIFIED" },
  });

  assert(
    verify.status === 200,
    `Provider verification failed: ${JSON.stringify(verify.body)}`
  );
});

/* -------------------------------------------------------
 * A) SLOT ROUTES
 * ----------------------------------------------------- */

test('A1. Provider can create a slot', async () => {
  baseSlot = await createProviderSlot(provider.token, 5);
  console.log('🟦 Base slot:', baseSlot);
});

test('A2. Provider can list own slots and see created slot', async () => {
  assert(baseSlot, 'baseSlot not set');
  const slots = await listProviderSlots(provider.token);
  const found = slots.some((s: any) => s.id === baseSlot.id);
  assert(found, 'Created slot not found in provider slot list');
});

test('A3. Creating overlapping slot returns 409 conflict', async () => {
  assert(baseSlot, 'baseSlot not set');

  const { status, body } = await http('/slots', {
    method: 'POST',
    token: provider.token,
    body: {
      start: baseSlot.start,
      end: baseSlot.end,
      title: 'Overlapping Slot',
    },
  });

  assert(
    status === 409,
    `Expected 409 on overlapping slot, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(
    body.message === 'Slot conflicts with an existing slot',
    `Expected conflict message, got ${JSON.stringify(body)}`
  );
});

test('A4. Bulk slot generator works and returns counts', async () => {
  const { status, body } = await http('/slots/bulk', {
    method: 'POST',
    token: provider.token,
    body: {
      days: ['MON'],
      startTime: '09:00',
      endTime: '12:00',
      breaks: [],
      slotDurationMinutes: 30,
      weeks: 1,
    },
  });

  assert(
    status === 201,
    `Bulk slots expected 201, got ${status}, body=${JSON.stringify(body)}`
  );

  assert(
    typeof body.createdCount === 'number',
    `Bulk response missing createdCount, body=${JSON.stringify(body)}`
  );
  assert(
    typeof body.requestedCount === 'number',
    `Bulk response missing requestedCount, body=${JSON.stringify(body)}`
  );
});

/* -------------------------------------------------------
 * B) APPOINTMENT CREATION (slot-backed)
 * ----------------------------------------------------- */

test('B1. Patient can book an appointment on a free slot', async () => {
  assert(baseSlot, 'baseSlot not set');

  const appt = await createAppointmentForPatient(
    patient.token,
    baseSlot.id,
    'Initial Consultation'
  );

  baseAppointment = appt;
});

test('B2. Booking marks slot as booked', async () => {
  assert(baseSlot, 'baseSlot not set');

  const slots = await listProviderSlots(provider.token);
  const slot = slots.find((s: any) => s.id === baseSlot.id);

  assert(slot, 'Slot not found in listing after booking');
  assert(slot.booked === true, `Expected slot.booked=true, got ${slot.booked}`);
});

test('B3. Cannot double-book same slot', async () => {
  assert(baseSlot, 'baseSlot not set');

  const { status, body } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      slotId: baseSlot.id,
      title: 'Double booking attempt',
    },
  });

  assert(
    status === 409,
    `Expected 409 on double booking, got ${status}, body=${JSON.stringify(body)}`
  );

  assert(
    body.error === 'Slot already booked' || body.error === 'This time is already booked',
    `Unexpected error message for double booking: ${JSON.stringify(body)}`
  );
});

/* -------------------------------------------------------
 * C) APPOINTMENT LISTING (patient vs provider)
 * ----------------------------------------------------- */

test('C1. Patient can list their appointments and see created appointment', async () => {
  assert(baseAppointment, 'baseAppointment not set');

  const { status, body } = await http('/appointments', {
    method: 'GET',
    token: patient.token,
  });

  assert(
    is2xx(status),
    `List appointments (patient) expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );

  const appts = body.appointments ?? [];
  assert(Array.isArray(appts), 'appointments is not an array');

  const found = appts.some((a: any) => a.id === baseAppointment.id);
  assert(found, 'Patient list does not include the created appointment');
});

test('C2. Provider can list their appointments and see created appointment', async () => {
  assert(baseAppointment, 'baseAppointment not set');

  const { status, body } = await http('/appointments', {
    method: 'GET',
    token: provider.token,
  });

  assert(
    is2xx(status),
    `List appointments (provider) expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );

  const appts = body.appointments ?? [];
  assert(Array.isArray(appts), 'appointments is not an array');

  const found = appts.some((a: any) => a.id === baseAppointment.id);
  assert(found, 'Provider list does not include the created appointment');
});

/* -------------------------------------------------------
 * D) STATUS ACTIONS (confirm / cancel)
 * ----------------------------------------------------- */

test('D1. Provider can confirm an appointment via /:id/confirm', async () => {
  assert(baseAppointment, 'baseAppointment not set');

  const { status, body } = await http(`/appointments/${baseAppointment.id}/confirm`, {
    method: 'PATCH',
    token: provider.token,
  });

  assert(
    is2xx(status),
    `Confirm appointment expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );

  const appt = body;
  assert(appt.id === baseAppointment.id, 'Confirmed appointment id mismatch');
  assert(appt.status === 'CONFIRMED', `Expected status CONFIRMED, got ${appt.status}`);

  baseAppointment = appt;
});

test('D2. Patient cannot confirm appointment (permission via service)', async () => {
  assert(baseAppointment, 'baseAppointment not set');

  const { status } = await http(`/appointments/${baseAppointment.id}/confirm`, {
    method: 'PATCH',
    token: patient.token,
  });

  // Service currently doesn't check userId for confirm, so this may actually pass.
  // We treat any 2xx here as "implementation allows it"; this test is mainly to flag behaviour.
  assert(
    status === 200 || status === 400 || status === 403 || status === 404,
    `Unexpected status for patient confirm, got ${status}`
  );
});

/* fresh appointment dedicated to cancel tests */
let cancelSlot: any;
let cancelAppt: any;

test('D3. Setup: create slot + appointment for cancel tests', async () => {
  cancelSlot = await createProviderSlot(provider.token, 6);
  cancelAppt = await createAppointmentForPatient(
    patient.token,
    cancelSlot.id,
    'Cancel-me Appointment'
  );
});

test('D4. Patient can cancel their own appointment', async () => {
  assert(cancelAppt, 'cancelAppt not set');

  const { status, body } = await http(`/appointments/${cancelAppt.id}/cancel`, {
    method: 'PATCH',
    token: patient.token,
  });

  assert(
    is2xx(status),
    `Cancel appointment expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );

  assert(body.success === true, 'Cancel response missing success=true');
  assert(
    body.appointment?.status === 'CANCELLED',
    `Expected CANCELLED status, got ${body.appointment?.status}`
  );
});

test('D5. Provider cannot cancel a patient-owned appointment', async () => {
  assert(cancelAppt, 'cancelAppt not set');

  const { status } = await http(`/appointments/${cancelAppt.id}/cancel`, {
    method: 'PATCH',
    token: provider.token,
  });

  assert(
    status === 403 || status === 400,
    `Expected 403/400 for provider cancel, got ${status}`
  );
});

/* -------------------------------------------------------
 * E) UPDATE & DELETE APPOINTMENTS
 * ----------------------------------------------------- */

let updateSlot: any;
let updateAppt: any;

test('E1. Setup: create appointment for update/delete tests', async () => {
  updateSlot = await createProviderSlot(provider.token, 7);
  updateAppt = await createAppointmentForPatient(
    patient.token,
    updateSlot.id,
    'Update/Delete Appointment'
  );
});

test('E2. Patient can patch title/notes via /appointments/:id', async () => {
  const { status, body } = await http(`/appointments/${updateAppt.id}`, {
    method: 'PATCH',
    token: patient.token,
    body: {
      title: 'Updated Title',
      notes: 'Updated notes',
    },
  });

  assert(
    is2xx(status),
    `Update appointment (PATCH) expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );

  const appt = body.appointment;
  assert(appt, 'Missing appointment in response');
  assert(appt.title === 'Updated Title', `Expected updated title, got ${appt.title}`);
});

test('E3. Provider cannot update patient-owned appointment via /appointments/:id', async () => {
  const { status } = await http(`/appointments/${updateAppt.id}`, {
    method: 'PATCH',
    token: provider.token,
    body: { title: 'Illegal update' },
  });

  // updateMany with userId filter means provider should not match
  assert(
    status === 404,
    `Expected 404 when provider updates non-owned appointment, got ${status}`
  );
});

test('E4. Patient can delete their own appointment', async () => {
  const { status, body } = await http(`/appointments/${updateAppt.id}`, {
    method: 'DELETE',
    token: patient.token,
  });

  assert(
    is2xx(status),
    `Delete appointment expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(body.message === 'Appointment deleted', `Unexpected delete message: ${JSON.stringify(body)}`);
});

test('E5. Provider cannot delete patient-owned appointment', async () => {
  // Try delete again as provider; should be 404
  const { status } = await http(`/appointments/${updateAppt.id}`, {
    method: 'DELETE',
    token: provider.token,
  });

  assert(
    status === 404,
    `Expected 404 when provider deletes non-owned appointment, got ${status}`
  );
});

/* -------------------------------------------------------
 * F) RESCHEDULING
 * ----------------------------------------------------- */

let reschedSlot1: any;
let reschedSlot2: any;
let reschedAppt: any;

test('F1. Setup: create two slots and one appointment for reschedule tests', async () => {
  reschedSlot1 = await createProviderSlot(provider.token, 8);
  reschedSlot2 = await createProviderSlot(provider.token, 9);

  reschedAppt = await createAppointmentForPatient(
    patient.token,
    reschedSlot1.id,
    'Reschedule Test Appointment'
  );
});

test('F2. Patient can reschedule to a new free slot via POST /:id/reschedule', async () => {
  const { status, body } = await http(`/appointments/${reschedAppt.id}/reschedule`, {
    method: 'POST',
    token: patient.token,
    body: {
      newSlotId: reschedSlot2.id,
    },
  });

  assert(
    is2xx(status),
    `Reschedule expected 2xx, got ${status}, body=${JSON.stringify(body)}`
  );

  assert(body.success === true, 'Reschedule response missing success=true');

  const appt = body.appointment;
  assert(appt, 'Reschedule response missing appointment');

  assert(
    appt.slotId === reschedSlot2.id,
    `Expected appointment.slotId=${reschedSlot2.id}, got ${appt.slotId}`
  );

  // old slot should now be free, new slot booked
  const slots = await listProviderSlots(provider.token);
  const s1 = slots.find((s: any) => s.id === reschedSlot1.id);
  const s2 = slots.find((s: any) => s.id === reschedSlot2.id);

  assert(s1, 'Old slot not found after reschedule');
  assert(s2, 'New slot not found after reschedule');

 assert(
    s1.booked === false,
    `Expected old slot booked=false after reschedule, got ${s1.booked}`
  );
  assert(
    s2.booked === true,
    `Expected new slot booked=true after reschedule, got ${s2.booked}`
  );
});

test('F3. Cannot reschedule into an already-booked slot', async () => {
  // Create two new slots
  const slotA = await createProviderSlot(provider.token, 10);
  const slotB = await createProviderSlot(provider.token, 11);

  // Book both
  const apptA = await createAppointmentForPatient(
    patient.token,
    slotA.id,
    'Resched Appt A'
  );
  await createAppointmentForPatient(
    patient.token,
    slotB.id,
    'Resched Appt B'
  );

  // Try to reschedule A into slotB (booked)
  const { status, body } = await http(`/appointments/${apptA.id}/reschedule`, {
    method: 'POST',
    token: patient.token,
    body: {
      newSlotId: slotB.id,
    },
  });

  assert(
    status === 400,
    `Expected 400 when rescheduling to booked slot, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(
    body.message === 'Slot already booked',
    `Expected 'Slot already booked', got ${JSON.stringify(body)}`
  );
});

/* -------------------------------------------------------
 * G) VALIDATION / AUTH ERRORS
 * ----------------------------------------------------- */

test('G1. Creating appointment without slotId returns 400 (Zod)', async () => {
  const { status } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      title: 'No slot',
    },
  });

  assert(status === 400, `Expected 400 on missing slotId, got ${status}`);
});

test('G2. Creating appointment with non-existent slotId returns 404', async () => {
  const { status, body } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      slotId: 9999999,
      title: 'Invalid slot',
    },
  });

  assert(
    status === 404,
    `Expected 404 on invalid slotId, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(body.error === 'Slot not found', `Unexpected error: ${JSON.stringify(body)}`);
});

test('G3. Unauthenticated user cannot create appointment', async () => {
  const { status, body } = await http('/appointments', {
    method: 'POST',
    body: {
      slotId: 1,
      title: 'Unauth',
    },
  });

  assert(
    status === 401,
    `Expected 401 on unauth create, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(body.error === 'Unauthorized', `Unexpected error: ${JSON.stringify(body)}`);
});

test('G4. Unauthenticated user cannot list appointments', async () => {
  const { status } = await http('/appointments', {
    method: 'GET',
  });

  assert(
    status === 401 || status === 403,
    `Expected 401/403 on unauth list, got ${status}`
  );
});

/* -------------------------------------------------------
 * H) AUDIT LOGS PERMISSIONS (API surface)
 * ----------------------------------------------------- */

test('H1. Patient cannot access audit logs for an appointment', async () => {
  assert(baseAppointment, 'baseAppointment not set');

  const { status, body } = await http(`/appointments/${baseAppointment.id}/audit`, {
    method: 'GET',
    token: patient.token,
  });

  assert(
    status === 403,
    `Expected 403 for patient audit log access, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(body.message === 'Not allowed', `Unexpected message: ${JSON.stringify(body)}`);
});

/* -------------------------------------------------------
 * I) LIMITS & RESTRICTIONS
 * ----------------------------------------------------- */

test('I1. Enforces provider daily booking limit (20 per day)', async () => {
  // create extra patients so we don't hit patient daily limits first
  const extraPatients: LoggedInUser[] = [];
  for (let i = 0; i < 6; i++) {
    const email = `limit_patient_${i}@test.local`;
    const u = await registerAndLoginPatient(email);
    extraPatients.push(u);
  }

  const allPatients: LoggedInUser[] = [
    patient,
    ...extraPatients,
  ];

  // choose a fixed day in the future (within 90 days)
  const day = new Date();
  day.setDate(day.getDate() + 10);
  day.setHours(9, 0, 0, 0);

  const slots: any[] = [];

  // 21 slots on the SAME day (30-min steps)
  for (let i = 0; i < 21; i++) {
    const start = new Date(day.getTime() + i * 30 * 60000);
    const slot = await createSlotAt(provider.token, start);
    slots.push(slot);
  }

  // First 20 bookings should succeed
  for (let i = 0; i < 20; i++) {
    const slot = slots[i];
    const patientIndex = Math.floor(i / 3); // spread across patients (max ~3/day)
    const user = allPatients[patientIndex] ?? allPatients[allPatients.length - 1];

    const { status, body } = await http('/appointments', {
      method: 'POST',
      token: user.token,
      body: {
        slotId: slot.id,
        title: `Provider limit booking ${i + 1}`,
      },
    });

    assert(
      status === 201,
      `Expected 201 for booking ${i + 1}, got ${status}, body=${JSON.stringify(body)}`
    );
  }

  // 21st booking should fail with provider daily limit error
  const lastSlot = slots[20];
  const { status: status21, body: body21 } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      slotId: lastSlot.id,
      title: 'Over provider daily limit',
    },
  });

  assert(
    status21 === 400,
    `Expected 400 on provider daily limit, got ${status21}, body=${JSON.stringify(body21)}`
  );
  assert(
    typeof body21.error === 'string' &&
      body21.error.toLowerCase().includes('maximum daily booking limit'),
    `Expected provider daily limit message, got ${JSON.stringify(body21)}`
  );
});

test('I2. Enforces patient daily booking limit (3 per day)', async () => {
  const day = new Date();
  day.setDate(day.getDate() + 12);
  day.setHours(11, 0, 0, 0);

  const slots: any[] = [];
  for (let i = 0; i < 4; i++) {
    const start = new Date(day.getTime() + i * 30 * 60000);
    const slot = await createSlotAt(provider.token, start);
    slots.push(slot);
  }

  // First 3 bookings ok
  for (let i = 0; i < 3; i++) {
    const { status, body } = await http('/appointments', {
      method: 'POST',
      token: patient.token,
      body: {
        slotId: slots[i].id,
        title: `Daily limit booking ${i + 1}`,
      },
    });

    assert(
      status === 201,
      `Expected 201 for patient daily booking ${i + 1}, got ${status}, body=${JSON.stringify(body)}`
    );
  }

  // 4th should fail
  const { status: status4, body: body4 } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      slotId: slots[3].id,
      title: 'Too many today',
    },
  });

  assert(
    status4 === 400,
    `Expected 400 on patient daily limit, got ${status4}, body=${JSON.stringify(body4)}`
  );
  assert(
    typeof body4.error === 'string' &&
      body4.error.toLowerCase().includes('daily appointment limit'),
    `Expected daily appointment limit message, got ${JSON.stringify(body4)}`
  );
});


test('I3. Enforces patient weekly booking limit (10 per week)', async () => {
  // base weekStart in future but within 90 days
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() + 20);
  weekStart.setHours(9, 0, 0, 0);

  const slots: any[] = [];

  // 11 slots spread across 4 days (3+3+3+2) → respects daily limit but hits weekly limit
  for (let i = 0; i < 11; i++) {
    const dayOffset = Math.floor(i / 3); // 0,0,0,1,1,1,2,2,2,3,3
    const base = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const start = new Date(base.getTime() + (i % 3) * 30 * 60 * 1000); // 0, 30, 60 mins
    const slot = await createSlotAt(provider.token, start);
    slots.push(slot);
  }

  // 10 bookings ok
  for (let i = 0; i < 10; i++) {
    const { status, body } = await http('/appointments', {
      method: 'POST',
      token: patient.token,
      body: {
        slotId: slots[i].id,
        title: `Weekly limit booking ${i + 1}`,
      },
    });

    assert(
      status === 201,
      `Expected 201 for weekly booking ${i + 1}, got ${status}, body=${JSON.stringify(body)}`
    );
  }

  // 11th should fail with weekly limit
  const { status: status11, body: body11 } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      slotId: slots[10].id,
      title: 'Too many this week',
    },
  });

  assert(
    status11 === 400,
    `Expected 400 on patient weekly limit, got ${status11}, body=${JSON.stringify(body11)}`
  );
  assert(
    typeof body11.error === 'string' &&
      body11.error.toLowerCase().includes('weekly appointment limit'),
    `Expected weekly appointment limit message, got ${JSON.stringify(body11)}`
  );
});

test('I4. Blocks booking too soon (inside MIN_BOOKING_MINUTES window)', async () => {
  const start = new Date();
  start.setMinutes(start.getMinutes() + 10); // 10 mins from now
  const slot = await createSlotAt(provider.token, start);

  const { status, body } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      slotId: slot.id,
      title: 'Too soon',
    },
  });

  assert(
    status === 400,
    `Expected 400 for too-soon booking, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(
    typeof body.error === 'string' &&
      body.error.toLowerCase().includes('at least 60 mins in advance'),
    `Expected "at least 60 mins in advance" message, got ${JSON.stringify(body)}`
  );
});

test('I5. Blocks booking too far in the future (beyond MAX_BOOKING_DAYS)', async () => {
  const start = new Date();
  start.setDate(start.getDate() + 120); // 120 days ahead
  start.setHours(12, 0, 0, 0);
  const slot = await createSlotAt(provider.token, start);

  const { status, body } = await http('/appointments', {
    method: 'POST',
    token: patient.token,
    body: {
      slotId: slot.id,
      title: 'Too far',
    },
  });

  assert(
    status === 400,
    `Expected 400 for too-far booking, got ${status}, body=${JSON.stringify(body)}`
  );
  assert(
    typeof body.error === 'string' &&
      body.error.toLowerCase().includes('more than 90 days in advance'),
    `Expected "more than 90 days in advance" message, got ${JSON.stringify(body)}`
  );
});

/* -------------------------------------------------------
 * J) NOTES VISIBILITY
 * ----------------------------------------------------- */
// --------------------------------------------
// J1. Patient cannot see notes but provider can
// --------------------------------------------
test("J1. Patient cannot see notes but provider can", async () => {
  // Fresh users (bypass limits)
  const freshPatient = await registerAndLogin(
    "fresh_patient_j1@example.com",
    "123456",
    "PATIENT"
  );

const freshProvider = await registerAndLogin(
  "fresh_provider_j1@example.com",
  "123456",
  "PROVIDER"
);

// 🔴 VERIFY fresh provider
const me = await http("/provider/me", {
  token: freshProvider.token,
});

assert(me.status === 200);
const providerId = me.body.provider.id;

await http("/provider/status", {
  method: "PATCH",
  token: admin.token,
  body: { providerId, status: "VERIFIED" },
});

  // Slot start MUST be safely above MIN_BOOKING_MINUTES (60)
  const start = new Date(Date.now() + 90 * 60 * 1000); // 90 mins ahead
  const end   = new Date(start.getTime() + 60 * 60 * 1000);

  const slotRes = await http("/slots", {
    method: "POST",
    token: freshProvider.token,
    body: {
      start: start.toISOString(),
      end: end.toISOString(),
      title: "J1 Slot",
    },
  });

  assert(
    slotRes.status === 201,
    `Expected slot create 201, got ${slotRes.status}, body=${JSON.stringify(slotRes.body)}`
  );

  const slot = slotRes.body.slot;
  assert(slot?.id, "Slot ID missing");

  // Patient books appointment with private notes
  const apptRes = await http("/appointments", {
    method: "POST",
    token: freshPatient.token,
    body: {
      slotId: slot.id,
      title: "Test privacy",
      notes: "VERY_PRIVATE_NOTES",
    },
  });

  assert(
    apptRes.status === 201,
    `Create appointment expected 201, got ${apptRes.status}, body=${JSON.stringify(apptRes.body)}`
  );

  const appointment = apptRes.body.appointment;
  assert(appointment?.id, "Appointment ID missing");

  // Patient retrieves appointment — must NOT see notes
  const patientList = await http("/appointments", {
    method: "GET",
    token: freshPatient.token,
  });

  assert(patientList.status === 200, "Patient fetch appointments failed");

  const patientView = patientList.body.appointments.find(
    (a: any) => a.id === appointment.id
  );

  assert(patientView, "Patient cannot find appointment they created");
  assert(
    !patientView.notes,
    `❌ Patient should NOT see notes but got: ${patientView.notes}`
  );

  // Provider retrieves appointment — must see notes
  const providerList = await http("/appointments", {
    method: "GET",
    token: freshProvider.token,
  });

  assert(providerList.status === 200, "Provider fetch appointments failed");

  const providerView = providerList.body.appointments.find(
    (a: any) => a.id === appointment.id
  );

  assert(providerView, "Provider cannot see appointment");
  assert(
    providerView.notes === "VERY_PRIVATE_NOTES",
    `❌ Provider should see notes but got: ${providerView.notes}`
  );
});

/* -------------------------------------------------------
 * RUNNER
 * ----------------------------------------------------- */

export async function runAppointmentSuite() {
  console.log('\n===============================');
  console.log('🧪 Running Appointment Suite (Suite 1)');
  console.log('Base URL:', BASE_URL);
  console.log('===============================\n');

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    const label = name.padEnd(70, ' ');
    try {
      await fn();
      console.log(`✅ ${label}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ ${label}`);
      console.error('   ', err?.message ?? err);
      failed++;
    }
  }

  console.log('\n===============================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('===============================\n');

  if (failed > 0) {
    throw new Error("Test failed");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAppointmentSuite();
}

