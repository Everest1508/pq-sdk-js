"use strict";

function toSnakeCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[- ]/g, "_")
    .toLowerCase();
}

function toSnakeCaseKeys(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[toSnakeCase(key)] = toSnakeCaseKeys(value);
    } else {
      out[toSnakeCase(key)] = value;
    }
  }
  return out;
}

function safeRequestContext(req) {
  const method = (req && req.method) || "";
  const originalUrl =
    (req && (req.originalUrl || req.url)) || "";
  const page = (req && (req.protocol ? `${req.protocol}://${req.get && req.get("host") || ""}${originalUrl}` : "")) || originalUrl;
  const ip = req && (req.ip || req.socket && req.socket.remoteAddress) || "";
  const userAgent = req && req.get && req.get("user-agent") || (req.headers && req.headers["user-agent"]) || "";
  return {
    method,
    path: originalUrl.split("?")[0] || originalUrl,
    page,
    ip,
    user_agent: userAgent,
  };
}

module.exports = { toSnakeCase, toSnakeCaseKeys, safeRequestContext };
