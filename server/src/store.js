"use strict";

const fs = require("fs/promises");
const path = require("path");
const db = require("./db");
const config = require("./config");
const { getToolName, withEventName, withPresetName, withToolName } = require("./utils/labels");

const INSERT_FIELDS = [
  "app",
  "page",
  "path",
  "tool",
  "action",
  "format",
  "preset",
  "ratio",
  "control",
  "text_type",
  "source",
  "reason",
  "status",
  "strategy",
  "size_bucket",
  "dimension_bucket",
  "target_dimension_bucket",
  "output_size_bucket",
  "output_dimension_bucket",
  "quality_bucket",
  "batch_count_bucket",
  "session_id",
  "flow_id",
  "step_index",
  "event_group",
  "is_error",
  "duration_bucket"
];

const INSERT_COLUMNS = [
  "event_name",
  ...INSERT_FIELDS,
  "client_ts",
  "user_agent_bucket",
  "referer_host",
  "raw"
];

const TOOLS = ["compress", "crop", "filter", "title", "workspace"];
const UPLOAD_EVENTS = ["image_uploaded", "workspace_image_uploaded"];
const DOWNLOAD_EVENTS = ["download_clicked", "workspace_download_clicked", "zip_download_clicked"];
const FINAL_PRESET_EVENTS = [
  "crop_applied",
  "download_clicked",
  "workspace_download_success"
];
const EXCLUDED_METRIC_EVENTS = ["filter_preset_selected"];
const CORE_ACTION_EVENTS = [
  "compress_success",
  "compress_auto_completed",
  "compress_recompress_completed",
  "compress_batch_completed",
  "crop_applied",
  "filter_adjusted",
  "title_added",
  "title_text_added",
  "workspace_crop_applied",
  "workspace_title_added",
  "workspace_download_success"
];

function isFileStore() {
  return config.analyticsStore === "file";
}

function getStoreType() {
  return isFileStore() ? "file" : "postgres";
}

function getLocalStorePath() {
  return path.resolve(__dirname, "..", config.localEventStorePath);
}

function getLocalInsightsPath() {
  return path.resolve(path.dirname(getLocalStorePath()), "analytics-insights.jsonl");
}

async function ensureLocalStore() {
  const filePath = getLocalStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, "", "utf8");
  }
}

async function ensureLocalInsightsStore() {
  const filePath = getLocalInsightsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, "", "utf8");
  }
}

async function checkConnection() {
  if (!isFileStore()) return db.checkConnection();
  try {
    await ensureLocalStore();
    return true;
  } catch (error) {
    return false;
  }
}

function normalizeCount(value) {
  return Number(value || 0);
}

function isFailure(event) {
  return event.is_error === true || String(event.event_name || "").includes("failed") || event.status === "failed";
}

function eventInRange(event, range) {
  const serverTs = new Date(event.server_ts);
  return serverTs >= range.from && serverTs < range.to;
}

function eventToolMatches(event, tool) {
  return event.tool === tool ||
    event.page === tool ||
    (tool === "workspace" && String(event.event_name || "").startsWith("workspace_"));
}

function normalizeSummary(row) {
  const imageUploaded = normalizeCount(row.image_uploaded);
  const downloadClicked = normalizeCount(row.download_clicked);
  return {
    page_views: normalizeCount(row.page_views),
    tool_opened: normalizeCount(row.tool_opened),
    image_uploaded: imageUploaded,
    download_clicked: downloadClicked,
    upload_to_download_rate: imageUploaded > 0 ? Number((downloadClicked / imageUploaded).toFixed(3)) : 0,
    failures: normalizeCount(row.failures)
  };
}

function getRate(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(3)) : 0;
}

function isUploadEvent(event) {
  return UPLOAD_EVENTS.includes(event.event_name);
}

function isDownloadEvent(event) {
  return DOWNLOAD_EVENTS.includes(event.event_name);
}

function isCoreActionEvent(event) {
  return CORE_ACTION_EVENTS.includes(event.event_name);
}

