"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const config = require("./config");
const healthRouter = require("./routes/health");
const trackRouter = require("./routes/track");
const metricsRouter = require("./routes/metrics");
const adminRouter = require("./routes/admin");
const { adminAuth } = require("./middleware/admin-auth");
const { createCorsMiddleware } = require("./middleware/cors");
const { createRateLimiter } = require("./middleware/rate-limit");

function jsonErrorHandler(error, req, res, next) {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ ok: false, error: "payload_too_large" });
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  return next(error);
}

const FRONTEND_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_FILES = new Set([
  "analytics.js",
  "compress.html",
  "compress.js",
  "crop.html",
  "crop.js",
  "filter.html",
  "filter.js",
  "home.js",
  "image-support.js",
  "index.html",
  "styles.css",
  "title.html",
  "title.js",
  "workspace.html",
  "workspace.js"
]);

function sendFrontendFile(res, fileName) {
  res.setHeader("Cache-Control", "no-store, no-cache, max-age=0");
  res.sendFile(path.join(FRONTEND_ROOT, fileName));
}

function createFrontendRouter() {
  const router = express.Router();
  router.use("/shared", express.static(path.join(FRONTEND_ROOT, "shared"), {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, max-age=0");
    }
  }));
  router.get("/", (req, res) => sendFrontendFile(res, "index.html"));
  router.get("/:file", (req, res, next) => {
    if (!FRONTEND_FILES.has(req.params.file)) return next();
    sendFrontendFile(res, req.params.file);
  });
  return router;
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");

  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(createCorsMiddleware(config.allowedOrigins, { isProduction: config.isProduction }));
  app.use(express.json({
    limit: config.maxTrackBodySize,
    type: ["application/json", "application/*+json"],
    verify: (req, res, buffer) => {
      req.rawBody = buffer.toString("utf8");
    }
  }));

  app.get("/", (req, res) => {
    res.redirect("/admin/metrics");
  });

  app.use("/app", createFrontendRouter());
  app.use("/api/health", healthRouter);
  app.use(
    "/api/track",
    createRateLimiter({
      max: config.trackRateLimitMax,
      windowMs: config.trackRateLimitWindowMs
    }),
    trackRouter
  );
  app.use("/api/metrics", adminAuth, metricsRouter);
  app.use("/admin", adminAuth, adminRouter);

  app.use(jsonErrorHandler);
  app.use((req, res) => {
    res.status(404).json({ ok: false, error: "not_found" });
  });
  app.use((error, req, res, next) => {
    console.error("[app] unhandled_error", { code: error.code || "unknown" });
    res.status(500).json({ ok: false, error: "server_error" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.info(`[server] pictool-analytics listening on ${config.host}:${config.port}`);
  });
}

module.exports = {
  createApp
};
