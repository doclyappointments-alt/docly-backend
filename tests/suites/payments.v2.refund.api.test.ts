import assert from "assert";
import { api } from "../helpers/api.js";
import prisma from "../../src/common/utils/prismaClient.js";

console.log("\n▶ Phase 2 — Payments v2 Refund API");

async function registerAndLogin(email: string, password: string) {
  await api("POST", "/auth/register", {
    name: "Refund User",
    email,
    password,
    role: "PATIENT",
  });

  const login = await api("POST", "/auth/login", {
    email,
    password,
  });

  return login.accessToken;
}

(async () => {
  const token = await registerAndLogin(
    `refund_${Date.now()}@test.local`,
    "password123"
  );

  // Provider setup
  const providerUser = await prisma.user.create({
    data: {
      name: "Refund Provider",
      email: `refund_prov_${Date.now()}@test.local`,
      password: "password123",
      role: "PROVIDER",
    },
  });

  const provider = await prisma.provider.create({
    data: {
      user: { connect: { id: providerUser.id } },
        displayName: "Refund Provider",
      bio: "Test bio",
      latitude: 51.5074,
      longitude: -0.1278,
      specialty: "General",
      status: "VERIFIED",
    },
  });

  const slot = await prisma.appointmentSlot.create({
    data: { providerId: provider.id, start: new Date(Date.now() + 3600000), end: new Date(Date.now() + 5400000), title: "Refund Test Slot" },
  });

  const appointment = await prisma.appointment.create({
    data: {
      userId: providerUser.id,
      providerId: provider.id,
      slotId: slot.id,
      title: "Refund test",
      date: slot.start,
    },
  });

  // Create payment
  const createRes = await api(
    "POST",
    "/payments/v2",
    { appointmentId: appointment.id, amount: 80, paymentType: "CARD" },
    token
  );
  console.log("DEBUG createRes:", JSON.stringify(createRes, null, 2));


  const paymentId = createRes.payment.id;
  assert.ok(paymentId, "Payment should be created");

  // Refund payment
  const refundRes = await api(
    "POST",
    `/payments/v2/${paymentId}/refund`,
    {},
    token
  );
  console.log("DEBUG refundRes:", JSON.stringify(refundRes, null, 2));


  assert.strictEqual(
    refundRes.payment.status,
    "REFUNDED",
    "Payment should be refunded"
  );

  const audits = await prisma.paymentAuditLog.findMany({
    where: { paymentId },
  });

  assert.ok(audits.length >= 2, "Audit log should include refund");

  console.log("✅ Payments v2 refund API test passed");
})();
