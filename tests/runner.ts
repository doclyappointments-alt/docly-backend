// tests/runner.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.test", override: true });

/**
 * DST-SAFE TEST RUNNER
 *
 * - Forces Europe/London timezone (DST aware)
 * - Starts HTTP server once
 * - Resets DB
 * - Runs auth first
 * - Runs DST tests before general suites
 * - Closes server cleanly at the end
 */

process.env.TS_NODE_PROJECT = "./tsconfig.json";
process.env.TZ = "Europe/London";

import { register } from "ts-node";
import "tsconfig-paths/register.js";

register({
  project: "./tsconfig.json",
  transpileOnly: true,
  esm: true,
  experimentalSpecifierResolution: "node",
});

import fs from "fs";
import path from "path";

//console.log("🕒 Test runner timezone:", process.env.TZ);

/* -------------------------------------------------------
 * START SERVER
 * ----------------------------------------------------- */

//console.log("🚀 Starting test server...");
const { server } = await import("../src/index.ts");

/* -------------------------------------------------------
 * RESET DATABASE
 * ----------------------------------------------------- */

// prisma migrate reset already reset the DB before this runner starts
const { default: prisma } = await import("../src/common/utils/prismaClient.ts");

/* -------------------------------------------------------
 * LOAD TEST SUITES
 * ----------------------------------------------------- */

const suitesDir = path.join(process.cwd(), "tests/suites");

const files = fs
  .readdirSync(suitesDir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort((a, b) => {
    // Auth first
    if (a.includes("auth")) return -1;
    if (b.includes("auth")) return 1;

    // DST tests next
    if (a.includes("dst")) return -1;
    if (b.includes("dst")) return 1;

    // Alphabetical for rest
    return a.localeCompare(b);
  });

//console.log("\n🧪 Running API Test Suites...\n");

/* -------------------------------------------------------
 * RUN SUITES
 * ----------------------------------------------------- */

try {
  for (const file of files) {
    const fullPath = path.join(suitesDir, file);
    //console.log(`\n▶ Running ${file}`);
    await import(fullPath);
  }

  //console.log("\n✅ All tests completed successfully\n");
} finally {
  /* -------------------------------------------------------
   * CLEAN SHUTDOWN
   * ----------------------------------------------------- */

  //console.log("🧹 Shutting down test server...");

  // Small delay to allow async logs/handles to flush
  await new Promise((r) => setTimeout(r, 500));

  await prisma.$disconnect();

  server.close(() => {
    //console.log("🧹 Server closed");
    process.exit(0);
  });
}
