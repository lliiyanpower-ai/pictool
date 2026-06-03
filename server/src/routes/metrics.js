"use strict";

const express = require("express");
const { getDateRange } = require("../utils/date-range");
const metrics = require("../utils/metrics");
const insightsService = require("../services/insights-service");

const router = express.Router();

function handleMetricsError(error, res) {
  if (error.statusCode === 400) {
    return res.status(400).json({ ok: false, error: error.message });
  }
  console.error("[metrics] query_failed", { code: error.code || "unknown" });
  return res.status(500).json({ ok: false, error: "server_error" });
}

router.get("/summary", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    return res.json(await metrics.getSummary(range));
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.get("/tools", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    return res.json(await metrics.getTools(range));
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.get("/events", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    return res.json(await metrics.getEvents(range));
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.get("/presets", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    return res.json(await metrics.getPresets(range));
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.get("/failures", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    return res.json(await metrics.getFailures(range));
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    return res.json(await metrics.getSessions(range, {
      filter: req.query.filter || "all",
      outcome: req.query.outcome || "all",
      tool: req.query.tool || "",
      limit: req.query.limit,
      offset: req.query.offset
    }));
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.get("/sessions/:session_id", async (req, res) => {
  try {
    const detail = await metrics.getSessionDetail(req.params.session_id);
    if (!detail) return res.status(404).json({ ok: false, error: "session_not_found" });
    return res.json(detail);
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.get("/insights", async (req, res) => {
  try {
    const range = getDateRange(req.query);
    return res.json(await insightsService.listInsights(range));
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

router.post("/insights/generate", async (req, res) => {
  try {
    const range = getDateRange(req.body || {});
    const result = await insightsService.generateInsights(range);
    return res.json(result);
  } catch (error) {
    return handleMetricsError(error, res);
  }
});

module.exports = router;