async function readLocalEvents() {
  await ensureLocalStore();
  const filePath = getLocalStorePath();
  const content = await fs.readFile(filePath, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

async function readLocalInsights() {
  await ensureLocalInsightsStore();
  const content = await fs.readFile(getLocalInsightsPath(), "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

async function insertPostgresEvent(eventName, fields) {
  const values = [
    eventName,
    ...INSERT_FIELDS.map((field) => fields[field]),
    fields.client_ts,
    fields.user_agent_bucket,
    fields.referer_host,
    JSON.stringify(fields.raw || {})
  ];
  const placeholders = values.map((_, index) => `$${index + 1}`);

  await db.query(
    `INSERT INTO analytics_events (${INSERT_COLUMNS.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values
  );
}

async function insertLocalEvent(eventName, fields) {
  await ensureLocalStore();
  const event = {
    event_name: eventName,
    ...INSERT_FIELDS.reduce((record, field) => {
      record[field] = fields[field] ?? null;
      return record;
    }, {}),
    client_ts: fields.client_ts ? new Date(fields.client_ts).toISOString() : null,
    server_ts: new Date().toISOString(),
    user_agent_bucket: fields.user_agent_bucket || null,
    referer_host: fields.referer_host || null,
    raw: fields.raw || {}
  };
  await fs.appendFile(getLocalStorePath(), `${JSON.stringify(event)}\n`, "utf8");
}

async function insertEvent(eventName, fields) {
  if (isFileStore()) return insertLocalEvent(eventName, fields);
  return insertPostgresEvent(eventName, fields);
}

async function getPostgresSummary(range) {
  const result = await db.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
        COUNT(*) FILTER (WHERE event_name = 'tool_opened')::int AS tool_opened,
        COUNT(*) FILTER (WHERE event_name = ANY($3::text[]))::int AS image_uploaded,
        COUNT(*) FILTER (WHERE event_name = ANY($4::text[]))::int AS download_clicked,
        COUNT(*) FILTER (WHERE is_error = true OR event_name LIKE '%failed' OR status = 'failed')::int AS failures
      FROM analytics_events
      WHERE server_ts >= $1 AND server_ts < $2
    `,
    [range.from, range.to, UPLOAD_EVENTS, DOWNLOAD_EVENTS]
  );

  return normalizeSummary(result.rows[0] || {});
}

async function getLocalSummary(range) {
  const events = (await readLocalEvents()).filter((event) => eventInRange(event, range));
  return normalizeSummary({
    page_views: events.filter((event) => event.event_name === "page_view").length,
    tool_opened: events.filter((event) => event.event_name === "tool_opened").length,
    image_uploaded: events.filter((event) => UPLOAD_EVENTS.includes(event.event_name)).length,
    download_clicked: events.filter((event) => DOWNLOAD_EVENTS.includes(event.event_name)).length,
    failures: events.filter(isFailure).length
  });
}

async function getSummary(range) {
  return isFileStore() ? getLocalSummary(range) : getPostgresSummary(range);
}

async function getPostgresTools(range) {
  const result = await db.query(
    `
      WITH tool_list AS (
        SELECT unnest($3::text[]) AS tool
      )
      SELECT
        tool_list.tool,
        COUNT(events.id) FILTER (WHERE events.event_name = 'tool_opened' OR (tool_list.tool = 'workspace' AND events.event_name = 'workspace_opened'))::int AS opens,
        COUNT(events.id) FILTER (WHERE events.event_name = ANY($4::text[]))::int AS uploads,
        COUNT(events.id) FILTER (WHERE events.event_name = ANY($5::text[]))::int AS downloads,
        COUNT(events.id) FILTER (WHERE events.event_name = ANY($6::text[]))::int AS core_actions,
        COUNT(events.id) FILTER (WHERE events.is_error = true OR events.event_name LIKE '%failed' OR events.status = 'failed')::int AS failure_count
      FROM tool_list
      LEFT JOIN analytics_events events
        ON events.server_ts >= $1
        AND events.server_ts < $2
        AND (
          events.tool = tool_list.tool
          OR events.page = tool_list.tool
          OR (tool_list.tool = 'workspace' AND events.event_name LIKE 'workspace_%')
        )
      GROUP BY tool_list.tool
      ORDER BY opens DESC, uploads DESC, downloads DESC, tool_list.tool ASC
    `,
    [range.from, range.to, TOOLS, UPLOAD_EVENTS, DOWNLOAD_EVENTS, CORE_ACTION_EVENTS]
  );

  return result.rows.map((row) => ({
    tool: row.tool,
    tool_name: withToolName({ tool: row.tool }).tool_name,
    opens: normalizeCount(row.opens),
    uploads: normalizeCount(row.uploads),
    core_actions: normalizeCount(row.core_actions),
    downloads: normalizeCount(row.downloads),
    upload_to_download_rate: getRate(normalizeCount(row.downloads), normalizeCount(row.uploads)),
    failure_count: normalizeCount(row.failure_count),
    failure_rate: getRate(normalizeCount(row.failure_count), normalizeCount(row.uploads))
  }));
}

async function getLocalTools(range) {
  const events = (await readLocalEvents()).filter((event) => eventInRange(event, range));
  return TOOLS.map((tool) => {
    const toolEvents = events.filter((event) => eventToolMatches(event, tool));
    const uploads = toolEvents.filter(isUploadEvent).length;
    const downloads = toolEvents.filter(isDownloadEvent).length;
    const failureCount = toolEvents.filter(isFailure).length;
    return {
      tool,
      tool_name: withToolName({ tool }).tool_name,
      opens: toolEvents.filter((event) => event.event_name === "tool_opened" || (tool === "workspace" && event.event_name === "workspace_opened")).length,
      uploads,
      core_actions: toolEvents.filter(isCoreActionEvent).length,
      downloads,
      upload_to_download_rate: getRate(downloads, uploads),
      failure_count: failureCount,
      failure_rate: getRate(failureCount, uploads)
    };
  }).sort((a, b) => b.opens - a.opens || b.uploads - a.uploads || b.downloads - a.downloads || a.tool.localeCompare(b.tool));
}

async function getTools(range) {
  return isFileStore() ? getLocalTools(range) : getPostgresTools(range);
}

async function getPostgresEventsForRange(range) {
  const result = await db.query(
    `
      SELECT event_name, tool, page, preset, ratio, control, reason, status, step_index, event_group, is_error, duration_bucket, server_ts
      FROM analytics_events
      WHERE server_ts >= $1 AND server_ts < $2
    `,
    [range.from, range.to]
  );
  return result.rows;
}

async function getEventsForRange(range) {
  return isFileStore()
    ? (await readLocalEvents()).filter((event) => eventInRange(event, range))
    : getPostgresEventsForRange(range);
}

function inferEventGroup(eventName) {
  if (eventName === "page_view") return "page";
  if (eventName === "tool_opened" || eventName === "workspace_opened" || eventName === "workspace_tool_switched" || eventName === "compress_clicked") {
    return "navigation";
  }
  if (UPLOAD_EVENTS.includes(eventName)) return "upload";
  if (eventName === "upload_failed" || eventName.includes("failed")) return "error";
  if (eventName === "download_clicked" || eventName === "workspace_download_clicked" || eventName === "zip_download_clicked") {
    return "download";
  }
  if (eventName === "compress_auto_completed" ||
    eventName === "compress_recompress_completed" ||
    eventName === "compress_batch_completed" ||
    eventName === "workspace_download_success") {
    return "export";
  }
  if (eventName.endsWith("_applied") ||
    eventName.endsWith("_selected") ||
    eventName.endsWith("_adjusted") ||
    eventName.includes("_style_") ||
    eventName.includes("_text_") ||
    eventName === "export_format_selected") {
    return "edit";
  }
  if (eventName === "tracking_ready") return "system";
  return "unknown";
}

function getEventGroup(event) {
  return event.event_group || inferEventGroup(String(event.event_name || ""));
}

function isDownloadCompletion(event) {
  const eventName = String(event.event_name || "");
  return eventName === "download_clicked" ||
    eventName === "zip_download_clicked" ||
    eventName === "workspace_download_clicked" ||
    eventName.endsWith("_download_success");
}

function getEventTime(event) {
  const time = new Date(event.server_ts).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getStepIndex(event) {
  const step = Number(event.step_index);
  return Number.isInteger(step) && step > 0 ? step : null;
}

function sortDiagnosticEvents(events) {
  return [...events].sort((a, b) => {
    const timeDiff = getEventTime(a) - getEventTime(b);
    if (timeDiff !== 0) return timeDiff;
    return (getStepIndex(a) || 0) - (getStepIndex(b) || 0);
  });
}

function isActionEvent(event) {
  return getEventGroup(event) !== "page";
}

function isEditEvent(event) {
  return getEventGroup(event) === "edit";
}

function summarizeProblemFlags(events, summary) {
  const flags = [];
  const workspaceSwitchCount = events.filter((event) => event.event_name === "workspace_tool_switched").length;
  const hasUploadFailed = events.some((event) => event.event_name === "upload_failed");
  const hasExportFailed = events.some((event) => {
    const eventName = String(event.event_name || "");
    return eventName.includes("download_failed") || eventName.includes("export_failed") || event.reason === "render_failed";
  });
  const hasDownloadFailed = events.some((event) => String(event.event_name || "").includes("download_failed"));
  const lastGroup = summary.last_event ? getEventGroup(summary.last_event) : "unknown";

  if (summary.error_count > 0) flags.push("has_error");
  if (summary.upload_count > 0 && summary.download_count === 0) flags.push("uploaded_no_download");
  if (hasExportFailed) flags.push("export_failed");
  if (hasUploadFailed) flags.push("upload_failed");
  if (hasDownloadFailed) flags.push("download_failed");
  if (workspaceSwitchCount >= 3 && summary.download_count === 0) flags.push("tool_switch_no_download");
  if (summary.upload_count > 0 && summary.download_count === 0 && lastGroup !== "download") flags.push("left_after_upload");

  return flags;
}

function getSessionOutcome(events, summary) {
  const workspaceSwitchCount = events.filter((event) => event.event_name === "workspace_tool_switched").length;
  if (summary.download_count > 0) return "completed";
  if (summary.error_count > 0) return "failed";
  if (workspaceSwitchCount >= 3) return "tool_switch_no_download";
  if (summary.upload_count > 0 && summary.edit_count > 0) return "editing_unfinished";
  if (summary.upload_count > 0) return "uploaded_no_download";
  if (summary.upload_count === 0 && summary.download_count === 0 && summary.error_count === 0) return "browsed_only";
  return "unknown";
}

function getDiagnosticSummary(item) {
  if (item.session_outcome === "browsed_only") {
    return "该匿名会话仅浏览页面，没有上传图片或执行关键操作。";
  }
  if (item.session_outcome === "editing_unfinished") {
    return "该匿名会话已进入编辑流程，但没有完成下载。建议检查导出入口、按钮状态或编辑后的下一步提示。";
  }
  if (item.problem_flags.includes("upload_failed")) {
    return `该匿名会话出现上传失败，原因是 ${item.last_error_reason || "unknown"}。建议检查格式支持提示和上传失败文案。`;
  }
  if (item.error_count > 0) {
    return `该匿名会话出现 ${item.error_count} 次失败事件，最后一次失败为 ${item.last_error_event_name || "未知事件"}，原因是 ${item.last_error_reason || "unknown"}。`;
  }
  if (item.problem_flags.includes("tool_switch_no_download")) {
    return "该匿名会话在工作台多次切换工具但没有下载，可能存在操作路径不清晰或导出入口不明显的问题。";
  }
  if (item.problem_flags.includes("uploaded_no_download")) {
    return "该匿名会话上传了图片，但没有完成下载。建议检查该工具的操作提示、导出入口或用户是否在编辑步骤流失。";
  }
  return "";
}

function normalizeDiagnosticEvent(event) {
  const eventName = String(event.event_name || "");
  const tool = event.tool || event.page || "unknown";
  const normalized = {
    server_ts: event.server_ts,
    client_ts: event.client_ts || null,
    step_index: getStepIndex(event),
    event_name: eventName,
    event_name_zh: withEventName({ event_name: eventName }).event_name_zh,
    page: event.page || null,
    path: event.path || null,
    tool: event.tool || null,
    tool_name: withToolName({ tool }).tool_name,
    action: event.action || null,
    format: event.format || null,
    preset: event.preset || null,
    ratio: event.ratio || null,
    control: event.control || null,
    text_type: event.text_type || null,
    source: event.source || null,
    reason: event.reason || null,
    status: event.status || null,
    strategy: event.strategy || null,
    size_bucket: event.size_bucket || null,
    dimension_bucket: event.dimension_bucket || null,
    target_dimension_bucket: event.target_dimension_bucket || null,
    output_size_bucket: event.output_size_bucket || null,
    output_dimension_bucket: event.output_dimension_bucket || null,
    quality_bucket: event.quality_bucket || null,
    batch_count_bucket: event.batch_count_bucket || null,
    duration_bucket: event.duration_bucket || null,
    session_id: event.session_id || null,
    flow_id: event.flow_id || null,
    event_group: getEventGroup(event),
    is_error: isFailure(event)
  };
  if (normalized.preset) return withPresetName(normalized);
  return normalized;
}

function buildSessionItem(sessionId, sessionEvents) {
  const sorted = sortDiagnosticEvents(sessionEvents);
  const firstEvent = sorted[0] || {};
  const lastEvent = sorted[sorted.length - 1] || {};
  const actionEvents = sorted.filter(isActionEvent);
  const lastAction = actionEvents[actionEvents.length - 1] || null;
  const pageCount = new Set(sorted.map((event) => event.page).filter(Boolean)).size;
  const uploadCount = sorted.filter(isUploadEvent).length;
  const editCount = sorted.filter(isEditEvent).length;
  const downloadCount = sorted.filter(isDownloadCompletion).length;
  const errorEvents = sorted.filter(isFailure);
  const lastError = errorEvents[errorEvents.length - 1] || null;
  const summary = {
    last_event: lastEvent,
    upload_count: uploadCount,
    edit_count: editCount,
    download_count: downloadCount,
    error_count: errorEvents.length
  };
  const problemFlags = summarizeProblemFlags(sorted, summary);
  const sessionOutcome = getSessionOutcome(sorted, summary);
  const item = {
    session_id: sessionId,
    first_seen: firstEvent.server_ts || null,
    last_event_at: lastEvent.server_ts || null,
    last_action_at: lastAction?.server_ts || null,
    last_seen: lastEvent.server_ts || null,
    event_count: sorted.length,
    page_count: pageCount,
    upload_count: uploadCount,
    edit_count: editCount,
    download_count: downloadCount,
    error_count: errorEvents.length,
    last_event_name: lastEvent.event_name || null,
    last_event_name_zh: withEventName({ event_name: lastEvent.event_name || "" }).event_name_zh,
    last_event_group: lastEvent.event_name ? getEventGroup(lastEvent) : "unknown",
    last_action_name: lastAction?.event_name || null,
    last_action_name_zh: lastAction ? withEventName({ event_name: lastAction.event_name }).event_name_zh : null,
    last_action_group: lastAction ? getEventGroup(lastAction) : "none",
    session_outcome: sessionOutcome,
    completed_download: downloadCount > 0,
    problem_flags: problemFlags,
    last_error_event_name: lastError?.event_name || null,
    last_error_event_name_zh: lastError ? withEventName({ event_name: lastError.event_name }).event_name_zh : null,
    last_error_reason: lastError?.reason || null
  };
  item.diagnostic_summary = getDiagnosticSummary(item);
  return item;
}

function sessionMatchesFilter(item, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "problem") return item.problem_flags.length > 0;
  return item.problem_flags.includes(filter);
}

function sessionMatchesOutcome(item, outcome) {
  if (!outcome || outcome === "all") return true;
  return item.session_outcome === outcome;
}

function buildSessionItems(events, options = {}) {
  const sessionMap = new Map();
  events.forEach((event) => {
    if (!event.session_id) return;
    if (options.tool && !eventToolMatches(event, options.tool)) return;
    const list = sessionMap.get(event.session_id) || [];
    list.push(event);
    sessionMap.set(event.session_id, list);
  });

  return Array.from(sessionMap.entries())
    .map(([sessionId, sessionEvents]) => buildSessionItem(sessionId, sessionEvents))
    .filter((item) => sessionMatchesFilter(item, options.filter || "all"))
    .filter((item) => sessionMatchesOutcome(item, options.outcome || "all"))
    .sort((a, b) => getEventTime({ server_ts: b.last_event_at }) - getEventTime({ server_ts: a.last_event_at }));
}

function parsePagination(options = {}) {
  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 50, 1), 200);
  const offset = Math.max(Number.parseInt(options.offset, 10) || 0, 0);
  return { limit, offset };
}

async function getPostgresSessionEvents(range) {
  const result = await db.query(
    `
      SELECT
        event_name, app, page, path, tool, action, format, preset, ratio, control, text_type, source,
        reason, status, strategy, size_bucket, dimension_bucket, target_dimension_bucket,
        output_size_bucket, output_dimension_bucket, quality_bucket, batch_count_bucket,
        session_id, flow_id, step_index, event_group, is_error, duration_bucket,
        client_ts, server_ts, user_agent_bucket, referer_host
      FROM analytics_events
      WHERE server_ts >= $1
        AND server_ts < $2
        AND session_id IS NOT NULL
    `,
    [range.from, range.to]
  );
  return result.rows;
}

async function getSessions(range, options = {}) {
  const sourceEvents = isFileStore()
    ? (await readLocalEvents()).filter((event) => eventInRange(event, range))
    : await getPostgresSessionEvents(range);
  const items = buildSessionItems(sourceEvents, options);
  const { limit, offset } = parsePagination(options);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset
  };
}

function buildFlowItems(events) {
  const flowMap = new Map();
  events.forEach((event) => {
    if (!event.flow_id) return;
    const list = flowMap.get(event.flow_id) || [];
    list.push(event);
    flowMap.set(event.flow_id, list);
  });

  return Array.from(flowMap.entries()).map(([flowId, flowEvents]) => {
    const sorted = sortDiagnosticEvents(flowEvents);
    const firstEvent = sorted[0] || {};
    const lastEvent = sorted[sorted.length - 1] || {};
    const tool = sorted.find((event) => event.tool)?.tool || firstEvent.page || "unknown";
    const failed = sorted.some(isFailure);
    return {
      flow_id: flowId,
      tool,
      tool_name: withToolName({ tool }).tool_name,
      first_seen: firstEvent.server_ts || null,
      last_seen: lastEvent.server_ts || null,
      uploaded: sorted.some(isUploadEvent),
      downloaded: sorted.some(isDownloadCompletion),
      failed,
      last_event_name: lastEvent.event_name || null,
      last_event_name_zh: withEventName({ event_name: lastEvent.event_name || "" }).event_name_zh
    };
  }).sort((a, b) => getEventTime({ server_ts: a.first_seen }) - getEventTime({ server_ts: b.first_seen }));
}

async function getPostgresSessionDetailEvents(sessionId) {
  const result = await db.query(
    `
      SELECT
        event_name, app, page, path, tool, action, format, preset, ratio, control, text_type, source,
        reason, status, strategy, size_bucket, dimension_bucket, target_dimension_bucket,
        output_size_bucket, output_dimension_bucket, quality_bucket, batch_count_bucket,
        session_id, flow_id, step_index, event_group, is_error, duration_bucket,
        client_ts, server_ts, user_agent_bucket, referer_host
      FROM analytics_events
      WHERE session_id = $1
      ORDER BY server_ts ASC, step_index ASC NULLS LAST
    `,
    [sessionId]
  );
  return result.rows;
}

async function getSessionDetail(sessionId) {
  const events = isFileStore()
    ? (await readLocalEvents()).filter((event) => event.session_id === sessionId)
    : await getPostgresSessionDetailEvents(sessionId);
  if (!events.length) return null;

  const session = buildSessionItem(sessionId, events);
  return {
    session,
    flows: buildFlowItems(events),
    events: sortDiagnosticEvents(events).map(normalizeDiagnosticEvent)
  };
}

function rankCounts(rows, keyBuilder, mapper, limit) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = keyBuilder(row);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([key, count]) => mapper(key, count))
    .sort((a, b) => b.count - a.count || JSON.stringify(a).localeCompare(JSON.stringify(b)))
    .slice(0, limit);
}

