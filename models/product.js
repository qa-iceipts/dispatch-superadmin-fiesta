"use strict";
const { Model } = require("sequelize");

/**
 * product — a client application/project that uses this platform-admin service
 * (e.g. "GVPR"). Each product authenticates its server-to-server calls with an
 * API key (stored hashed). Product-agnostic by design so other Iceipts projects
 * can plug in without schema changes.
 */
module.exports = (sequelize, DataTypes) => {
  class product extends Model {
    static associate(models) {
      product.hasMany(models.tenant, { foreignKey: "productId", onDelete: "CASCADE" });
    }
  }
  product.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      apiKeyHash: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    {
      sequelize,
      modelName: "product",
      defaultScope: { attributes: { exclude: ["apiKeyHash"] } },
      scopes: { withSecret: { attributes: {} } },
    }
  );
  return product;
};
