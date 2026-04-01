import Stripe from "stripe";
import { logger } from "../utils/logger.js";

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

class StripeCircuitBreaker {
  private state: BreakerState = "CLOSED";
  private failures = 0;
  private lastFailure = 0;
  private openLogged = false;

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 30000
  ) {}

  private canRequest() {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailure > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    return true;
  }

  private recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      const wasOpen = this.state === "OPEN";
      this.state = "OPEN";
      if (!wasOpen && !this.openLogged) {
        this.openLogged = true;
        try {
          logger.error({
            component: "stripe",
            breaker: "stripeBreaker",
            state: this.state,
            failures: this.failures,
            failureThreshold: this.failureThreshold,
            resetTimeoutMs: this.resetTimeoutMs,
          }, "SS-10 STRIPE_BREAKER_OPEN");
        } catch {}
      }
    }
  }

  private recordSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (process.env.STRIPE_DISABLED === "true") {
      throw new Error("STRIPE_CIRCUIT_OPEN");
    }

    if (!this.canRequest()) {
      throw new Error("STRIPE_CIRCUIT_OPEN");
    }

    try {
      const res = await fn();
      this.recordSuccess();
      return res;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

public __getState() {
  return {
    state: this.state,
    failures: this.failures,
  };
}

}

export const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

export const stripeBreaker = new StripeCircuitBreaker();
