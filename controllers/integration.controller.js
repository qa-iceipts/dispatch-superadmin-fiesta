"use strict";
const db = require("../models");
const { createHttpError } = require("../middleware/error.handler");
const { buildEntitlement } = require("../services/entitlement.service");

/**
 * Load a tenant (by product + externalRef) with subscription + quotas.
 */
async function loadTenant(productId, externalRef) {
  return db.tenant.findOne({
    where: { productId, externalRef: String(externalRef) },
    include: [db.subscription, { model: db.quota, as: "quota" }],
  });
}

/**
 * Find — or auto-create — the tenant (client) for this product. Every client
 * that interacts with the platform becomes a tenant automatically (TRIAL), so
 * legacy clients (created before onboarding existed) are tracked too and never
 * dropped. `name` is set on create / filled in if it was empty.
 */
async function ensureTenant(productId, externalRef, name) {
  let tenant = await db.tenant.findOne({
    where: { productId, externalRef: String(externalRef) },
  });
  if (!tenant) {
    tenant = await db.tenant.create({
      productId,
      externalRef: String(externalRef),
      name: name || null,
      status: "ACTIVE",
    });
    await db.subscription.create({ tenantId: tenant.id, billingStatus: "TRIAL" });
  } else if (name && !tenant.name) {
    await tenant.update({ name });
  }
  return tenant;
}

module.exports = {
  /**
   * POST /v1/tenants — explicit onboarding (called on client registration).
   * Body: { externalRef, name?, metadata? }
   */
  upsertTenant: async (req, res) => {
    const { externalRef, name, metadata } = req.body;
    if (!externalRef) throw new createHttpError.BadRequest("externalRef is required");
    await ensureTenant(req.product.id, externalRef, name);
    if (metadata) {
      await db.tenant.update(
        { metadata },
        { where: { productId: req.product.id, externalRef: String(externalRef) } }
      );
    }
    const full = await loadTenant(req.product.id, externalRef);
    return res.status(201).json({
      success: true,
      data: buildEntitlement(full, full.subscription, full.quota || []),
    });
  },

  /**
   * POST /v1/usage — record a billable gov-API usage event for a client.
   * Auto-onboards the client (tenant) if new. Body: { tenantRef, type, ref?, name?, status? }
   */
  recordUsage: async (req, res) => {
    const { tenantRef, type, ref, name, status } = req.body;
    if (!tenantRef || !type) {
      throw new createHttpError.BadRequest("tenantRef and type are required");
    }
    const tenant = await ensureTenant(req.product.id, tenantRef, name);
    await db.usageEvent.create({
      tenantId: tenant.id,
      productId: req.product.id,
      type: String(type),
      ref: ref || null,
      status: status || "SUCCESS",
    });
    return res.json({ success: true, recorded: true, tenantId: tenant.id });
  },

  /**
   * GET /v1/entitlement?tenantRef=<externalRef> — entitlement for product+client.
   * Auto-onboards the client (TRIAL) if new, so existing clients aren't blocked
   * when the gate is first enabled; superadmin can then suspend/bill specific ones.
   */
  getEntitlement: async (req, res) => {
    const tenantRef = req.query.tenantRef;
    if (!tenantRef) throw new createHttpError.BadRequest("tenantRef is required");
    await ensureTenant(req.product.id, tenantRef);
    const tenant = await loadTenant(req.product.id, tenantRef);
    return res.json({
      success: true,
      data: buildEntitlement(tenant, tenant.subscription, tenant.quota || []),
    });
  },
};