async function getPostgresEvents(range, limit = 20) {
  const result = await db.query(
    `
      SELECT event_name, COUNT(*)::int AS count
      FROM analytics_events
      WHERE server_ts >= $1 AND server_ts < $2
        AND NOT (event_name = ANY($4::text[]))
      GROUP BY event_name
      ORDER BY count DESC, event_name ASC
      LIMIT $3
    `,
    [range.from, range.to, limit, EXCLUDED_METRIC_EVENTS]
  );

  return result.rows.map((row) => ({
    event_name: row.event_name,
    event_name_zh: withEventName({ event_name: row.event_name }).event_name_zh,
    count: normalizeCount(row.count)
  }));
}

async function getLocalEventsRank(range, limit = 20) {
  const events = (await readLocalEvents()).filter((event) => {
    return eventInRange(event, range) && !EXCLUDED_METRIC_EVENTS.includes(event.event_name);
  });
  return rankCounts(
    events,
    (event) => event.event_name,
    (eventName, count) => withEventName({ event_name: eventName, count }),
    limit
  );
}

async function getEvents(range, limit = 20) {
  return isFileStore() ? getLocalEventsRank(range, limit) : getPostgresEvents(range, limit);
}

async function getPostgresPresets(range, limit = 20) {
  const result = await db.query(
    `
      WITH final_events AS (
        SELECT
          events.*,
          COALESCE(events.tool, events.page, 'unknown') AS final_tool
        FROM analytics_events events
        WHERE events.server_ts >= $1
          AND events.server_ts < $2
          AND events.event_name = ANY($4::text[])
      ),
      effective_presets AS (
        SELECT
          final_tool AS tool,
          COALESCE(final_events.flow_id, final_events.session_id, final_events.id::text) AS flow_key,
          final_events.server_ts,
          COALESCE(
            final_events.preset,
            (
              SELECT selected.preset
              FROM analytics_events selected
              WHERE selected.server_ts <= final_events.server_ts
                AND selected.preset IS NOT NULL
                AND selected.preset <> ''
                AND (
                  (final_events.flow_id IS NOT NULL AND selected.flow_id = final_events.flow_id)
                  OR (final_events.flow_id IS NULL AND final_events.session_id IS NOT NULL AND selected.session_id = final_events.session_id)
                )
                AND (
                  (final_events.final_tool = 'filter' AND selected.event_name = 'filter_preset_selected')
                  OR (final_events.final_tool = 'workspace' AND selected.event_name = 'filter_preset_selected')
                  OR (final_events.final_tool = 'crop' AND selected.event_name = 'crop_preset_selected')
                )
              ORDER BY selected.server_ts DESC
              LIMIT 1
            )
          ) AS preset
        FROM final_events
      ),
      latest_flow_presets AS (
        SELECT DISTINCT ON (tool, flow_key)
          tool,
          preset
        FROM effective_presets
        ORDER BY tool, flow_key, server_ts DESC
      )
      SELECT tool, preset, COUNT(*)::int AS count
      FROM latest_flow_presets
      WHERE preset IS NOT NULL
        AND preset <> ''
        AND NOT (tool IN ('filter', 'workspace') AND preset = 'none')
      GROUP BY tool, preset
      ORDER BY count DESC, tool ASC, preset ASC
      LIMIT $3
    `,
    [range.from, range.to, limit, FINAL_PRESET_EVENTS]
  );

  return result.rows.map((row) => ({
    ...withPresetName(withToolName({
      tool: row.tool,
      preset: row.preset,
      count: normalizeCount(row.count)
    }))
  }));
}

