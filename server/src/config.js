"use strict";

const DEFAULT_DEV_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:4180",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:4180"
];

const DEFAULT_PROD_ORIGINS = [
  "https://pictool.com.cn",
  "https://www.pictool.com.cn"
];

function parseList(value, fallback) {
  if (!value) return [...fallback];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const databaseUrl = process.env.DATABASE_URL || "";
const requestedAnalyticsStore = String(process.env.ANALYTICS_STORE || "").trim().toLowerCase();

module.exports = {
  nodeEnv,
  isProduction,
  port: parsePositiveInteger(process.env.PORT, 3000),
  host: process.env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1"),
  databaseUrl,
  databaseSsl: parseBoolean(process.env.DATABASE_SSL),
  analyticsStore: requestedAnalyticsStore || (databaseUrl ? "postgres" : (isProduction ? "postgres" : "file")),
  localEventStorePath: process.env.LOCAL_EVENT_STORE_PATH || "data/analytics-events.jsonl",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  allowedOrigins: parseList(
    process.env.TRACK_ALLOWED_ORIGINS,
    isProduction ? DEFAULT_PROD_ORIGINS : DEFAULT_DEV_ORIGINS
  ),
  eventRetentionDays: parsePositiveInteger(process.env.EVENT_RETENTION_DAYS, 180),
  maxTrackBodySize: process.env.MAX_TRACK_BODY_SIZE || "16kb",
  trackRateLimitMax: parsePositiveInteger(process.env.TRACK_RATE_LIMIT_MAX, 120),
  trackRateLimitWindowMs: parsePositiveInteger(process.env.TRACK_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  trustProxy: parseBoolean(process.env.TRUST_PROXY)
};
