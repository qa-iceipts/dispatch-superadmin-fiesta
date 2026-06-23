"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class staticVehicleData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) { }
  }
  staticVehicleData.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      truckOwner: {
        type: DataTypes.STRING,
      },
      address: {
        type: DataTypes.STRING,
      },
      pincode: {
        type: DataTypes.STRING,
      },
      state: {
        type: DataTypes.STRING,
      },
      city: {
        type: DataTypes.STRING,
      },
      truckNo: {
        type: DataTypes.STRING,
      },
      type: {
        type: DataTypes.STRING,
      },
      phoneNumber: {
        type: DataTypes.STRING,
      },
      rcBook: {
        type: DataTypes.BOOLEAN,
      },
      fitnessCertificate: {
        type: DataTypes.BOOLEAN,
      },
      puccValidUpto: {
        type: DataTypes.STRING,
      },
      rcExpiryDate: {
        type: DataTypes.STRING,
      },
      vehicleInsuranceUpto: {
        type: DataTypes.TEXT,
      },
      fullDataJson: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      regDate: {
        type: DataTypes.STRING,
      },
      permitValidUpto: {
        type: DataTypes.STRING,
      },
      vehicleTaxUpto: {
        type: DataTypes.STRING,
      },
      fitnessValidUpto: {
        type: DataTypes.STRING,
      },
      // Vehicle identification
      chassis: {
        type: DataTypes.STRING,
      },
      engine: {
        type: DataTypes.STRING,
      },
      // Vehicle details
      vehicleManufacturerName: {
        type: DataTypes.STRING,
      },
      model: {
        type: DataTypes.STRING,
      },
      vehicleColour: {
        type: DataTypes.STRING,
      },
      normsType: {
        type: DataTypes.STRING,
      },
      bodyType: {
        type: DataTypes.STRING,
      },
      vehicleClass: {
        type: DataTypes.STRING,
      },
      vehicleCategory: {
        type: DataTypes.STRING,
      },
      // Weight and capacity
      grossVehicleWeight: {
        type: DataTypes.STRING,
      },
      unladenWeight: {
        type: DataTypes.STRING,
      },
      vehicleSeatCapacity: {
        type: DataTypes.STRING,
      },
      // Owner details
      ownerCount: {
        type: DataTypes.STRING,
      },
      // Status info
      status: {
        type: DataTypes.STRING,
      },
      blacklistStatus: {
        type: DataTypes.STRING,
      },
      // Insurance details
      vehicleInsuranceCompanyName: {
        type: DataTypes.STRING,
      },
      vehicleInsurancePolicyNumber: {
        type: DataTypes.STRING,
      },
      // Registration info
      rtoCode: {
        type: DataTypes.STRING,
      },
      regAuthority: {
        type: DataTypes.STRING,
      },
      isCommercial: {
        type: DataTypes.BOOLEAN,
      },
    },
    {
      sequelize,
      modelName: "staticVehicleData",
      defaultScope: {
        // exclude password hash by default
        attributes: { exclude: ["createdAt", "updatedAt"] },
      },
    }
  );

  return staticVehicleData;
};
