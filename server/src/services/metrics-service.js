"use strict";

const store = require("../store");

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_WORKSPACE_SUBTOOLS = new Set(["crop", "filter", "title", "export", "compress"]);
const TOOLS = new Set(["compress", "crop", "filter", "title", "workspace"]);

function getDays(range) {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS));
}

function getPreviousRange(range) {
  const days = getDays(range);
  const from = new Date(range.from);
  from.setUTCDate(from.getUTCDate() - days);
  const to = new Date(range.from);
  return {
    from,
    to,
    fromLabel: from.toISOString().slice(0, 10),
    toLabel: new Date(to.getTime() - DAY_MS).toISOString().slice(0, 10)
  };
}

function countBy(rows, keyBuilder) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = keyBuilder(row);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function getEventTool(event) {
  const eventName = String(event.event_name || "");
  const tool = event.tool || event.page || "";
  if (TOOLS.has(tool)) return tool;
  if (eventName.startsWith("workspace_")) return "workspace";
  return "";
}

function isFailureEvent(event) {
  return event.is_error === true || String(event.event_name || "").includes("failed") || event.status === "failed";
}

function getFailureReasonsByTool(events) {
  const counts = new Map();
  events.filter(isFailureEvent).forEach((event) => {
    const tool = getEventTool(event);
    if (!tool) return;
    const reason = event.reason || "unknown";
    const key = `${tool}\t${reason}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const byTool = {};
  Array.from(counts.entries()).forEach(([key, count]) => {
    const [tool, reason] = key.split("\t");
    const current = byTool[tool];
    if (!current || count > current.count || (count === current.count && reason.localeCompare(current.reason) < 0)) {
      byTool[tool] = { reason, count };
    }
  });
  return byTool;
}

function getWorkspaceSwitchStats(events) {
  const switchEvents = events.filter((event) => event.event_name === "workspace_tool_switched");
  const total = switchEvents.length;
  const switches = countBy(
    switchEvents,
    (event) => {
      const tool = event.tool || event.related_tool || "";
      return VALID_WORKSPACE_SUBTOOLS.has(tool) ? tool : "";
    }
  );
  const validTotal = switches.reduce((sum, item) => sum + item.count, 0);
  const top = switches[0] || null;
  return {
    total,
    validTotal,
    top: top ? { tool: top.key, count: top.count } : null
  };
}

async function getInsightMetrics(range) {
  const [dashboard, rawEvents, previousDashboard] = await Promise.all([
    store.getDashboardMetrics(range),
    store.getEventsForRange(range),
    store.getDashboardMetrics(getPreviousRange(range))
  ]);

  return {
    range,
    days: getDays(range),
    summary: dashboard.summary,
    tools: dashboard.tools,
    events: dashboard.events,
    presets: dashboard.presets,
    failures: dashboard.failures,
    previousSummary: previousDashboard.summary,
    failureReasonsByTool: getFailureReasonsByTool(rawEvents),
    workspaceToolSwitch: getWorkspaceSwitchStats(rawEvents)
  };
}

module.exports = {
  getInsightMetrics
};
