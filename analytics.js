(function () {
  const config = {
    enabled: true,
    debug: false,
    endpoint: "",
    app: "image-toolbox"
  };

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
      if (key === "file_size_mb") return;
      if (key === "output_size_mb") return;
      if (key === "output_width" || key === "output_height") return;
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

  function sendToEndpoint(eventName, payload) {
    if (!config.endpoint || !navigator.sendBeacon) return;
    const body = JSON.stringify({ event: eventName, payload });
    navigator.sendBeacon(config.endpoint, new Blob([body], { type: "application/json" }));
  }

  function sendToVendors(eventName, payload) {
    if (window._hmt) window._hmt.push(["_trackEvent", payload.tool || payload.page, eventName, getEventLabel(payload)]);
    if (window._czc) window._czc.push(["_trackEvent", payload.tool || payload.page, eventName]);
  }

  window.trackEvent = function trackEvent(eventName, details = {}) {
    const payload = {
      app: config.app,
      page: getPageName(),
      path: location.pathname,
      ts: Date.now(),
      ...sanitizeDetails(details)
    };

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

  window.configureTracking = function configureTracking(options = {}) {
    Object.assign(config, options);
  };

  window.addEventListener("DOMContentLoaded", () => {
    window.trackEvent("page_view");
  });
})();
