"use strict";
const { Model } = require("sequelize");

/**
 * subscription — billing state for a tenant. Drives the gov-API pay-gate via the
 * derived `govApiAccess` entitlement (see services/entitlement.service.js).
 * 1:1 with tenant.
 */
module.exports = (sequelize, DataTypes) => {
  class subscription extends Model {
    static associate(models) {
      subscription.belongsTo(models.tenant, { foreignKey: "tenantId", onDelete: "CASCADE" });
    }
  }
  subscription.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      tenantId: { type: DataTypes.UUID, allowNull: false, unique: true },
      planName: { type: DataTypes.STRING },
      billingStatus: {
        type: DataTypes.ENUM("TRIAL", "ACTIVE", "SUSPENDED"),
        allowNull: false,
        defaultValue: "TRIAL",
      },
      paidUntil: { type: DataTypes.DATE },
      // null => derive from billingStatus/paidUntil; true/false => manual override
      govApiAccessOverride: { type: DataTypes.BOOLEAN },
    },
    { sequelize, modelName: "subscription" }
  );
  return subscription;
};