function isSameFlowOrSession(finalEvent, candidate) {
  if (finalEvent.flow_id) return candidate.flow_id === finalEvent.flow_id;
  if (finalEvent.session_id) return candidate.session_id === finalEvent.session_id;
  return false;
}

function getFallbackPreset(finalEvent, allEvents) {
  const tool = finalEvent.tool || finalEvent.page || "unknown";
  const selectedEventName = tool === "crop" ? "crop_preset_selected" : "filter_preset_selected";
  const finalTime = getEventTime(finalEvent);

  const selected = allEvents
    .filter((event) => {
      return event.event_name === selectedEventName &&
        event.preset &&
        getEventTime(event) <= finalTime &&
        isSameFlowOrSession(finalEvent, event);
    })
    .sort((a, b) => getEventTime(b) - getEventTime(a))[0];

  return selected?.preset || null;
}

function getFinalPresetFlowKey(event) {
  return [
    event.tool || event.page || "unknown",
    event.flow_id || event.session_id || event.server_ts
  ].join("\t");
}

async function getLocalPresets(range, limit = 20) {
  const allEvents = await readLocalEvents();
  const latestByFlow = new Map();
  allEvents.filter((event) => {
    return eventInRange(event, range) &&
      !((event.tool === "filter" || event.tool === "workspace") && event.preset === "none") &&
      FINAL_PRESET_EVENTS.includes(event.event_name);
  }).map((event) => {
    const preset = event.preset || getFallbackPreset(event, allEvents);
    return { ...event, preset };
  }).filter((event) => {
    return event.preset &&
      !((event.tool === "filter" || event.tool === "workspace") && event.preset === "none");
  }).forEach((event) => {
    const key = getFinalPresetFlowKey(event);
    const current = latestByFlow.get(key);
    if (!current || getEventTime(event) > getEventTime(current)) {
      latestByFlow.set(key, event);
    }
  });
  const events = Array.from(latestByFlow.values());

  return rankCounts(
    events,
    (event) => `${event.tool || event.page || "unknown"}\t${event.preset}`,
    (key, count) => {
      const [tool, preset] = key.split("\t");
      return withPresetName(withToolName({ tool, preset, count }));
    },
    limit
  );
}

