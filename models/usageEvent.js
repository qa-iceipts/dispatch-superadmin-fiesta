"use strict";
const { Model } = require("sequelize");

/**
 * usageEvent — one row per billable government-API call, per tenant. Drives
 * usage reporting and invoice line items. Append-only.
 */
module.exports = (sequelize, DataTypes) => {
  class usageEvent extends Model {
    static associate(models) {
      usageEvent.belongsTo(models.tenant, { foreignKey: "tenantId", onDelete: "CASCADE" });
    }
  }
  usageEvent.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      tenantId: { type: DataTypes.UUID, allowNull: false },
      productId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false }, // VAHAN_RC | VAHAN_DL | EWAY_GEN | EINVOICE_GEN ...
      ref: { type: DataTypes.STRING }, // vehicleNo / dlNumber / docNo (optional)
      status: { type: DataTypes.STRING }, // SUCCESS | FAIL
    },
    {
      sequelize,
      modelName: "usageEvent",
      indexes: [{ fields: ["tenantId", "type", "createdAt"] }],
    }
  );
  return usageEvent;
};
