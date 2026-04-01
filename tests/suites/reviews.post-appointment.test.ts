import assert from "assert";
import { api } from "../helpers/api.js";
import prisma from "../../src/common/utils/prismaClient.js";

console.log("\n▶ Phase 3 — Reviews post-appointment enforcement");

async function registerAndLogin(email, password) {
  await api("POST", "/auth/register", {
    name: "Review User",
    email,
    password,
    role: "PATIENT",
  });

  const login = await api("POST", "/auth/login", { email, password });
  return login.accessToken;
}

(async () => {
  const email = `review_${Date.now()}@test.local`;
  const token = await registerAndLogin(email, "password123");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Test setup failed: user not found");

  // Provider
  const providerUser = await prisma.user.create({
    data: {
      name: "Review Provider",
      email: `reviewprov_${Date.now()}@test.local`,
      password: "password123",
      role: "PROVIDER",
    },
  });

  const provider = await prisma.provider.create({
    data: {
      userId: providerUser.id,
      displayName: "Review Provider",
      specialty: "General",
      status: "VERIFIED",
    },
  });

  // Slot + appointment (NOT completed)
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
      title: "Review test",
      date: slot.start,
      status: "CONFIRMED",
    },
  });

  // ❌ Attempt review before completion (status-based assertion)
  const resBefore = await api(
    "POST", "/reviews", { appointmentId: appointment.id, providerId: provider.id, rating: 5, review: "Great!" },
    token,
  );

  assert.strictEqual(
    resBefore.status,
    400,
    "Review should be blocked before completion"
  );

  // Mark appointment COMPLETED
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "COMPLETED" },
  });

  // ✅ Review after completion
  const res = await api(
    "POST", "/reviews", { appointmentId: appointment.id, providerId: provider.id, rating: 5, review: "Great!" },
    token,
  );

  console.log("DEBUG REVIEW RESPONSE:", JSON.stringify(res, null, 2));

  assert.strictEqual(res.rating, 5);
  assert.strictEqual(res.providerId, provider.id);


  console.log("✅ Post-appointment review enforcement test passed");
})();
