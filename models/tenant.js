"use strict";
const { Model } = require("sequelize");

/**
 * tenant — a billable unit within a product. For GVPR a tenant = one mine
 * (externalRef = the MINES user's userId in apiserver). `externalRef` is how the
 * product refers to the tenant; this service never needs the product's internals.
 */
module.exports = (sequelize, DataTypes) => {
  class tenant extends Model {
    static associate(models) {
      tenant.belongsTo(models.product, { foreignKey: "productId", onDelete: "CASCADE" });
      tenant.hasOne(models.subscription, { foreignKey: "tenantId", onDelete: "CASCADE" });
      tenant.hasMany(models.quota, { foreignKey: "tenantId", as: "quota", onDelete: "CASCADE" });
    }
  }
  tenant.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      productId: { type: DataTypes.UUID, allowNull: false },
      externalRef: { type: DataTypes.STRING, allowNull: false }, // product's id for the tenant
      name: { type: DataTypes.STRING },
      status: {
        type: DataTypes.ENUM("ACTIVE", "SUSPENDED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      metadata: { type: DataTypes.JSON },
    },
    {
      sequelize,
      modelName: "tenant",
      indexes: [{ unique: true, fields: ["productId", "externalRef"] }],
    }
  );
  return tenant;
};
