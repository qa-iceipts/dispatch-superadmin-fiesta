"use strict";
const createHttpError = require("http-errors");
const db = require("../models");
const { deriveGovApiAccess } = require("../services/entitlement.service");

/**
 * Resolve the tenant (mine) for a gov-API call and ENFORCE entitlement at the
 * source — if the mine isn't entitled (unpaid/suspended), we never call the
 * government API. Runs after apiKeyAuth (req.product set).
 *
 * Tenant is identified by header `x-tenant-ref` (the product's id for the mine,
 * e.g. the MINES userId) or body/query `tenantRef`.
 */
async function resolveTenantEntitlement(req, res, next) {
  try {
    const tenantRef =
      req.header("x-tenant-ref") || req.body?.tenantRef || req.query?.tenantRef;
    if (!tenantRef) {
      throw new createHttpError.BadRequest(
        "Missing tenant reference (x-tenant-ref)"
      );
    }
    const tenant = await db.tenant.findOne({
      where: { productId: req.product.id, externalRef: String(tenantRef) },
      include: [db.subscription],
    });
    if (!tenant) {
      // Unknown tenant => block (must be onboarded first).
      throw new createHttpError[402](
        "Government API access is not enabled for this mine (not onboarded)."
      );
    }
    const allowed =
      tenant.status === "ACTIVE" && deriveGovApiAccess(tenant.subscription);
    if (!allowed) {
      throw new createHttpError[402](
        "Government API access is disabled for this mine due to pending dues."
      );
    }
    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Record a billable usage event for the tenant after a successful gov-API call.
 * Hooks res 'finish' so it never blocks/breaks the response. Run AFTER
 * resolveTenantEntitlement (req.tenant set).
 */
function meterUsage(type) {
  return (req, res, next) => {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.tenant) {
        db.usageEvent
          .create({
            tenantId: req.tenant.id,
            productId: req.product.id,
            type,
            ref:
              req.body?.vehicleNumber ||
              req.body?.dlNumber ||
              req.body?.regNo ||
              null,
            status: "SUCCESS",
          })
          .catch((e) => console.error("[meterUsage] failed:", e.message));
      }
    });
    next();
  };
}

/**
 * Meter a LOCAL DB search (the pre-VAHAN "is this vehicle/driver already in our
 * DB?" lookup). Unlike gov-API calls these are NOT gated (they're free) — but we
 * still count how many times each tenant hits them, separately from the gov-API
 * counters. The tenant is soft-resolved (auto-onboarded TRIAL if new) so the
 * search is never blocked. Counts every call with an `x-tenant-ref`, including
 * "not found" (404) — because that's still a search the tenant performed.
 */
function meterDbSearch(type) {
  return async (req, res, next) => {
    try {
      const tenantRef =
        req.header("x-tenant-ref") || req.body?.tenantRef || req.query?.tenantRef;
      if (tenantRef) {
        let tenant = await db.tenant.findOne({
          where: { productId: req.product.id, externalRef: String(tenantRef) },
        });
        if (!tenant) {
          tenant = await db.tenant.create({
            productId: req.product.id,
            externalRef: String(tenantRef),
            status: "ACTIVE",
          });
          await db.subscription.create({
            tenantId: tenant.id,
            billingStatus: "TRIAL",
          });
        }
        req.tenant = tenant;
      }
    } catch (e) {
      console.error("[meterDbSearch] tenant resolve failed:", e.message);
    }
    res.on("finish", () => {
      // Count any non-server-error response (200 found, 404 not-found) as a search.
      if (req.tenant && res.statusCode < 500) {
        db.usageEvent
          .create({
            tenantId: req.tenant.id,
            productId: req.product.id,
            type,
            ref: req.params?.vehicleNumber || req.params?.dlNumber || null,
            status:
              res.statusCode >= 200 && res.statusCode < 300
                ? "FOUND"
                : "NOT_FOUND",
          })
          .catch((e) => console.error("[meterDbSearch] failed:", e.message));
      }
    });
    next();
  };
}

module.exports = { resolveTenantEntitlement, meterUsage, meterDbSearch };
