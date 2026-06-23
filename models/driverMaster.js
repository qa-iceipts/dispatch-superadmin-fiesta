"use strict";
const { Model } = require("sequelize");

/**
 * driverMaster — the central, superadmin-managed driver / DL registry.
 * Distinct from `drivers` (which is the VAHAN DL gov-API response cache).
 * Columns mirror the operational driver export so a CSV can be imported as-is.
 */
module.exports = (sequelize, DataTypes) => {
  class driverMaster extends Model {
    static associate(models) {}
  }
  driverMaster.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      driverImage: { type: DataTypes.TEXT },
      dlNumber: { type: DataTypes.STRING },
      fullName: { type: DataTypes.STRING },
      email: { type: DataTypes.STRING },
      mobile: { type: DataTypes.STRING },
      address: { type: DataTypes.TEXT },
      joiningDate: { type: DataTypes.STRING },
      salary: { type: DataTypes.DOUBLE },
      gender: { type: DataTypes.STRING },
      assets: { type: DataTypes.STRING },
      assignVehicle: { type: DataTypes.STRING },
      uploadAadharCard: { type: DataTypes.TEXT },
      uploadDrivingLic: { type: DataTypes.TEXT },
      userId: { type: DataTypes.STRING },
      pan: { type: DataTypes.STRING },
      isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
      dob: { type: DataTypes.STRING },
      dlValidUpto: { type: DataTypes.STRING },
      fatherOrHusbandName: { type: DataTypes.STRING },
      vehicleClasses: { type: DataTypes.TEXT },
      bloodGroup: { type: DataTypes.STRING },
      dlIssueDate: { type: DataTypes.STRING },
      state: { type: DataTypes.STRING },
    },
    {
      sequelize,
      modelName: "driverMaster",
    }
  );
  return driverMaster;
};
