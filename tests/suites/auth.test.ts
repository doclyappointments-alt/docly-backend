// tests/suites/auth.test.ts
import fs from "fs";
import path from "path";
import { createTestPatient, createTestProvider, loginUser } from "../helpers/auth.ts";
import { http } from "../config/http.ts";

const USERS_FILE = path.join(process.cwd(), "tests/.test-users.json");

function saveTestUsers(data: any) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

async function run() {
  console.log("\n===============================");
  console.log("🧪 Running Auth Suite (Suite 0)");
  console.log("===============================\n");

  /* -------------------------------------------------------
   * PATIENT
   * ----------------------------------------------------- */
  const patient = await createTestPatient();
  console.log("Patient registration OK", patient.role);

  const patientLogin = await loginUser(patient.email, "password123");
  console.log("Patient login OK", !!patientLogin.accessToken);

  /* -------------------------------------------------------
   * PROVIDER
   * ----------------------------------------------------- */
  const provider = await createTestProvider();
  console.log("Provider registration OK", provider.role);

  const providerLogin = await loginUser(provider.email, "password123");
  console.log("Provider login OK", !!providerLogin.accessToken);

  // Fetch providerId
  const providerProfileRes = await http.get("/provider/me", {
    headers: {
      Authorization: `Bearer ${providerLogin.accessToken}`,
    },
  });

  const providerId = providerProfileRes.data.provider.id;

  /* -------------------------------------------------------
   * ADMIN (REGISTER → LOGIN)
   * ----------------------------------------------------- */
  await http.post("/auth/register", {
    name: "Admin User",
    email: "admin@test.local",
    password: "pass1234",
    role: "ADMIN",
  });

  const adminLogin = await loginUser("admin@test.local", "pass1234");
  console.log("Admin login OK", !!adminLogin.accessToken);

  /* -------------------------------------------------------
   * SAVE USERS
   * ----------------------------------------------------- */
  saveTestUsers({
    patient: {
      email: patient.email,
      token: patientLogin.accessToken,
    },
    provider: {
      email: provider.email,
      token: providerLogin.accessToken,
      providerId,
    },
    admin: {
      email: "admin@test.local",
      token: adminLogin.accessToken,
    },
  });

  console.log("\n📁 Saved test users to tests/.test-users.json\n");
  console.log("Auth Suite Complete.\n");
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

