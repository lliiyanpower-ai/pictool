"use strict";

const DEFAULT_APP = "image-toolbox";
const MAX_EVENT_NAME_LENGTH = 80;

const FIELD_LIMITS = {
  app: 80,
  page: 80,
  path: 300,
  tool: 80,
  action: 80,
  format: 80,
  preset: 120,
  ratio: 80,
  control: 80,
  text_type: 80,
  source: 80,
  reason: 120,
  status: 40,
  strategy: 40,
  size_bucket: 40,
  dimension_bucket: 40,
  target_dimension_bucket: 40,
  output_size_bucket: 40,
  output_dimension_bucket: 40,
  quality_bucket: 40,
  batch_count_bucket: 40,
  session_id: 120,
  flow_id: 120,
  event_group: 40,
  duration_bucket: 40,
  user_agent_bucket: 40,
  referer_host: 120
};

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

const ALLOWED_REASONS = new Set([
  "unsupported_format",
  "read_failed",
  "render_failed",
  "canvas_failed",
  "zip_failed",
  "browser_unsupported",
  "timeout",
  "network_failed",
  "endpoint_failed",
  "permission_denied",
  "unknown"
]);

const ALLOWED_EVENT_GROUPS = new Set([
  "page",
  "upload",
  "edit",
  "export",
  "download",
  "error",
  "navigation",
  "system",
  "unknown"
]);

const ALLOWED_DURATION_BUCKETS = new Set([
  "0-1s",
  "1-3s",
  "3-10s",
  "10s+",
  "unknown"
]);

const ALLOWED_PAYLOAD_KEYS = new Set([
  ...INSERT_FIELDS,
  "ts",
  "client_ts"
]);

const BLOCKED_KEYS = new Set([
  "fileName",
  "filename",
  "file_name",
  "name",
  "text",
  "title",
  "content",
  "dataUrl",
  "image",
  "blob",
  "base64",
  "file",
  "path_local",
  "local_path",
  "x",
  "y",
  "left",
  "top",
  "width",
  "height",
  "box",
  "boxes",
  "face",
  "faces",
  "person",
  "people",
  "coordinates",
  "coords",
  "file_size_mb",
  "output_size_mb",
  "output_width",
  "output_height",
  "face_box",
  "face_boxes",
  "person_box",
  "person_boxes"
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasBlockedImageContent(value) {
  return /data:image\/|base64,/i.test(String(value || ""));
}

function hasBlockedRawImageContent(rawBody) {
  if (!rawBody) return false;
  return hasBlockedImageContent(rawBody);
}

function normalizeScalar(value, limit) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" || typeof value === "function" || typeof value === "symbol") return null;
  const normalized = String(value).trim();
  if (!normalized || hasBlockedImageContent(normalized)) return null;
  return normalized.slice(0, limit);
}

function normalizeInteger(value) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) return null;
  return numberValue;
}

function normalizeBoolean(value) {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return null;
}

function normalizeEnum(value, allowed) {
  const normalized = normalizeScalar(value, 80);
  if (normalized === null) return null;
  return allowed.has(normalized) ? normalized : "unknown";
}

function parseClientTimestamp(payload) {
  const rawValue = payload.client_ts ?? payload.ts;
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;

  let date;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    date = new Date(rawValue < 10000000000 ? rawValue * 1000 : rawValue);
  } else if (typeof rawValue === "string" && !hasBlockedImageContent(rawValue)) {
    const numericValue = Number(rawValue);
    date = Number.isFinite(numericValue)
      ? new Date(numericValue < 10000000000 ? numericValue * 1000 : numericValue)
      : new Date(rawValue);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

function sanitizeEventName(value) {
  if (typeof value !== "string") {
    const error = new Error("invalid_event");
    error.statusCode = 400;
    throw error;
  }

  const eventName = value.trim();
  if (!eventName || eventName.length > MAX_EVENT_NAME_LENGTH || !/^[a-z][a-z0-9_]*$/.test(eventName)) {
    const error = new Error("invalid_event");
    error.statusCode = 400;
    throw error;
  }

  return eventName;
}

function sanitizePayload(payload) {
  const cleaned = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (BLOCKED_KEYS.has(key) || !ALLOWED_PAYLOAD_KEYS.has(key)) return;
    if (key === "ts" || key === "client_ts") return;

    const normalized = normalizeScalar(value, FIELD_LIMITS[key] || 80);
    if (normalized === null) return;
    cleaned[key] = normalized;
  });

  return cleaned;
}

function inferEventGroup(eventName) {
  if (eventName === "page_view") return "page";
  if (eventName === "tool_opened" ||
    eventName === "workspace_opened" ||
    eventName === "workspace_tool_switched" ||
    eventName === "compress_clicked") {
    return "navigation";
  }
  if (eventName === "image_uploaded" || eventName === "workspace_image_uploaded") return "upload";
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

function inferIsError(eventName, fields, hasReason) {
  return eventName.includes("failed") || fields.status === "failed" || hasReason;
}

function sanitizeTrackRequest(body) {
  if (!isPlainObject(body)) {
    const error = new Error("invalid_payload");
    error.statusCode = 400;
    throw error;
  }

  const eventName = sanitizeEventName(body.event);
  if (!isPlainObject(body.payload)) {
    const error = new Error("invalid_payload");
    error.statusCode = 400;
    throw error;
  }

  const cleanedPayload = sanitizePayload(body.payload);
  const fields = {};
  INSERT_FIELDS.forEach((field) => {
    fields[field] = cleanedPayload[field] ?? null;
  });
  const hasReason = cleanedPayload.reason !== undefined && cleanedPayload.reason !== null;
  fields.reason = hasReason ? normalizeEnum(cleanedPayload.reason, ALLOWED_REASONS) : null;
  fields.step_index = normalizeInteger(cleanedPayload.step_index);
  fields.event_group = normalizeEnum(cleanedPayload.event_group, ALLOWED_EVENT_GROUPS) || inferEventGroup(eventName);
  fields.is_error = normalizeBoolean(cleanedPayload.is_error);
  if (fields.is_error === null) fields.is_error = inferIsError(eventName, fields, hasReason);
  fields.duration_bucket = normalizeEnum(cleanedPayload.duration_bucket, ALLOWED_DURATION_BUCKETS);
  fields.app = fields.app || DEFAULT_APP;
  fields.client_ts = parseClientTimestamp(body.payload);
  fields.raw = {};

  return {
    eventName,
    fields
  };
}

module.exports = {
  INSERT_FIELDS,
  sanitizeTrackRequest,
  hasBlockedRawImageContent
};
