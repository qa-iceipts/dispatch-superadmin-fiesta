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

/** apiserver base + serverKey (throws a clean 424 if not configured). */
function apiserverCreds() {
  const base = process.env.APISERVER_URL;
  const serverKey = process.env.APISERVER_SERVER_KEY;
  if (!base || !serverKey) {
    throw new createHttpError.FailedDependency(
      "APISERVER_URL / APISERVER_SERVER_KEY not configured on the superadmin service"
    );
  }
  return { base: base.replace(/\/+$/, ""), serverKey };
}
/** Normalize an axios error from the apiserver into an http-error. */
function proxyError(err, fallback) {
  const status = (err.response && err.response.status) || 502;
  const message =
    (err.response && err.response.data && err.response.data.error_message) ||
    err.message ||
    fallback;
  return new createHttpError(status, message);
}

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
   * GET /admin/clients/:userId/stats?from=&to= — per-mine operational stats
   * (loading slips, vehicle in/out, material out, e-Way). Proxies to transport
   * (serverKey). Read-only.
   */
  getClientStats: async (req, res) => {
    const base = process.env.TRANSPORT_URL;
    const serverKey =
      process.env.TRANSPORT_SERVER_KEY || process.env.APISERVER_SERVER_KEY;
    if (!base || !serverKey) {
      throw new createHttpError.FailedDependency(
        "TRANSPORT_URL / server key not configured on the superadmin service"
      );
    }
    try {
      const { data } = await axios.get(
        `${base.replace(/\/+$/, "")}/loadingSlip/mineStatsForServer/${req.params.userId}`,
        {
          headers: { "x-server-key": serverKey },
          params: { from: req.query.from, to: req.query.to },
        }
      );
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      throw proxyError(err, "Failed to load client stats");
    }
  },

  // ── Feature/Permission CATALOGUE (create features + sub-module permissions) ──
  /** GET /admin/catalog — full feature→permission catalogue. */
  listCatalog: async (req, res) => {
    const { base, serverKey } = apiserverCreds();
    try {
      const { data } = await axios.get(`${base}/inventory/catalog`, {
        params: { server: "inventory", serverKey },
      });
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      throw proxyError(err, "Failed to load catalogue");
    }
  },
  /** POST /admin/catalog/features — create a feature. Body: { featureName, displayName }. */
  createCatalogFeature: async (req, res) => {
    const { base, serverKey } = apiserverCreds();
    try {
      const { data } = await axios.post(`${base}/inventory/catalog/feature`, {
        server: "inventory",
        serverKey,
        featureName: req.body.featureName,
        displayName: req.body.displayName,
      });
      return res.status(201).json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      throw proxyError(err, "Failed to create feature");
    }
  },
  /** POST /admin/catalog/permissions — create a sub-module permission under a feature. */
  createCatalogPermission: async (req, res) => {
    const { base, serverKey } = apiserverCreds();
    try {
      const { data } = await axios.post(`${base}/inventory/catalog/permission`, {
        server: "inventory",
        serverKey,
        featureId: req.body.featureId,
        permissionName: req.body.permissionName,
        display: req.body.display,
        roleNames: req.body.roleNames,
      });
      return res.status(201).json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      throw proxyError(err, "Failed to create permission");
    }
  },
  /** PUT /admin/catalog/features/:id — edit feature display name. */
  updateCatalogFeature: async (req, res) => {
    const { base, serverKey } = apiserverCreds();
    try {
      const { data } = await axios.post(`${base}/inventory/catalog/feature/update`, {
        server: "inventory",
        serverKey,
        id: req.params.id,
        displayName: req.body.displayName,
      });
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      throw proxyError(err, "Failed to update feature");
    }
  },
  /** PUT /admin/catalog/permissions/:id — edit permission display name. */
  updateCatalogPermission: async (req, res) => {
    const { base, serverKey } = apiserverCreds();
    try {
      const { data } = await axios.post(`${base}/inventory/catalog/permission/update`, {
        server: "inventory",
        serverKey,
        id: req.params.id,
        display: req.body.display,
      });
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      throw proxyError(err, "Failed to update permission");
    }
  },

  /**
   * GET /admin/clients/:userId/permissions — the mine's feature→sub-module tree
   * + its current permission ceiling. Proxies to apiserver (serverKey).
   */
  getClientPermissions: async (req, res) => {
    const apiBase = process.env.APISERVER_URL;
    const serverKey = process.env.APISERVER_SERVER_KEY;
    if (!apiBase || !serverKey) {
      throw new createHttpError.FailedDependency(
        "APISERVER_URL / APISERVER_SERVER_KEY not configured on the superadmin service"
      );
    }
    try {
      const { data } = await axios.get(
        `${apiBase.replace(/\/+$/, "")}/inventory/minePermissions/${req.params.userId}`,
        { params: { server: "inventory", serverKey } }
      );
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      const status = (err.response && err.response.status) || 502;
      const message =
        (err.response && err.response.data && err.response.data.error_message) ||
        err.message ||
        "Failed to load permissions";
      throw new createHttpError(status, message);
    }
  },

  /**
   * PUT /admin/clients/:userId/permissions — replace the mine's permission
   * ceiling. Body: { permissions: [{permissionId, create, modify, read, delete}] }.
   * Proxies to apiserver (POST, serverKey in body).
   */
  setClientPermissions: async (req, res) => {
    const apiBase = process.env.APISERVER_URL;
    const serverKey = process.env.APISERVER_SERVER_KEY;
    if (!apiBase || !serverKey) {
      throw new createHttpError.FailedDependency(
        "APISERVER_URL / APISERVER_SERVER_KEY not configured on the superadmin service"
      );
    }
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions
      : [];
    try {
      const { data } = await axios.post(
        `${apiBase.replace(/\/+$/, "")}/inventory/minePermissions/${req.params.userId}`,
        { server: "inventory", serverKey, permissions }
      );
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      const status = (err.response && err.response.status) || 502;
      const message =
        (err.response && err.response.data && err.response.data.error_message) ||
        err.message ||
        "Failed to save permissions";
      throw new createHttpError(status, message);
    }
  },

  /**
   * GET /admin/clients/:userId/features — the feature catalogue + which ones the
   * mine has enabled. Proxies to apiserver (serverKey).
   */
  getClientFeatures: async (req, res) => {
    const apiBase = process.env.APISERVER_URL;
    const serverKey = process.env.APISERVER_SERVER_KEY;
    if (!apiBase || !serverKey) {
      throw new createHttpError.FailedDependency(
        "APISERVER_URL / APISERVER_SERVER_KEY not configured on the superadmin service"
      );
    }
    try {
      const { data } = await axios.get(
        `${apiBase.replace(/\/+$/, "")}/inventory/mineFeatures/${req.params.userId}`,
        { params: { server: "inventory", serverKey } }
      );
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      const status = (err.response && err.response.status) || 502;
      const message =
        (err.response && err.response.data && err.response.data.error_message) ||
        err.message ||
        "Failed to load features";
      throw new createHttpError(status, message);
    }
  },

  /**
   * PUT /admin/clients/:userId/features — replace the mine's enabled feature set.
   * Body: { featureIds: [...] }. Proxies to apiserver (POST, serverKey in body).
   */
  setClientFeatures: async (req, res) => {
    const apiBase = process.env.APISERVER_URL;
    const serverKey = process.env.APISERVER_SERVER_KEY;
    if (!apiBase || !serverKey) {
      throw new createHttpError.FailedDependency(
        "APISERVER_URL / APISERVER_SERVER_KEY not configured on the superadmin service"
      );
    }
    const featureIds = Array.isArray(req.body.featureIds) ? req.body.featureIds : [];
    try {
      const { data } = await axios.post(
        `${apiBase.replace(/\/+$/, "")}/inventory/mineFeatures/${req.params.userId}`,
        { server: "inventory", serverKey, featureIds }
      );
      return res.json({ success: true, data: data && data.data ? data.data : data });
    } catch (err) {
      const status = (err.response && err.response.status) || 502;
      const message =
        (err.response && err.response.data && err.response.data.error_message) ||
        err.message ||
        "Failed to save features";
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
