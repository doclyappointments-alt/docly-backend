// tests/suites/provider-verification.test.ts

import 'dotenv/config';
import assert from 'assert';
import { api } from '../helpers/api.ts';

console.log('\n🧪 PROVIDER VERIFICATION TEST');

/* -------------------------------------------------------
 * TEST BODY
 * ----------------------------------------------------- */
(async () => {
  let adminToken: string;
  let providerToken: string;
  let providerId: number;

  /* -------------------------------------------------------
   * REGISTER ADMIN
    console.log('ADMIN REGISTER STATUS:', r.status, r);
   * ----------------------------------------------------- */
  {
    const r = await api('POST', '/auth/register', {
      name: 'Admin User',
      email: `admin_${Date.now()}@test.local`,
      password: 'pass1234',
      role: 'ADMIN',
    });

    assert.equal(r.status, 200);
    console.log("ADMIN REGISTER RESPONSE:", r);
    const login = await api('POST','/auth/login',{ email: r.user.email, password: 'pass1234' }); adminToken = login.accessToken;
  console.log("DEBUG adminToken:", adminToken);
    assert.ok(adminToken);
  }

  /* -------------------------------------------------------
   * REGISTER PROVIDER
    console.log('PROVIDER REGISTER STATUS:', r.status, r);
   * ----------------------------------------------------- */
  {
    const r = await api('POST', '/auth/register', {
      name: 'Provider User',
      email: `provider_${Date.now()}@test.local`,
      password: 'pass1234',
      role: 'PROVIDER',
    });

    assert.equal(r.status, 200);
    console.log("PROVIDER REGISTER RESPONSE:", r);
    const loginProv = await api('POST','/auth/login',{ email: r.user.email, password: 'pass1234' }); providerToken = loginProv.accessToken;
  console.log("DEBUG providerToken:", providerToken);
    assert.ok(providerToken);
  }

  /* -------------------------------------------------------
   * FETCH PROVIDER PROFILE (UNVERIFIED)
   * ----------------------------------------------------- */
  {
    const r = await api('GET', '/provider/me', null, providerToken);
  console.log('PROVIDER ME RESPONSE:', JSON.stringify(r, null, 2));
    assert.equal(r.status, 200);

    providerId = r.provider.id;
  console.log("DEBUG providerId:", providerId);
    assert.ok(providerId);
  }

  /* -------------------------------------------------------
   * UNVERIFIED PROVIDER CANNOT CREATE SLOT
   * ----------------------------------------------------- */
  {
    const r = await api(
      'POST',
      '/slots',
      {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        title: 'Blocked Slot',
      },
      providerToken
    );

    assert.equal(
      r.status,
      403,
      `Expected 403 for unverified provider, got ${r.status}`
    );
  }

  /* -------------------------------------------------------
   * ADMIN VERIFIES PROVIDER
   * ----------------------------------------------------- */
  {
    const r = await api(
      'PATCH',
      '/provider/status',
      {
        providerId,
        status: 'VERIFIED',
      },
      adminToken
    );

    assert.equal(r.status, 200);
    assert.equal(r.provider.status, 'VERIFIED');
  }

  /* -------------------------------------------------------
   * VERIFIED PROVIDER CAN ACCESS PROVIDER ACTIONS
   * ----------------------------------------------------- */
  {
    const r = await api('GET', '/provider/me', null, providerToken);
  console.log('PROVIDER ME RESPONSE:', JSON.stringify(r, null, 2));
    assert.equal(r.status, 200);
    assert.ok(r.provider);
  }

  console.log('✅ Provider Verification Suite Passed');
})().catch(err => {
  console.error('❌ Provider Verification Suite Failed');
  console.error(err);
});
