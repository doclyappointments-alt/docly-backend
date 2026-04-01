import assert from "assert";
import { api } from "../helpers/api.js";
import prisma from "../../src/common/utils/prismaClient.js";

console.log("\n▶ Phase 2 — Payments v2 API");

async function registerAndLogin(email: string, password: string, role = "PATIENT") {
  await api("POST", "/auth/register", {
    name: "Payment V2 User",
    email,
    password,
    role,
  });

  const login = await api("POST", "/auth/login", {
    email,
    password,
  });

  return login.accessToken;
}

(async () => {
  const token = await registerAndLogin(
    `payv2_${Date.now()}@test.local`,
    "password123"
  );

  // create provider
  const providerUser = await prisma.user.create({
    data: {
      name: "Provider",
      email: `prov_v2_${Date.now()}@test.local`,
      password: "password123",
      role: "PROVIDER",
    },
  });

  const provider = await prisma.provider.create({
    data: {
      userId: providerUser.id,
      displayName: "Provider V2",
      specialty: "General",
      status: "VERIFIED",
    },
  });

  const slot = await prisma.appointmentSlot.create({
    data: {
      providerId: provider.id,
      start: new Date(Date.now() + 3600000),
      end: new Date(Date.now() + 5400000),
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      userId: providerUser.id,
      providerId: provider.id,
      slotId: slot.id,
      title: "Payment v2 test",
      date: slot.start,
    },
  });

  const res = await api(
    "POST",
    "/payments/v2",
    { appointmentId: appointment.id, amount: 45, paymentType: "CARD" },
    token
  );

  assert.ok(res.payment?.id, "Payment ID should exist");

  const payment = await prisma.payment.findUnique({
    where: { id: res.payment.id },
  });

  assert.ok(payment, "Canonical payment should exist");
  assert.strictEqual(payment.amount, 45);

  console.log("✅ Payments v2 API test passed");
})();
