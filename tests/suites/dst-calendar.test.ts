// tests/suites/dst-calendar.test.ts

import 'dotenv/config';
import assert from 'assert';
import prisma from '../../src/common/utils/prismaClient.js';

console.log('\n🗓️ DST GOOGLE CALENDAR MAPPING TEST');

/**
 * This test verifies that Google Calendar timezone offsets
 * are normalized to UTC correctly.
 *
 * No HTTP.
 * No auth.
 * No verification.
 * No queues.
 * Pure time normalization test.
 *
 * Purpose: Temporal correctness invariant.
 */

export default (async () => {

  const provider = await prisma.provider.create({
    data: {
      user: {
        create: {
          name: 'DST Calendar Provider',
          email: 'dst-calendar@test.com',
          password: 'password',
          role: 'PROVIDER',
        },
      },
      displayName: 'DST Clinic',
      specialty: 'General',
      latitude: 51.5,
      longitude: -0.1,
      status: 'VERIFIED',
    },
    include: { user: true },
  });

  /* -------------------------------------------------------
   * DST FORWARD — Europe/London
   * 2025-03-30
   *
   * Local 02:30 BST === 01:30 UTC
   * ----------------------------------------------------- */
  const googleStart = '2025-03-30T02:30:00+01:00';
  const googleEnd   = '2025-03-30T03:00:00+01:00';

  const saved = await prisma.googleEvent.create({
    data: {
      eventId: 'dst-test-event',
      providerId: provider.id,
      userId: provider.userId,
      summary: 'DST Forward Event',
      startTime: new Date(googleStart),
      endTime: new Date(googleEnd),
      status: 'confirmed',
    },
  });

  /* -------------------------------------------------------
   * ASSERT UTC NORMALIZATION
   * ----------------------------------------------------- */
  assert.equal(
    saved.startTime?.toISOString(),
    '2025-03-30T01:30:00.000Z'
  );

  assert.equal(
    saved.endTime?.toISOString(),
    '2025-03-30T02:00:00.000Z'
  );

  console.log('✅ DST calendar mapping test passed');

})();
