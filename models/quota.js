"use strict";
const { Model } = require("sequelize");

/**
 * quota — a generic per-tenant limit (e.g. key="maxEmployees", value=25).
 * Generic key/value so any product can define its own limits without schema
 * changes. value=null means unlimited.
 */
module.exports = (sequelize, DataTypes) => {
  class quota extends Model {
    static associate(models) {
      quota.belongsTo(models.tenant, { foreignKey: "tenantId", onDelete: "CASCADE" });
    }
  }
  quota.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      tenantId: { type: DataTypes.UUID, allowNull: false },
      key: { type: DataTypes.STRING, allowNull: false },
      value: { type: DataTypes.INTEGER }, // null = unlimited
    },
    {
      sequelize,
      modelName: "quota",
      indexes: [{ unique: true, fields: ["tenantId", "key"] }],
    }
  );
  return quota;
};
