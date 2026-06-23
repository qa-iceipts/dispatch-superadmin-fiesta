"use strict";
const { Model } = require("sequelize");

/**
 * vehicleMaster — the central, superadmin-managed vehicle (truck) registry.
 * Distinct from `staticVehicleData` (which is the VAHAN gov-API response cache).
 * Columns mirror the operational vehicle export so a CSV can be imported as-is.
 */
module.exports = (sequelize, DataTypes) => {
  class vehicleMaster extends Model {
    static associate(models) {}
  }
  vehicleMaster.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      truckOwner: { type: DataTypes.STRING },
      address: { type: DataTypes.TEXT },
      pincode: { type: DataTypes.STRING },
      state: { type: DataTypes.STRING },
      city: { type: DataTypes.STRING },
      truckNo: { type: DataTypes.STRING },
      type: { type: DataTypes.STRING },
      phoneNumber: { type: DataTypes.STRING },
      rcBook: { type: DataTypes.BOOLEAN, defaultValue: false },
      fitnessCertificate: { type: DataTypes.BOOLEAN, defaultValue: false },
      puccValidUpto: { type: DataTypes.STRING },
      rcExpiryDate: { type: DataTypes.STRING },
      vehicleInsuranceUpto: { type: DataTypes.STRING },
      registrationDate: { type: DataTypes.STRING },
      vehicleChasisNumber: { type: DataTypes.STRING },
      vehicleEngineNumber: { type: DataTypes.STRING },
      makerModel: { type: DataTypes.STRING },
      bodyType: { type: DataTypes.STRING },
      fuelType: { type: DataTypes.STRING },
      vehicleGrossWeight: { type: DataTypes.STRING },
      unladenWeight: { type: DataTypes.STRING },
      fitUpTo: { type: DataTypes.STRING },
      insuranceCompany: { type: DataTypes.STRING },
      insurancePolicyNumber: { type: DataTypes.STRING },
      financer: { type: DataTypes.STRING },
      financed: { type: DataTypes.BOOLEAN, defaultValue: false },
      permitNumber: { type: DataTypes.STRING },
      permitValidUpto: { type: DataTypes.STRING },
      permitType: { type: DataTypes.STRING },
      nationalPermitNumber: { type: DataTypes.STRING },
      nationalPermitUpto: { type: DataTypes.STRING },
      taxUpto: { type: DataTypes.STRING },
      blacklistStatus: { type: DataTypes.STRING },
    },
    {
      sequelize,
      modelName: "vehicleMaster",
    }
  );
  return vehicleMaster;
};
