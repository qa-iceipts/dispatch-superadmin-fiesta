"use strict";
const createHttpError = require("http-errors");

/** Wrap async route handlers so thrown errors hit the error middleware. */
const PromiseHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Final error middleware. */
const handleError = (err, req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({
    success: false,
    status,
    error_message: err.message || "Internal Server Error",
  });
};

module.exports = { PromiseHandler, handleError, createHttpError };