async function getPresets(range, limit = 20) {
  return isFileStore() ? getLocalPresets(range, limit) : getPostgresPresets(range, limit);
}

async function getPostgresFailures(range, limit = 20) {
  const result = await db.query(
    `
      SELECT event_name, COALESCE(NULLIF(reason, ''), 'unknown') AS reason, COUNT(*)::int AS count
      FROM analytics_events
      WHERE server_ts >= $1
        AND server_ts < $2
        AND (is_error = true OR event_name LIKE '%failed' OR status = 'failed')
      GROUP BY event_name, COALESCE(NULLIF(reason, ''), 'unknown')
      ORDER BY count DESC, event_name ASC, reason ASC
      LIMIT $3
    `,
    [range.from, range.to, limit]
  );

  return result.rows.map((row) => ({
    event_name: row.event_name,
    event_name_zh: withEventName({ event_name: row.event_name }).event_name_zh,
    reason: row.reason,
    count: normalizeCount(row.count)
  }));
}

async function getLocalFailures(range, limit = 20) {
  const events = (await readLocalEvents()).filter((event) => eventInRange(event, range) && isFailure(event));
  return rankCounts(
    events,
    (event) => `${event.event_name}\t${event.reason || "unknown"}`,
    (key, count) => {
      const [eventName, reason] = key.split("\t");
      return withEventName({ event_name: eventName, reason, count });
    },
    limit
  );
}

