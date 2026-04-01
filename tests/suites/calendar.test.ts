// tests/suites/calendar.test.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import assert from 'node:assert';
import prisma from '../../src/common/utils/prismaClient.ts';

import {
  connectGoogleCalendar,
  handleGoogleOAuthCallback,
  syncGoogleCalendarEvents,
} from '../../src/modules/google/google.controller.ts';

import {
  syncProviderGoogleEvents,
  syncAllProvidersGoogleEvents,
} from '../../src/modules/google/googleSync.service.ts';

import {
  mockGoogleOAuth,
  mockGoogleCalendar,
  restoreGoogleMocks,
} from '../utils/googleMock.ts';

process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/google/callback';

type MockReq = any;
type MockRes = {
  statusCode: number;
  body: any;
  redirectedTo?: string;
  status: (c: number) => MockRes;
  json: (b: any) => MockRes;
  redirect: (url: string) => void;
};

function createMockRes(): MockRes {
  return {
    statusCode: 200,
    body: null,
    redirectedTo: undefined,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    redirect(url) { this.statusCode = 302; this.redirectedTo = url; },
  };
}

async function run() {
  console.log('\n=== GOOGLE CALENDAR TEST SUITE ===\n');
  // CLEAN DB (handled by test runner)

// ---------------- C1a: missing userId ----------------
  {
    const req = { query: {} };
    const res = createMockRes();

    await connectGoogleCalendar(req, res);
    assert.strictEqual(res.statusCode, 400);
  }

  // ---------------- Setup test provider user ----------------
  const user = await prisma.user.create({
    data: {
      email: `provider-calendar_${Date.now()}@test.local`,
      password: 'dummy-hash',
      name: 'Calendar Provider',
      role: 'PROVIDER',
    },
  });

  // ---------------- C1b: redirect test ----------------
  {
    const req = { query: { userId: String(user.id) } };
    const res = createMockRes();

    await connectGoogleCalendar(req, res);
    assert.strictEqual(res.statusCode, 302);
  }

  // ---------------- C2: OAuth callback ----------------
  mockGoogleOAuth({
    access_token: 'mock-access',
    refresh_token: 'mock-refresh',
    expiry_date: Date.now() + 3600_000,
  });

  {
    const req = { query: { code: 'mock-code', state: String(user.id) } };
    const res = createMockRes();

    await handleGoogleOAuthCallback(req, res);

    assert.strictEqual(res.statusCode, 200);

    const provider = await prisma.provider.findUnique({
      where: { userId: user.id },
    });

    assert.ok(provider);
    assert.strictEqual(provider?.googleAccessToken, 'mock-access');
    assert.strictEqual(provider?.googleRefreshToken, 'mock-refresh');
  }

  const provider = await prisma.provider.findUniqueOrThrow({
    where: { userId: user.id },
  });

  // ---------------- C3: sync 2 events ----------------
  const now = new Date();
  const later = new Date(now.getTime() + 3600_000);

  mockGoogleCalendar([
    {
      id: 'g-event-1',
      summary: 'Google Event One',
      start: { dateTime: now.toISOString() },
      end: { dateTime: later.toISOString() },
      updated: now.toISOString(),
    },
    {
      id: 'g-event-2',
      summary: 'Google Event Two',
      start: { dateTime: now.toISOString() },
      end: { dateTime: later.toISOString() },
      updated: later.toISOString(),
    },
  ]);

  {
    const req = { userId: user.id };
    const res = createMockRes();

    await syncGoogleCalendarEvents(req, res);

    assert.strictEqual(res.statusCode, 200);
    console.log("SYNC RESPONSE BODY:", res.body);
console.log("ASSERT PROBE:", res.body.eventCount, typeof res.body.eventCount, Number(res.body.eventCount) === 2);
console.log("ASSERT MARKER", Date.now(), "\nSTACK:\n", new Error().stack);
assert.strictEqual(Number(res.body.eventCount), 2);
  }

  // ---------------- C4: tokenless provider should SKIP ----------------
  const tokenlessUser = await prisma.user.create({
    data: {
      email: `tokenless_${Date.now()}@test.local`,
      password: 'dummy-hash',
      name: 'Tokenless User',
      role: 'PROVIDER',
    },
  });

  const tokenlessProvider = await prisma.provider.create({
    data: {
      userId: tokenlessUser.id,
      displayName: 'Tokenless',
      specialty: '',
      bio: '',
      latitude: 0,
      longitude: 0,
      googleAccessToken: null,
      googleRefreshToken: null,
    },
  });

  await syncProviderGoogleEvents(tokenlessProvider.id);

  const tokenlessEvents = await prisma.googleEvent.findMany({
    where: { userId: tokenlessUser.id },
  });

  assert.strictEqual(tokenlessEvents.length, 0);

// ---------------- C3c: retry on transient Google failure ----------------
{
  let callCount = 0;

  mockGoogleCalendar(async () => {
    callCount++;

    // First call fails with retryable error
    if (callCount === 1) {
      const err: any = new Error("Rate limit");
      err.response = { status: 429 };
      throw err;
    }

    // Second call succeeds
    return [
      {
        id: 'retry-event-1',
        summary: 'Retry Event',
        start: { dateTime: now.toISOString() },
        end: { dateTime: later.toISOString() },
        updated: now.toISOString(),
      },
    ];
  });

  await syncProviderGoogleEvents(provider.id);

  const events = await prisma.googleEvent.findMany({
    where: { providerId: provider.id },
  });

  assert.ok(events.some(e => e.eventId === 'retry-event-1'));
}

  // ---------------- AFTER C4: give ALL providers tokens ----------------
  await prisma.provider.updateMany({
    where: {},
    data: {
      googleAccessToken: 'test-access',
      googleRefreshToken: 'test-refresh',
    },
  });

await prisma.googleEvent.deleteMany({ where: { userId: provider.userId } });


  // ---------------- C5: provider sync saves event ----------------

mockGoogleCalendar([
  {
    id: "svc-event-1",
    summary: "Service Event One",
    start: { dateTime: now.toISOString() },
    end: { dateTime: later.toISOString() },
    updated: now.toISOString(),
    status: "confirmed",
  },
]);

// Ensure THIS provider has tokens BEFORE the sync
await prisma.provider.update({
  where: { id: provider.id },
  data: {
    googleAccessToken: "svc-token",
    googleRefreshToken: "svc-refresh",
  },
});

await syncProviderGoogleEvents(provider.id);

const svcEvents = await prisma.googleEvent.findMany({
  where: { userId: provider.userId },
});

assert.ok(svcEvents.length > 0);
assert.strictEqual(svcEvents[0].eventId, "svc-event-1");


  // ---------------- C6: GLOBAL SYNC ----------------
  mockGoogleCalendar([
    {
      id: 'svc-all-1',
      summary: 'Global Sync Event',
      start: { dateTime: now.toISOString() },
      end: { dateTime: later.toISOString() },
      updated: now.toISOString(),
    },
  ]);

  await syncAllProvidersGoogleEvents();

const globalEvents = await prisma.googleEvent.findMany({
  where: { userId: provider.userId, eventId: 'svc-all-1' },
});

  assert.ok(globalEvents.length >= 1);

  restoreGoogleMocks();

  console.log('\n✅ GOOGLE CALENDAR TESTS PASSED\n');
}

run().catch((err) => {
  console.error('❌ GOOGLE CALENDAR TESTS FAILED');
  console.error(err);
  restoreGoogleMocks();
  throw new Error("Test aborted");
});
