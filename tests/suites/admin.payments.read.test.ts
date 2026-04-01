import assert from "assert";
import { api } from "../helpers/api.js";
import prisma from "../../src/common/utils/prismaClient.js";

console.log("\n▶ Phase 2 — Admin Payments Read APIs");

async function registerAndLoginAdmin(email: string, password: string) {
  await api("POST", "/auth/register", {
    name: "Admin User",
    email,
    password,
    role: "ADMIN",
  });

  const login = await api("POST", "/auth/login", {
    email,
    password,
  });

  return login.accessToken;
}

(async () => {
  const adminToken = await registerAndLoginAdmin(
    `admin_${Date.now()}@test.local`,
    "password123",
  );

  // Create user + provider + appointment + payment directly (transaction)
  const { user, provider, slot, appointment, payment } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: "Pay User",
        email: `payuser_${Date.now()}@test.local`,
        password: "password123",
        role: "PATIENT",
      },
    });

    const providerUser = await tx.user.create({
      data: {
        name: "Admin Prov",
        email: `adminprov_${Date.now()}@test.local`,
        password: "password123",
        role: "PROVIDER",
      },
    });

    const provider = await tx.provider.create({
      data: {
        userId: providerUser.id,
        displayName: "Admin Provider",
        specialty: "General",
        status: "VERIFIED",
      },
    });

    const slot = await tx.appointmentSlot.create({
      data: {
        providerId: provider.id,
        start: new Date(Date.now() + 3600000),
        end: new Date(Date.now() + 5400000),
      },
    });

    const appointment = await tx.appointment.create({
      data: {
        userId: user.id,
        providerId: provider.id,
        slotId: slot.id,
        title: "Admin payment test",
        date: slot.start,
      },
    });

    const payment = await tx.payment.create({
      data: {
        appointmentId: appointment.id,
        userId: user.id,
        amount: 100,
        currency: "GBP",
        provider: "stripe",
        providerRef: "pi_test_admin",
        status: "CONFIRMED",
      },
    });

    return { user, provider, slot, appointment, payment };
  });

  // --- TEST: list payments ---
  const listRes = await api("GET", "/admin/payments", null, adminToken);
  console.log("ADMIN PAYMENTS RESPONSE:", JSON.stringify(listRes, null, 2));
  assert.ok(Array.isArray(listRes.payments), "Payments list should be array");
  assert.ok(
    listRes.payments.some((p: any) => p.id === payment.id),
    "Created payment should appear in admin list",
  );

  // --- TEST: audit trail ---
  const auditRes = await api(
    "GET",
    `/admin/payments/${payment.id}/audit`,
    null,
    adminToken,
  );

  assert.ok(auditRes.payment, "Audit payment should exist");
  assert.strictEqual(
    auditRes.payment.id,
    payment.id,
    "Audit payment ID should match",
  );

  console.log("✅ Admin payment read APIs test passed");
})();
