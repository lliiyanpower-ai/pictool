(function () {
  const config = {
    enabled: false,
    debug: true,
    endpoint: "",
    app: "image-toolbox"
  };

  function getPageName() {
    const path = location.pathname.split("/").pop() || "index.html";
    return path.replace(".html", "") || "home";
  }

  function sendToEndpoint(eventName, payload) {
    if (!config.endpoint || !navigator.sendBeacon) return;
    const body = JSON.stringify({ event: eventName, payload });
    navigator.sendBeacon(config.endpoint, new Blob([body], { type: "application/json" }));
  }

  function sendToVendors(eventName, payload) {
    if (window._hmt) window._hmt.push(["_trackEvent", payload.tool || payload.page, eventName]);
    if (window._czc) window._czc.push(["_trackEvent", payload.tool || payload.page, eventName]);
  }

  window.trackEvent = function trackEvent(eventName, details = {}) {
    const payload = {
      app: config.app,
      page: getPageName(),
      path: location.pathname,
      ts: Date.now(),
      ...details
    };

    if (config.debug) console.info("[trackEvent]", eventName, payload);
    if (!config.enabled) return;
    sendToVendors(eventName, payload);
    sendToEndpoint(eventName, payload);
  };

  window.configureTracking = function configureTracking(options = {}) {
    Object.assign(config, options);
  };

  window.addEventListener("DOMContentLoaded", () => {
    window.trackEvent("page_view");
  });
})();
