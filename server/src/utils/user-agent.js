"use strict";

function getUserAgentBucket(userAgent) {
  const value = String(userAgent || "").toLowerCase();
  if (!value) return "unknown";
  if (/bot|spider|crawler|slurp|bingpreview/.test(value)) return "bot";
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobile|iphone|android/.test(value)) return "mobile";
  return "desktop";
}

function getRefererHost(referer) {
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname;
    return host ? host.slice(0, 120) : null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  getUserAgentBucket,
  getRefererHost
};
