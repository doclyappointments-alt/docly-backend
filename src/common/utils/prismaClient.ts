import { PrismaClient } from "@prisma/client";

/**
 * SS-3 — DB CIRCUIT BREAKER (Prisma Client Extension)
 * Long-term isolation layer:
 * - Wraps prisma.<model>.<op> via $extends query interception
 * - Fast-fails when OPEN
 * - HALF_OPEN allows one probe at a time after timeout
 */

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 15000;

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

let failureCount = 0;
let circuitState: CircuitState = "CLOSED";
let lastFailureTime = 0;
let halfOpenProbeInFlight = false;

function nowMs() {
  return Date.now();
}

function shouldTripOnError(err: any): boolean {
  const code = err?.code || err?.errorCode;
  const msg = String(err?.message || "");

  // Prisma connection-ish codes
  if (typeof code === "string" && /^P10\d{2}$/.test(code)) return true;

  // Message-based fallbacks
  if (msg.includes("Can't reach database server")) return true;
  if (msg.includes("ECONNREFUSED")) return true;
  if (msg.includes("Connection terminated")) return true;
  if (msg.toLowerCase().includes("connection") && msg.toLowerCase().includes("refused")) return true;

  return false;
}

function canAttempt(): boolean {
  if (circuitState === "CLOSED") return true;

  if (circuitState === "OPEN") {
    if (nowMs() - lastFailureTime > RESET_TIMEOUT_MS) {
      circuitState = "HALF_OPEN";
      halfOpenProbeInFlight = false;
      return true;
    }
    return false;
  }

  // HALF_OPEN: allow ONE probe at a time
  if (halfOpenProbeInFlight) return false;
  return true;
}

function recordSuccess() {
  failureCount = 0;
  circuitState = "CLOSED";
  lastFailureTime = 0;
  halfOpenProbeInFlight = false;
}

function recordFailure() {
  failureCount++;
  lastFailureTime = nowMs();
  halfOpenProbeInFlight = false;

  if (failureCount >= FAILURE_THRESHOLD) {
    circuitState = "OPEN";
  }
}

export function getDbCircuitState() {
  return {
    state: circuitState,
    failureCount,
    lastFailureTime,
    resetTimeoutMs: RESET_TIMEOUT_MS,
    failureThreshold: FAILURE_THRESHOLD,
  };
}

const raw = new PrismaClient();

/**
 * Prisma query interception (authoritative SS-3 enforcement point)
 * NOTE: typings for $extends callbacks vary across Prisma versions, so we keep the callback args typed as any.
 */
const prisma = raw.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }: any) {
        if (!canAttempt()) {
          const err: any = new Error("DB_CIRCUIT_OPEN");
          err.code = "DB_CIRCUIT_OPEN";
          err.httpStatus = 503;
          throw err;
        }

        if (circuitState === "HALF_OPEN") {
          halfOpenProbeInFlight = true;
        }

        try {
          const res = await query(args);
          recordSuccess();
          return res;
        } catch (err: any) {
          if (shouldTripOnError(err)) {
            recordFailure();
          } else {
            // non-connectivity errors shouldn't poison the circuit
            halfOpenProbeInFlight = false;
          }
          throw err;
        }
      },
    },
  },
});

// expose globally for shutdown layer
// @ts-ignore
globalThis.prisma = prisma;

export default prisma;
