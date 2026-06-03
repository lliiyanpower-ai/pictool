(function () {
  function getDefaultEndpoint() {
    if (window.PICTOOL_TRACKING_ENDPOINT) return window.PICTOOL_TRACKING_ENDPOINT;
    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      return "http://127.0.0.1:3000/api/track";
    }
    if (location.hostname === "pictool.com.cn" || location.hostname === "www.pictool.com.cn") {
      return "https://api.pictool.com.cn/api/track";
    }
    return "";
  }

  const config = {
    enabled: true,
    debug: false,
    endpoint: getDefaultEndpoint(),
    app: "image-toolbox"
  };
  const SESSION_STORAGE_KEY = "pictool.analytics.sessionId";
  const FLOW_STORAGE_KEY = "pictool.analytics.flowId";
  let fallbackSessionId = "";
  let fallbackStepIndex = 0;
  let currentFlowId = "";

  function getPageName() {
    const path = location.pathname.split("/").pop() || "index.html";
    return path.replace(".html", "") || "home";
  }

  function bucketBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "unknown";
    const mb = bytes / 1024 / 1024;
    if (mb < 1) return "0-1m";
    if (mb < 5) return "1-5m";
    if (mb < 10) return "5-10m";
    return "10m+";
  }

  function bucketDimensions(width, height) {
    const pixels = Number(width) * Number(height);
    if (!Number.isFinite(pixels) || pixels <= 0) return "unknown";
    if (pixels < 1280 * 720) return "small";
    if (pixels < 1920 * 1080) return "medium";
    if (pixels < 3840 * 2160) return "large";
    return "ultra";
  }

  function bucketQuality(value) {
    const quality = Number(value);
    if (!Number.isFinite(quality)) return "unknown";
    if (quality < 60) return "0-59";
    if (quality < 80) return "60-79";
    if (quality < 95) return "80-94";
    return "95-100";
  }

  function bucketBatchCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 2) return "unknown";
    if (count <= 5) return "2-5";
    if (count <= 10) return "6-10";
    if (count <= 20) return "11-20";
    return "20+";
  }

  function normalizeDimensionBucket(value) {
    const allowed = new Set(["unknown", "small", "medium", "large", "ultra"]);
    return allowed.has(value) ? value : "unknown";
  }

  function normalizeSmartCropStrategy(value) {
    const allowed = new Set(["face", "person", "saliency", "center"]);
    return allowed.has(value) ? value : "unknown";
  }

  function imageMeta(file, width, height) {
    return {
      file_type: file?.type || "unknown",
      size_bucket: bucketBytes(file?.size),
      dimension_bucket: bucketDimensions(width, height)
    };
  }

  function sanitizeDetails(details) {
    const blockedKeys = new Set([
      "text",
      "fileName",
      "filename",
      "file_name",
      "name",
      "dataUrl",
      "x",
      "y",
      "left",
      "top",
      "width",
      "height",
      "face",
      "faces",
      "person",
      "people",
      "box",
      "boxes",
      "face_box",
      "face_boxes",
      "person_box",
      "person_boxes",
      "coords",
      "coordinates"
    ]);
    const payload = {};
    Object.entries(details || {}).forEach(([key, value]) => {
      if (blockedKeys.has(key)) return;
      if (typeof value === "string" && /data:image\/|base64,/i.test(value)) return;
      if (value && typeof value === "object") return;
      if (key === "file_size_mb") return;
      if (key === "output_size_mb") return;
      if (key === "output_width" || key === "output_height") return;
      if (key === "batch_count") {
        payload.batch_count_bucket = bucketBatchCount(value);
        return;
      }
      if (key === "success_count" || key === "failed_count") return;
      if (key === "quality") {
        payload.quality_bucket = bucketQuality(value);
        return;
      }
      payload[key] = value;
    });
    if (details?.file_size_mb && !payload.size_bucket) {
      payload.size_bucket = bucketBytes(Number(details.file_size_mb) * 1024 * 1024);
    }
    if (details?.output_size_mb && !payload.output_size_bucket) {
      payload.output_size_bucket = bucketBytes(Number(details.output_size_mb) * 1024 * 1024);
    }
    if (details?.output_width && details?.output_height && !payload.output_dimension_bucket) {
      payload.output_dimension_bucket = bucketDimensions(details.output_width, details.output_height);
    }
    return payload;
  }

  function createSessionId() {
    const timestamp = Date.now();
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(2);
      window.crypto.getRandomValues(values);
      return `sid_${values[0].toString(36)}${values[1].toString(36)}_${timestamp}`;
    }
    return `sid_${Math.random().toString(36).slice(2, 12)}_${timestamp}`;
  }

  function createFlowId() {
    const timestamp = Date.now();
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(2);
      window.crypto.getRandomValues(values);
      return `flow_${values[0].toString(36)}${values[1].toString(36)}_${timestamp}`;
    }
    return `flow_${Math.random().toString(36).slice(2, 12)}_${timestamp}`;
  }

  function getSessionId() {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) return stored;
      const sessionId = createSessionId();
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      return sessionId;
    } catch (error) {
      if (!fallbackSessionId) fallbackSessionId = createSessionId();
      return fallbackSessionId;
    }
  }

  function getStepStorageKey(sessionId) {
    return `${SESSION_STORAGE_KEY}.${sessionId}.stepIndex`;
  }

  function getNextStepIndex(sessionId) {
    try {
      const key = getStepStorageKey(sessionId);
      const current = Number(sessionStorage.getItem(key));
      const next = Number.isFinite(current) && current > 0 ? current + 1 : 1;
      sessionStorage.setItem(key, String(next));
      return next;
    } catch (error) {
      fallbackStepIndex += 1;
      return fallbackStepIndex;
    }
  }

  function readStoredFlowId() {
    try {
      return sessionStorage.getItem(FLOW_STORAGE_KEY) || "";
    } catch (error) {
      return currentFlowId || "";
    }
  }

  function writeStoredFlowId(flowId) {
    currentFlowId = flowId || "";
    try {
      if (currentFlowId) sessionStorage.setItem(FLOW_STORAGE_KEY, currentFlowId);
      else sessionStorage.removeItem(FLOW_STORAGE_KEY);
    } catch (error) {
      // sessionStorage 不可用时保留页面内 flow_id。
    }
    return currentFlowId;
  }

  function startFlow() {
    return writeStoredFlowId(createFlowId());
  }

  function getFlowId(eventName) {
    if (eventName === "image_uploaded" || eventName === "workspace_image_uploaded") {
      return startFlow();
    }
    currentFlowId = currentFlowId || readStoredFlowId();
    return currentFlowId || "";
  }

  function sanitizeSmartCropDetails(tool, action, details) {
    const payload = { tool };
    const isOutcome = action === "applied" || action === "failed";

    if (isOutcome) {
      payload.status = action === "applied" ? "success" : "failed";
      payload.strategy = normalizeSmartCropStrategy(details.strategy);
    }

    if (details.dimension_bucket) {
      payload.dimension_bucket = normalizeDimensionBucket(details.dimension_bucket);
    }
    if (details.target_dimension_bucket) {
      payload.target_dimension_bucket = normalizeDimensionBucket(details.target_dimension_bucket);
    }

    return payload;
  }

  function getEventLabel(payload) {
    return payload.label ||
      payload.preset ||
      payload.ratio ||
      payload.format ||
      payload.text_type ||
      payload.control ||
      payload.size_bucket ||
      "";
  }

  function logEndpointError(stage, error) {
    if (config.debug) console.warn(`[trackEvent:${stage}]`, error);
  }

  function sendWithFetch(body) {
    if (!window.fetch) return;
    return window.fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body,
      keepalive: true,
      mode: "cors"
    }).catch((error) => logEndpointError("fetch", error));
  }

  function isLocalEndpoint() {
    try {
      const endpointUrl = new URL(config.endpoint, location.href);
      return endpointUrl.hostname === "127.0.0.1" || endpointUrl.hostname === "localhost";
    } catch (error) {
      return false;
    }
  }

  function sendToEndpoint(eventName, payload) {
    if (!config.endpoint) return;
    const body = JSON.stringify({ event: eventName, payload });
    let sent = false;

    if (isLocalEndpoint()) {
      sendWithFetch(body);
      return;
    }

    if (navigator.sendBeacon) {
      try {
        sent = navigator.sendBeacon(config.endpoint, new Blob([body], { type: "application/json" }));
      } catch (error) {
        logEndpointError("beacon", error);
      }
    }

    if (!sent) sendWithFetch(body);
  }

  function sendToVendors(eventName, payload) {
    if (window._hmt) window._hmt.push(["_trackEvent", payload.tool || payload.page, eventName, getEventLabel(payload)]);
    if (window._czc) window._czc.push(["_trackEvent", payload.tool || payload.page, eventName]);
  }

  function getActiveFilterPresetFromDom() {
    return document.querySelector(".filter-preset.active[data-preset]")?.dataset.preset || "";
  }

  function enrichFinalPayload(eventName, payload) {
    if (eventName === "download_clicked" && payload.tool === "filter" && !payload.preset) {
      const preset = getActiveFilterPresetFromDom();
      if (preset) payload.preset = preset;
    }
    return payload;
  }

  window.trackEvent = function trackEvent(eventName, details = {}) {
    const sessionId = getSessionId();
    const payload = enrichFinalPayload(eventName, {
      app: config.app,
      page: getPageName(),
      path: location.pathname,
      ts: Date.now(),
      ...sanitizeDetails(details),
      session_id: sessionId,
      step_index: getNextStepIndex(sessionId),
      flow_id: getFlowId(eventName)
    });

    if (config.debug) console.info("[trackEvent]", eventName, payload);
    if (!config.enabled) return;
    sendToVendors(eventName, payload);
    sendToEndpoint(eventName, payload);
  };

  window.trackToolEvent = function trackToolEvent(tool, action, details = {}) {
    window.trackEvent(`${tool}_${action}`, { tool, action, ...details });
  };

  window.trackSmartCropEvent = function trackSmartCropEvent(tool, action, details = {}) {
    const normalizedTool = tool === "workspace" ? "workspace" : "crop";
    const allowedActions = new Set(["enabled", "disabled", "reset_clicked", "applied", "failed"]);
    if (!allowedActions.has(action)) return;

    const prefix = normalizedTool === "workspace" ? "workspace_crop_smart_crop" : "crop_smart_crop";
    window.trackEvent(`${prefix}_${action}`, sanitizeSmartCropDetails(normalizedTool, action, details));
  };

  window.getImageAnalyticsMeta = imageMeta;
  window.getQualityBucket = bucketQuality;
  window.getDimensionBucket = bucketDimensions;
  window.getBatchCountBucket = bucketBatchCount;
  window.getAnalyticsSessionId = getSessionId;
  window.startAnalyticsFlow = startFlow;
  window.getCurrentAnalyticsFlow = () => currentFlowId || readStoredFlowId();
  window.getAnalyticsFlowId = window.getCurrentAnalyticsFlow;
  window.clearAnalyticsFlow = () => writeStoredFlowId("");

  window.configureTracking = function configureTracking(options = {}) {
    Object.assign(config, options);
  };

  window.addEventListener("DOMContentLoaded", () => {
    window.trackEvent("page_view");
  });
})();