async function getFailures(range, limit = 20) {
  return isFileStore() ? getLocalFailures(range, limit) : getPostgresFailures(range, limit);
}

async function getDashboardMetrics(range) {
  const [summary, tools, events, presets, failures] = await Promise.all([
    getSummary(range),
    getTools(range),
    getEvents(range),
    getPresets(range),
    getFailures(range)
  ]);

  return {
    summary,
    tools,
    events,
    presets,
    failures
  };
}

function insightDisplayMetric(label, value) {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
}

function insightPercent(value) {
  if (!Number.isFinite(Number(value))) return null;
  return `${Math.round(Number(value) * 100)}%`;
}

function getFallbackDisplayMetrics(insight) {
  const metrics = [];
  if (insight.related_tool) {
    metrics.push(insightDisplayMetric("工具", getToolName(insight.related_tool)));
  }
  if (insight.related_event) {
    metrics.push(insightDisplayMetric("事件", withEventName({ event_name: insight.related_event }).event_name_zh));
  }

  const metricName = insight.metric_name;
  const metricValue = insight.metric_value;
  if (metricName === "upload_to_download_rate" || metricName === "workspace_upload_to_download_rate") {
    metrics.push(insightDisplayMetric("转化率", insightPercent(metricValue)));
  } else if (metricName === "failure_rate") {
    metrics.push(insightDisplayMetric("失败率", insightPercent(metricValue)));
  } else if (metricName === "preset_share" || metricName === "workspace_tool_switch_share" || metricName === "tool_open_share") {
    metrics.push(insightDisplayMetric("占比", insightPercent(metricValue)));
  } else if (metricName === "download_growth_rate") {
    metrics.push(insightDisplayMetric("增长", insightPercent(metricValue)));
  } else if (metricName === "download_decline_rate") {
    metrics.push(insightDisplayMetric("下滑", insightPercent(metricValue)));
  } else if (metricName === "image_uploads") {
    metrics.push(insightDisplayMetric("上传", metricValue));
  } else if (metricName === "failure_count") {
    metrics.push(insightDisplayMetric("失败数", metricValue));
  } else if (metricName === "preset_count") {
    metrics.push(insightDisplayMetric("选择次数", metricValue));
  } else if (metricName === "workspace_tool_switch_count") {
    metrics.push(insightDisplayMetric("切换次数", metricValue));
  }

  if (insight.related_dimension && insight.type === "preset") {
    metrics.unshift(insightDisplayMetric("预设", insight.related_dimension));
  } else if (insight.related_dimension && insight.type === "failure") {
    metrics.push(insightDisplayMetric("主要原因", insight.related_dimension));
  } else if (insight.related_dimension && insight.type === "workspace") {
    metrics.push(insightDisplayMetric("子工具", insight.related_dimension));
  }

  return metrics.filter(Boolean);
}

