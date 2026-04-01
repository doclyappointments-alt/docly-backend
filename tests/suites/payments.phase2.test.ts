import assert from "assert";
import prisma from "../../src/common/utils/prismaClient.js";
import { createPayment } from "../../src/modules/payments/payment.service.js";

console.log("\n▶ Phase 2 — Payments (foundation)");

(async () => {
  // ---- setup: create user + appointment ----
  const user = await prisma.user.create({
    data: {
      name: "Payment Test User",
      email: `payment_test_${Date.now()}@test.local`,
      password: "password123",
    },
  });

  const providerUser = await prisma.user.create({
    data: {
      name: "Provider User",
      email: `provider_test_${Date.now()}@test.local`,
      password: "password123",
      role: "PROVIDER",
    },
  });

  const provider = await prisma.provider.create({
    data: {
      userId: providerUser.id,
      displayName: "Test Provider",
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
      userId: user.id,
      providerId: provider.id,
      slotId: slot.id,
      title: "Payment Test Appointment",
      date: slot.start,
      status: "PENDING",
    },
  });

  // ---- act: create canonical payment ----
  const payment = await createPayment({
    appointmentId: appointment.id,
    userId: user.id,
    amount: 50,
    provider: "stripe",
    providerRef: "pi_test_123",
  });

  // ---- assert: payment exists ----
  assert.ok(payment.id, "Payment ID should exist");
  assert.strictEqual(payment.status, "PENDING");

  const auditLogs = await prisma.paymentAuditLog.findMany({
    where: { paymentId: payment.id },
  });

  assert.strictEqual(
    auditLogs.length,
    1,
    "Payment should have exactly one audit log"
  );

  console.log("✅ Phase 2 payment creation test passed");
})();
