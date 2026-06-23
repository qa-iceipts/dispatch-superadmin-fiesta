"use strict";
/**
 * Minimal logger shim (console-backed) — matches the winston-style API used by
 * the ported VAHAN files (info/warn/error/debug with an optional meta object).
 */
const log = (level, msg, meta) => {
  const line = `[${level}] ${msg}`;
  if (meta !== undefined) console[level === "debug" ? "log" : level](line, meta);
  else console[level === "debug" ? "log" : level](line);
};

module.exports = {
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
  debug: (msg, meta) => log("debug", msg, meta),
};