function getFallbackDebugMetrics(insight) {
  return [
    insightDisplayMetric("指标名", insight.metric_name),
    insightDisplayMetric("原始值", insight.metric_value),
    insightDisplayMetric("阈值", insight.baseline_value),
    insightDisplayMetric("规则", insight.rule_id)
  ].filter(Boolean);
}

function isStaleInsight(insight) {
  const text = `${insight.title || ""}\n${insight.summary || ""}`;
  return text.includes("高于 60%") ||
    text.includes("工作台中用户最常切换到 工作台") ||
    text.includes("最终采用最多") ||
    text.includes("占最终预设使用") ||
    text.includes("建议优先排查上传格式、导出流程或浏览器兼容问题");
}

function enrichInsight(insight) {
  return {
    ...insight,
    display_metrics: Array.isArray(insight.display_metrics) && insight.display_metrics.length
      ? insight.display_metrics.filter((item) => item && item.label && item.value !== undefined && item.value !== null)
      : getFallbackDisplayMetrics(insight),
    debug_metrics: Array.isArray(insight.debug_metrics) && insight.debug_metrics.length
      ? insight.debug_metrics.filter((item) => item && item.label && item.value !== undefined && item.value !== null)
      : getFallbackDebugMetrics(insight)
  };
}

async function getPostgresInsights(range) {
  const result = await db.query(
    `
      SELECT
        id,
        type,
        severity,
        title,
        summary,
        metric_name,
        metric_value::float AS metric_value,
        baseline_value::float AS baseline_value,
        related_tool,
        related_event,
        related_dimension,
        created_at
      FROM analytics_insights
      WHERE period_start = $1::date AND period_end = $2::date
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'notice' THEN 3
          ELSE 4
        END,
        id ASC
    `,
    [range.fromLabel, range.toLabel]
  );
  return result.rows.filter((insight) => !isStaleInsight(insight)).map(enrichInsight);
}

