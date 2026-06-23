"use strict";
const createHttpError = require("http-errors");

/**
 * M1 placeholder auth for /admin routes: a shared superadmin token.
 * TODO (M4): replace with real superadmin login / SSO + RBAC.
 * Expects header: x-admin-token = SUPERADMIN_API_TOKEN.
 */
module.exports = function adminAuth(req, res, next) {
  const token = req.header("x-admin-token");
  const expected = process.env.SUPERADMIN_API_TOKEN;
  if (!expected) {
    return next(
      new createHttpError.InternalServerError("SUPERADMIN_API_TOKEN not configured")
    );
  }
  if (token !== expected) {
    return next(new createHttpError.Unauthorized("Invalid admin token"));
  }
  next();
};
