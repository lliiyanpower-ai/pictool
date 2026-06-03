"use strict";

function createCorsMiddleware(allowedOrigins, options = {}) {
  const allowed = new Set(allowedOrigins || []);
  const isProduction = Boolean(options.isProduction);

  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      res.setHeader("Access-Control-Max-Age", "600");
    } else if (origin && isProduction) {
      return res.status(403).json({ ok: false, error: "origin_not_allowed" });
    }

    if (req.method === "OPTIONS") {
      return res.status(origin && !allowed.has(origin) ? 403 : 204).end();
    }

    return next();
  };
}

module.exports = {
  createCorsMiddleware
};