async function getLocalInsights(range) {
  const insights = await readLocalInsights();
  return insights
    .filter((insight) => insight.period_start === range.fromLabel && insight.period_end === range.toLabel)
    .filter((insight) => !isStaleInsight(insight))
    .map(enrichInsight)
    .sort((a, b) => {
      const order = { critical: 1, warning: 2, notice: 3, info: 4 };
      return (order[a.severity] || 5) - (order[b.severity] || 5) || a.id - b.id;
    });
}

async function getInsights(range) {
  return isFileStore() ? getLocalInsights(range) : getPostgresInsights(range);
}

function serializeInsight(range, insight, id) {
  return enrichInsight({
    id,
    period_start: range.fromLabel,
    period_end: range.toLabel,
    rule_id: insight.rule_id || null,
    type: insight.type,
    severity: insight.severity,
    title: insight.title,
    summary: insight.summary,
    metric_name: insight.metric_name || null,
    metric_value: insight.metric_value ?? null,
    baseline_value: insight.baseline_value ?? null,
    related_tool: insight.related_tool || null,
    related_event: insight.related_event || null,
    related_dimension: insight.related_dimension || null,
    display_metrics: insight.display_metrics || [],
    debug_metrics: insight.debug_metrics || [],
    created_at: new Date().toISOString()
  });
}

async function savePostgresInsights(range, insights) {
  await db.query("DELETE FROM analytics_insights WHERE period_start = $1::date AND period_end = $2::date", [range.fromLabel, range.toLabel]);
  if (!insights.length) return [];

  const saved = [];
  for (const insight of insights) {
    const result = await db.query(
      `
        INSERT INTO analytics_insights (
          period_start,
          period_end,
          type,
          severity,
          title,
          summary,
          metric_name,
          metric_value,
          baseline_value,
          related_tool,
          related_event,
          related_dimension
        )
        VALUES ($1::date, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, type, severity, title, summary, metric_name, metric_value::float AS metric_value,
          baseline_value::float AS baseline_value, related_tool, related_event, related_dimension, created_at
      `,
      [
        range.fromLabel,
        range.toLabel,
        insight.type,
        insight.severity,
        insight.title,
        insight.summary,
        insight.metric_name || null,
        insight.metric_value ?? null,
        insight.baseline_value ?? null,
        insight.related_tool || null,
        insight.related_event || null,
        insight.related_dimension || null
      ]
    );
    saved.push(enrichInsight({
      ...result.rows[0],
      rule_id: insight.rule_id || null,
      display_metrics: insight.display_metrics || [],
      debug_metrics: insight.debug_metrics || []
    }));
  }
  return saved;
}

async function saveLocalInsights(range, insights) {
  const existing = await readLocalInsights();
  const kept = existing.filter((insight) => insight.period_start !== range.fromLabel || insight.period_end !== range.toLabel);
  const maxId = kept.reduce((max, insight) => Math.max(max, Number(insight.id) || 0), 0);
  const saved = insights.map((insight, index) => serializeInsight(range, insight, maxId + index + 1));
  const lines = [...kept, ...saved].map((insight) => JSON.stringify(insight)).join("\n");
  await fs.writeFile(getLocalInsightsPath(), lines ? `${lines}\n` : "", "utf8");
  return saved;
}

async function saveInsights(range, insights) {
  return isFileStore() ? saveLocalInsights(range, insights) : savePostgresInsights(range, insights);
}

module.exports = {
  INSERT_FIELDS,
  checkConnection,
  getStoreType,
  insertEvent,
  getEventsForRange,
  getSummary,
  getTools,
  getEvents,
  getPresets,
  getFailures,
  getSessions,
  getSessionDetail,
  getDashboardMetrics,
  getInsights,
  saveInsights
};
