(function () {
  const config = {
    enabled: true,
    debug: false,
    endpoint: "",
    app: "image-toolbox",
    baiduId: "fdcabcd2bd41f07244795afe47e8d495"
  };

  function loadBaiduAnalytics() {
    if (!config.baiduId || window.__baiduAnalyticsLoaded) return;
    window.__baiduAnalyticsLoaded = true;
    window._hmt = window._hmt || [];

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://hm.baidu.com/hm.js?${config.baiduId}`;
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  }

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
    if (window._hmt) window._hmt.push(["_trackEvent", payload.tool || payload.page, eventName, payload.action || ""]);
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
    loadBaiduAnalytics();
  };

  loadBaiduAnalytics();

  window.addEventListener("DOMContentLoaded", () => {
    window.trackEvent("page_view");
  });
})();
