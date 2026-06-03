"use strict";

const crypto = require("crypto");
const config = require("../config");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getBasicPassword(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return "";

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    return separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);
  } catch (error) {
    return "";
  }
}

function adminAuth(req, res, next) {
  if (!config.adminPassword) {
    return res.status(503).send("Admin password is not configured.");
  }

  if (safeEqual(getBasicPassword(req), config.adminPassword)) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="pictool metrics", charset="UTF-8"');
  return res.status(401).send("Unauthorized");
}

module.exports = {
  adminAuth
};
