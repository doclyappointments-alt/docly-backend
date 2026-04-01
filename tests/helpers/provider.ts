// tests/helpers/provider.ts

import { http, authHeader } from "../config/http.ts";

/* -------------------------------------------------------
 * PROVIDER PROFILE
 * ----------------------------------------------------- */

export async function updateProviderProfile(user, data) {
  const res = await http.patch(
    "/providers/me/profile",
    data,
    authHeader(user.accessToken)
  );

  return res.data;
}

/* -------------------------------------------------------
 * PROVIDER SLOTS
 * ----------------------------------------------------- */

export async function createProviderSlot(user, body) {
  const res = await http.post(
    "/appointments/slots",
    body,
    authHeader(user.accessToken)
  );

  return res.data.slot || res.data;
}

export async function listProviderSlots(user, providerId) {
  let url = "/appointments/slots";

  if (providerId) {
    url += `?providerId=${providerId}`;
  }

  const res = await http.get(url, authHeader(user.accessToken));

  return res.data.slots || res.data;
}
