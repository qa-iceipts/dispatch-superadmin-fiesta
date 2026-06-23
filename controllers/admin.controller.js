"use strict";
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const db = require("../models");
const { createHttpError } = require("../middleware/error.handler");
const {
  buildEntitlement,
  deriveGovApiAccess,
} = require("../services/entitlement.service");

module.exports = {
  /**
   * POST /admin/clients — create a real, APPROVED mine login by proxying to the
   * apiserver's server-to-server adminClientRegister (role MINES, no OTP). The
   * client can log in immediately and fill its company profile. The apiserver
   * also auto-onboards it here as a tenant (upsertTenant), so it appears in the
   * tenants list. Body: { firstName, lastName?, email, password, mobile?, countryId? }
   */
  createClient: async (req, res) => {
    const { firstName, lastName, email, password, mobile, countryId } = req.body;
    if (!firstName || !email || !password) {
      throw new createHttpError.BadRequest(
        "firstName, email and password are required"
      );
    }
    const apiBase = process.env.APISERVER_URL;
    const serverKey = process.env.APISERVER_SERVER_KEY;
    if (!apiBase || !serverKey) {
      throw new createHttpError.FailedDependency(
        "APISERVER_URL / APISERVER_SERVER_KEY not configured on the superadmin service"
      );
    }
    const cid = countryId || process.env.DEFAULT_COUNTRY_ID;
    if (!cid) {
      throw new createHttpError.BadRequest(
        "countryId is required (or set DEFAULT_COUNTRY_ID on the superadmin service)"
      );
    }
    try {
      const { data } = await axios.post(
        `${apiBase.replace(/\/+$/, "")}/users/adminClientRegister`,
        {
          server: "inventory",
          serverKey,
          firstName,
          lastName: lastName || "",
          email,
          password,
          mobile: mobile || null,
          countryId: cid,
        }
      );
      return res.status(201).json({
        success: true,
        data: data && data.data ? data.data : data,
      });
    } catch (err) {
      const status = (err.response && err.response.status) || 502;
      const message =
        (err.response && err.response.data && err.response.data.error_message) ||
        err.message ||
        "Failed to create client";
      throw new createHttpError(status, message);
    }
  },

  /**
   * POST /admin/products  — register a product; returns the raw API key ONCE.
   * Body: { name }
   */
  createProduct: async (req, res) => {
    const { name } = req.body;
    if (!name) throw new createHttpError.BadRequest("name is required");
    const exists = await db.product.findOne({ where: { name } });
    if (exists) throw new createHttpError.Conflict("product already exists");

    const apiKey = crypto.randomBytes(32).toString("hex");
    const apiKeyHash = await bcrypt.hash(apiKey, 10);
    const product = await db.product.create({ name, apiKeyHash });
    // Raw key returned only once — store it in the product backend's env.
    return res.status(201).json({
      success: true,
      data: { id: product.id, name: product.name, apiKey },
    });
  },

  /** GET /admin/products — list products (no secrets) + tenant counts. */
  listProducts: async (req, res) => {
    const products = await db.product.findAll({ order: [["createdAt", "DESC"]] });
    const data = await Promise.all(
      products.map(async (p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        createdAt: p.createdAt,
        tenants: await db.tenant.count({ where: { productId: p.id } }),
      }))
    );
    return res.json({ success: true, data });
  },

  /** POST /admin/tenants — admin onboards a tenant under a product. */
  createTenant: async (req, res) => {
    const { productId, externalRef, name } = req.body;
    if (!productId || !externalRef) {
      throw new createHttpError.BadRequest("productId and externalRef are required");
    }
    const product = await db.product.findByPk(productId);
    if (!product) throw new createHttpError.NotFound("product not found");

    let tenant = await db.tenant.findOne({
      where: { productId, externalRef: String(externalRef) },
    });
    if (!tenant) {
      tenant = await db.tenant.create({
        productId,
        externalRef: String(externalRef),
        name,
        status: "ACTIVE",
      });
      await db.subscription.create({ tenantId: tenant.id, billingStatus: "TRIAL" });
    }
    return res.status(201).json({ success: true, data: tenant });
  },

  /** GET /admin/tenants?productId= — list tenants with billing + derived access. */
  listTenants: async (req, res) => {
    const where = {};
    if (req.query.productId) where.productId = req.query.productId;
    const tenants = await db.tenant.findAll({
      where,
      include: [db.subscription, db.product],
      order: [["createdAt", "DESC"]],
    });
    const data = tenants.map((t) => ({
      id: t.id,
      product: t.product ? t.product.name : null,
      externalRef: t.externalRef,
      name: t.name,
      status: t.status,
      billingStatus: t.subscription ? t.subscription.billingStatus : null,
      paidUntil: t.subscription ? t.subscription.paidUntil : null,
      govApiAccess:
        t.status === "ACTIVE" && deriveGovApiAccess(t.subscription),
    }));
    return res.json({ success: true, data });
  },

  /** GET /admin/tenants/:id — full detail incl. entitlement + quotas. */
  getTenant: async (req, res) => {
    const tenant = await db.tenant.findByPk(req.params.id, {
      include: [db.subscription, { model: db.quota, as: "quota" }, db.product],
    });
    if (!tenant) throw new createHttpError.NotFound("tenant not found");
    return res.json({
      success: true,
      data: {
        ...tenant.toJSON(),
        entitlement: buildEntitlement(tenant, tenant.subscription, tenant.quota || []),
      },
    });
  },

  /**
   * PUT /admin/tenants/:id/billing — set billing status / paid-until (mark paid).
   * Body: { billingStatus?, paidUntil? }
   */
  setBilling: async (req, res) => {
    const { billingStatus, paidUntil } = req.body;
    const sub = await db.subscription.findOne({ where: { tenantId: req.params.id } });
    if (!sub) throw new createHttpError.NotFound("subscription not found");
    await sub.update({
      billingStatus: billingStatus ?? sub.billingStatus,
      paidUntil: paidUntil !== undefined ? paidUntil : sub.paidUntil,
    });
    return res.json({ success: true, data: sub });
  },

  /**
   * PUT /admin/tenants/:id/gov-access — manual override + tenant status.
   * Body: { override: true|false|null, status?: "ACTIVE"|"SUSPENDED" }
   */
  setGovAccess: async (req, res) => {
    const { override, status } = req.body;
    const tenant = await db.tenant.findByPk(req.params.id, { include: [db.subscription] });
    if (!tenant) throw new createHttpError.NotFound("tenant not found");
    if (status) await tenant.update({ status });
    if (override !== undefined && tenant.subscription) {
      await tenant.subscription.update({ govApiAccessOverride: override });
    }
    return res.json({ success: true, data: { id: tenant.id, status: tenant.status, override } });
  },

  /**
   * PUT /admin/tenants/:id/quota — upsert a quota key. Body: { key, value }
   */
  setQuota: async (req, res) => {
    const { key, value } = req.body;
    if (!key) throw new createHttpError.BadRequest("key is required");
    const [q] = await db.quota.findOrCreate({
      where: { tenantId: req.params.id, key },
      defaults: { value: value ?? null },
    });
    if (q.value !== value) await q.update({ value: value ?? null });
    return res.json({ success: true, data: q });
  },
};
