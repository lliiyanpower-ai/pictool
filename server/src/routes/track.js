"use strict";

const express = require("express");
const store = require("../store");
const { getRefererHost, getUserAgentBucket } = require("../utils/user-agent");
const { hasBlockedRawImageContent, sanitizeTrackRequest } = require("../utils/sanitize");

const router = express.Router();
const DROPPED_EVENT_NAMES = new Set(["filter_preset_selected"]);

router.post("/", async (req, res) => {
  if (!req.is("application/json")) {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  if (hasBlockedRawImageContent(req.rawBody)) {
    return res.status(400).json({ ok: false, error: "image_payload_rejected" });
  }

  let sanitized;
  try {
    sanitized = sanitizeTrackRequest(req.body);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ ok: false, error: error.message || "invalid_payload" });
  }

  const fields = {
    ...sanitized.fields,
    user_agent_bucket: getUserAgentBucket(req.headers["user-agent"]),
    referer_host: getRefererHost(req.headers.referer || req.headers.referrer)
  };

  if (DROPPED_EVENT_NAMES.has(sanitized.eventName)) {
    return res.status(200).json({ ok: true, dropped: true });
  }

  try {
    await store.insertEvent(sanitized.eventName, fields);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[track] insert_failed", { code: error.code || "unknown" });
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

module.exports = router;
