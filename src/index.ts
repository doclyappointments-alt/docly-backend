// src/index.ts

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProduction = NODE_ENV === "production";

/* ----------------------- PROCESS SAFETY ------------------------ */
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);

  if (isProduction) {
    await new Promise((res) => setTimeout(res, 500));
    process.exit(1);
  }
});

process.on("unhandledRejection", async (reason) => {
  console.error("Unhandled Rejection:", reason);

  if (isProduction) {
    await new Promise((res) => setTimeout(res, 500));
    process.exit(1);
  }
});

/* ----------------------- CORE IMPORTS ------------------------ */
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pkg from "pino-http";
import prisma from "./common/utils/prismaClient.js";
import { logger } from "./common/utils/logger.js";

/* ----------------------- CONDITIONAL BACKGROUND WORKERS ------------------------ */
if (NODE_ENV !== "test") {
  const { startReminderWorker } = await import(
    "./common/queues/reminderQueue.js"
  );
  startReminderWorker();

  const { startCalendarSyncWorker } = await import(
    "./common/queues/calendarSyncQueue.js"
  );
  startCalendarSyncWorker();
}

/* ----------------------- ROUTE IMPORTS ------------------------ */
import authRoutes from "./modules/auth/auth.routes.js";
import appointmentsRoutes from "./modules/appointments/appointment.routes.js";
import providerRoutes from "./modules/providers/provider.routes.js";
import googleRoutes from "./modules/google/google.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import paymentV2Routes from "./modules/payments/payment.v2.routes.js";
import procedureRoutes from "./modules/procedures/procedure.routes.js";
import paymentWebhookRoutes from "./modules/payments/payment.webhook.routes.js";
import paymentCheckoutRoutes from "./modules/payments/payment.checkout.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import reviewRoutes from "./modules/reviews/review.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import reminderRoutes from "./modules/reminders/reminder.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import slotRoutes from "./modules/slots/slot.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import templateRoutes from "./modules/providerScheduleTemplates/template.routes.js";

/* ----------------------- CRON IMPORTS (SAFE) ------------------------ */
import { startCalendarSyncCron } from "./common/cron/syncCron.js";
import { startWeeklySlotGenerator } from "./common/cron/generateSlotsCron.js";
import { startReminderSafetyCron } from "./common/cron/reminderSafetyCron.js";
import { startExpirePendingAppointmentsCron } from "./common/cron/expirePendingAppointmentsCron.js";
import { startSlotIntegrityRepairCron } from "./common/cron/slotIntegrityRepairCron.js";

/* ----------------------- APP SETUP ------------------------ */
const app = express();
const pinoHttp = (pkg as any).default || pkg;

app.get("/ping", (_req, res) => res.json({ ok: true }));

/* ----------------------- SYSTEM / INFRA ------------------------ */
/* SS-3 — DB LIVENESS PROBE */
app.get("/system/db-check", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (err) {
    const e = err as any;
    res.status(503).json({
      ok: false,
      db: "down",
      error: e?.code || e?.message || "DB_ERROR",
    });
  }
});


/* ----------------------- SECURITY & CORS ------------------------ */
if (isProduction) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
} else {
  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
}

/* ----------------------- ROUTES THAT REQUIRE RAW BODY ------------------------ */
app.use("/payments", paymentWebhookRoutes);

/* ----------------------- CORE MIDDLEWARES ------------------------ */
app.use(express.json());
app.use(cookieParser());

app.use(
  pinoHttp({
    logger,
    customLogLevel: (res: Response, err: unknown) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req: Request) => ({
        method: req.method,
        url: req.url,
      }),
      res: (res: Response) => ({
        statusCode: res.statusCode,
      }),
    },
  }) as any
);


/* ----------------------- ROUTES ------------------------ */
app.use("/checkout", paymentCheckoutRoutes);
app.use("/auth", authRoutes);
app.use("/appointments", appointmentsRoutes);
app.use("/provider", providerRoutes);
app.use("/google", googleRoutes);
app.use("/user", userRoutes);
app.use("/payments", paymentRoutes);
app.use("/payments/v2", paymentV2Routes);
app.use("/procedures", procedureRoutes);
app.use("/reviews", reviewRoutes);
app.use("/notifications", notificationRoutes);
app.use("/reminders", reminderRoutes);
app.use("/admin", adminRoutes);
app.use("/provider-templates", templateRoutes);
app.use("/slots", slotRoutes);
app.use("/search", searchRoutes);
app.use("/api/chat", chatRoutes);

