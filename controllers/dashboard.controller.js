"use strict";
/**
 * Dashboard & analytics for the superadmin console.
 * @module dashboard.controller
 */
const db = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const { deriveGovApiAccess } = require("../services/entitlement.service");
const { VAHAN_API_TYPES } = require("../services/vahanStats.service");

/** { VAHAN_RC: 0, VAHAN_DL: 0, SUREPASS_RC: 0, ... } so every API always shows up. */
function emptyVahanCounts() {
  return Object.fromEntries(VAHAN_API_TYPES.map((t) => [t, 0]));
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = {
  /**
   * GET /admin/dashboard — high-level summary cards + breakdowns + 30-day trend.
   */
  getDashboard: async (req, res) => {
    const since30 = daysAgo(30);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [productCount, tenants, usageByTypeMonth, usageByDay, topTenantsRaw] =
      await Promise.all([
        db.product.count(),
        db.tenant.findAll({ include: [db.subscription], raw: false }),
        db.usageEvent.findAll({
          attributes: ["type", [fn("COUNT", col("id")), "count"]],
          where: { createdAt: { [Op.gte]: monthStart } },
          group: ["type"],
          raw: true,
        }),
        db.usageEvent.findAll({
          attributes: [
            [fn("DATE", col("createdAt")), "day"],
            [fn("COUNT", col("id")), "count"],
          ],
          where: { createdAt: { [Op.gte]: since30 } },
          group: [fn("DATE", col("createdAt"))],
          order: [[literal("day"), "ASC"]],
          raw: true,
        }),
        db.usageEvent.findAll({
          attributes: ["tenantId", [fn("COUNT", col("id")), "count"]],
          where: { createdAt: { [Op.gte]: since30 } },
          group: ["tenantId"],
          order: [[literal("count"), "DESC"]],
          limit: 5,
          raw: true,
        }),
      ]);

    // Tenant breakdowns + entitlement
    const byStatus = { ACTIVE: 0, SUSPENDED: 0 };
    const byBilling = { TRIAL: 0, ACTIVE: 0, SUSPENDED: 0 };
    let govAllowed = 0;
    let govBlocked = 0;
    for (const t of tenants) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      const bs = t.subscription ? t.subscription.billingStatus : "TRIAL";
      byBilling[bs] = (byBilling[bs] || 0) + 1;
      const allowed = t.status === "ACTIVE" && deriveGovApiAccess(t.subscription);
      allowed ? govAllowed++ : govBlocked++;
    }

    // Resolve top tenant names
    const topIds = topTenantsRaw.map((r) => r.tenantId);
    const topTenantRows = topIds.length
      ? await db.tenant.findAll({ where: { id: topIds }, raw: true })
      : [];
    const nameById = Object.fromEntries(
      topTenantRows.map((t) => [t.id, t.name || t.externalRef])
    );
    const topTenants = topTenantsRaw.map((r) => ({
      tenantId: r.tenantId,
      name: nameById[r.tenantId] || r.tenantId,
      count: Number(r.count),
    }));

    const usageThisMonth = usageByTypeMonth.reduce(
      (s, r) => s + Number(r.count),
      0
    );

    // Per-tenant, per-type usage this month (e.g. how many e-Way / e-Invoice /
    // VAHAN calls each mine made).
    const byTenantType = await db.usageEvent.findAll({
      attributes: ["tenantId", "type", [fn("COUNT", col("id")), "count"]],
      where: { createdAt: { [Op.gte]: monthStart } },
      group: ["tenantId", "type"],
      raw: true,
    });
    const tenantNameById = Object.fromEntries(
      tenants.map((t) => [t.id, t.name || t.externalRef])
    );
    const usageByTenantMap = {};
    for (const r of byTenantType) {
      const row =
        usageByTenantMap[r.tenantId] ||
        (usageByTenantMap[r.tenantId] = {
          tenantId: r.tenantId,
          name: tenantNameById[r.tenantId] || r.tenantId,
          total: 0,
          byType: {},
        });
      const c = Number(r.count);
      row.byType[r.type] = c;
      row.total += c;
    }
    const usageByTenant = Object.values(usageByTenantMap).sort(
      (a, b) => b.total - a.total
    );

    return res.json({
      success: true,
      data: {
        cards: {
          products: productCount,
          tenants: tenants.length,
          govAllowed,
          govBlocked,
          usageThisMonth,
        },
        tenantsByStatus: byStatus,
        tenantsByBilling: byBilling,
        usageThisMonthByType: usageByTypeMonth.map((r) => ({
          type: r.type,
          count: Number(r.count),
        })),
        usageTrend30d: usageByDay.map((r) => ({ day: r.day, count: Number(r.count) })),
        topTenants,
        usageByTenant,
      },
    });
  },

  /**
   * GET /admin/usage?from&to&productId&tenantId — usage analytics (totals + by
   * type + daily series).
   */
  getUsageAnalytics: async (req, res) => {
    const { from, to, productId, tenantId } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }
    if (productId) where.productId = productId;
    if (tenantId) where.tenantId = tenantId;

    const [byType, byDay, total] = await Promise.all([
      db.usageEvent.findAll({
        attributes: ["type", [fn("COUNT", col("id")), "count"]],
        where,
        group: ["type"],
        raw: true,
      }),
      db.usageEvent.findAll({
        attributes: [
          [fn("DATE", col("createdAt")), "day"],
          [fn("COUNT", col("id")), "count"],
        ],
        where,
        group: [fn("DATE", col("createdAt"))],
        order: [[literal("day"), "ASC"]],
        raw: true,
      }),
      db.usageEvent.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        byType: byType.map((r) => ({ type: r.type, count: Number(r.count) })),
        byDay: byDay.map((r) => ({ day: r.day, count: Number(r.count) })),
      },
    });
  },

  /**
   * GET /admin/vahan/stats?from&to&productId&tenantId — call counts for every
   * VAHAN-family API (Protean + SurePass + local DB searches): totals, per
   * calling product, and per month. `providerMonthly` is the global monthly
   * counter (vahanApiStats), bumped only when a provider lookup was saved —
   * use it to reconcile against Protean/SurePass invoices.
   */
  getVahanStats: async (req, res) => {
    const { from, to, productId, tenantId } = req.query;
    const where = { type: VAHAN_API_TYPES };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }
    if (productId) where.productId = productId;
    if (tenantId) where.tenantId = tenantId;

    const monthExpr = fn("DATE_FORMAT", col("createdAt"), "%Y-%m");
    const [byProductType, byMonthType, products, providerMonthly] =
      await Promise.all([
        db.usageEvent.findAll({
          attributes: ["productId", "type", [fn("COUNT", col("id")), "count"]],
          where,
          group: ["productId", "type"],
          raw: true,
        }),
        db.usageEvent.findAll({
          attributes: [[monthExpr, "month"], "type", [fn("COUNT", col("id")), "count"]],
          where,
          group: [monthExpr, "type"],
          order: [[literal("month"), "DESC"]],
          raw: true,
        }),
        db.product.findAll({ attributes: ["id", "name"], raw: true }),
        db.vahanApiStats.findAll({
          order: [["year", "DESC"], ["month", "DESC"]],
          limit: 24,
          raw: true,
        }),
      ]);

    const productName = Object.fromEntries(products.map((p) => [p.id, p.name]));
    const totals = emptyVahanCounts();
    const byProductMap = {};
    for (const r of byProductType) {
      const c = Number(r.count);
      totals[r.type] += c;
      const row =
        byProductMap[r.productId] ||
        (byProductMap[r.productId] = {
          productId: r.productId,
          name: productName[r.productId] || r.productId,
          total: 0,
          byApi: emptyVahanCounts(),
        });
      row.byApi[r.type] = c;
      row.total += c;
    }

    const byMonthMap = {};
    for (const r of byMonthType) {
      const row =
        byMonthMap[r.month] ||
        (byMonthMap[r.month] = { month: r.month, total: 0, byApi: emptyVahanCounts() });
      const c = Number(r.count);
      row.byApi[r.type] = c;
      row.total += c;
    }

    return res.json({
      success: true,
      data: {
        total: Object.values(totals).reduce((s, c) => s + c, 0),
        byApi: totals,
        byProduct: Object.values(byProductMap).sort((a, b) => b.total - a.total),
        byMonth: Object.values(byMonthMap),
        providerMonthly,
      },
    });
  },

  /**
   * GET /admin/tenants/:id/usage?from&to — per-tenant usage breakdown.
   */
  getTenantUsage: async (req, res) => {
    const where = { tenantId: req.params.id };
    const { from, to } = req.query;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }
    const [byType, total] = await Promise.all([
      db.usageEvent.findAll({
        attributes: ["type", [fn("COUNT", col("id")), "count"]],
        where,
        group: ["type"],
        raw: true,
      }),
      db.usageEvent.count({ where }),
    ]);
    return res.json({
      success: true,
      data: { total, byType: byType.map((r) => ({ type: r.type, count: Number(r.count) })) },
    });
  },
};
