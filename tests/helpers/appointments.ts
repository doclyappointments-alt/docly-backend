//test/helpers/appointments.ts
import { http, authHeader } from "../config/http.ts";

/* -------------------------------------------------------
 * DEBUG WRAPPER
 * ----------------------------------------------------- */
function debug(label: string, res: any) {
  console.log(`\n🔍 ${label} — STATUS:`, res.status);
  console.log("BODY:", JSON.stringify(res.data, null, 2));
}

/* -------------------------------------------------------
 * CREATE APPOINTMENT
 * ----------------------------------------------------- */
export async function createAppointment(user, slotId) {
  const res = await http.post(
    "/appointments",
    { slotId, title: "Test Appointment" },
    authHeader(user.accessToken)
  );

  debug("CREATE APPOINTMENT", res);

  return res.data;
}

/* -------------------------------------------------------
 * CANCEL APPOINTMENT
 * ----------------------------------------------------- */
export async function cancelAppointment(user, appointmentId) {
  const url = `/appointments/${appointmentId}/cancel`;
  const res = await http.patch(url, {}, authHeader(user.accessToken));

  debug("CANCEL APPOINTMENT", res);

  return res.data;
}

/* -------------------------------------------------------
 * RESCHEDULE APPOINTMENT
 * ----------------------------------------------------- */
export async function rescheduleAppointment(user, appointmentId, newSlotId) {
  const url = `/appointments/${appointmentId}/reschedule`;
  const res = await http.post(
    url,
    { newSlotId },
    authHeader(user.accessToken)
  );

  debug("RESCHEDULE", res);

  return res.data;
}

/* -------------------------------------------------------
 * AUDIT LOGS
 * ----------------------------------------------------- */
export async function getAuditLogs(user, appointmentId) {
  const url = `/appointments/${appointmentId}/audit`;
  const res = await http.get(url, authHeader(user.accessToken));

  debug("AUDIT LOGS", res);

  return res.data;
}