/* ----------------------- GLOBAL ERROR HANDLER ------------------------ */
app.use(
  (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, route: req.url });

    res.status(500).json({
      message: (err as any)?.message,
      stack:
        NODE_ENV === "production" ? undefined : (err as any)?.stack,
    });
  }
);

/* ----------------------- CRON EXECUTION ------------------------ */
const CRON_ENABLED =
  NODE_ENV !== "test" && process.env.CRON_ENABLED === "true";

if (CRON_ENABLED) {
  startCalendarSyncCron();
  startWeeklySlotGenerator();
  startReminderSafetyCron();
  startExpirePendingAppointmentsCron();
  startSlotIntegrityRepairCron();
  console.log("🕒 Cron jobs enabled");
} else {
  console.log("🕒 Cron jobs disabled on this instance");
}

/* ----------------------- DEBUG LOGS ------------------------ */
if (!isProduction) {
  console.log("PORT:", process.env.PORT);
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  console.log("JWT_SECRET present:", !!process.env.JWT_SECRET);
  console.log("NODE_ENV:", NODE_ENV);
}

/* ----------------------- START SERVER ------------------------ */
const PORT = process.env.PORT || 3000;

// Phase 3 (SC-1) — Global error boundary
app.use((err: any, req: any, res: any, next: any) => {
  try {
    console.error("UNHANDLED_ERROR", {
      path: req?.path,
      method: req?.method,
      message: err?.message,
      stack: err?.stack,
    });
  } catch {}

  if (res.headersSent) return next(err);
  return res.status(500).json({ error: "Internal Server Error" });
});

// Phase 3 TEST ROUTE (SC-1 validation only)
app.get("/__phase3_throw", (_req, _res) => {
  throw new Error("PHASE3_FORCED_THROW");
});

export const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server running at http://localhost:${PORT} in ${
      isProduction ? "production" : NODE_ENV
    } mode`
  );
});



/**
 * PHASE3_SC4_PANIC_SAFE_SHUTDOWN
 * Panic-safe shutdown: do not corrupt state on SIGTERM/SIGINT.
 */
const __shutdownOnce = (() => {
  let ran = false;
  return () => {
    if (ran) return true;
    ran = true;
    return false;
  };
})();

async function __safeCloseServer(serverRef: any) {
  if (!serverRef || typeof serverRef.close !== "function") return;
  await new Promise<void>((resolve) => {
    try { serverRef.close(() => resolve()); }
    catch { resolve(); }
  });
}

async function __safePrismaDisconnect() {
  try {
    // @ts-ignore
    if (globalThis?.prisma && typeof globalThis.prisma.$disconnect === "function") {
      // @ts-ignore
      await globalThis.prisma.$disconnect();
    }
  } catch {}
}

async function __safeRedisDisconnect() {
  try {
    // @ts-ignore
    const r = globalThis?.redis;
    if (r && typeof r.quit === "function") await r.quit();
  } catch {}
}

async function __shutdown(signal: string) {
  const already = __shutdownOnce();
  if (already) return;

  try { console.log(`[shutdown] ${signal} received — starting graceful shutdown`); } catch {}

  await __safeCloseServer(server);
  await __safePrismaDisconnect();
  await __safeRedisDisconnect();

  try { console.log(`[shutdown] graceful shutdown complete`); } catch {}
  process.exit(0);
}

process.on("SIGTERM", () => { void __shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void __shutdown("SIGINT"); });

process.on("uncaughtException", (err) => {
  try { console.error("[shutdown] uncaughtException", err); } catch {}
  void __shutdown("uncaughtException").finally(() => process.exit(1));
});

process.on("unhandledRejection", (err) => {
  try { console.error("[shutdown] unhandledRejection", err); } catch {}
  void __shutdown("unhandledRejection").finally(() => process.exit(1));
});
