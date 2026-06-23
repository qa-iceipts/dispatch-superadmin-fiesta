"use strict";

/**
 * Derive whether a tenant may use government APIs, from its subscription.
 * Order: manual override > suspended > trial > active(paid).
 */
function deriveGovApiAccess(subscription) {
  if (!subscription) return false;
  if (typeof subscription.govApiAccessOverride === "boolean") {
    return subscription.govApiAccessOverride;
  }
  switch (subscription.billingStatus) {
    case "SUSPENDED":
      return false;
    case "TRIAL":
      return true;
    case "ACTIVE": {
      if (!subscription.paidUntil) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(subscription.paidUntil) >= today;
    }
    default:
      return false;
  }
}

/**
 * Build the entitlement payload consumed by product backends (apiserver).
 * @param {Object} tenant
 * @param {Object} subscription
 * @param {Array} quotas - [{key, value}]
 */
function buildEntitlement(tenant, subscription, quotas = []) {
  const quotaMap = {};
  for (const q of quotas) quotaMap[q.key] = q.value;
  return {
    tenantId: tenant ? tenant.id : null,
    tenantStatus: tenant ? tenant.status : null,
    billingStatus: subscription ? subscription.billingStatus : null,
    paidUntil: subscription ? subscription.paidUntil : null,
    govApiAccess:
      tenant && tenant.status === "ACTIVE" && deriveGovApiAccess(subscription),
    quotas: quotaMap,
  };
}

module.exports = { deriveGovApiAccess, buildEntitlement };
