import pino from "pino";

const isTest = process.env.NODE_ENV === "test";

export const logger = isTest
  ? pino({ level: "silent" })
  : pino({
      level: process.env.LOG_LEVEL || "info",
    });
