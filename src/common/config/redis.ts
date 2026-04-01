import { Redis } from "ioredis";

interface RedisConfigOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

// ---- config ----
const redisConfig: RedisConfigOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
};

// ---- client ----
export const redisClient = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
});

// ---- fatal handler ----
function fatalRedis(reason: unknown) {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[Redis] FATAL — transport failure:", msg);
  process.exit(1); // crash-only; systemd restarts
}

// ---- lifecycle ----
(async () => {
  try {
    await redisClient.connect();
    console.log("[Redis] Connected");
  } catch (err) {
    fatalRedis(err);
  }
})();

redisClient.on("error", fatalRedis);
redisClient.on("close", () => fatalRedis("connection closed"));

export default redisClient;
