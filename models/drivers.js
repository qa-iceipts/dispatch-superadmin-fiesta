"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class drivers extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // drivers.hasMany(models.vehicleDetails, { onDelete: "CASCADE" });
    }
  }
  drivers.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      driverImage: {
        type: DataTypes.TEXT,
      },
      dlNumber: {
        type: DataTypes.STRING,
      },
      fullName: {
        type: DataTypes.STRING,
      },
      email: {
        type: DataTypes.STRING,
      },
      mobile: {
        type: DataTypes.STRING,
      },
      address: {
        type: DataTypes.STRING,
      },
      joiningDate: {
        type: DataTypes.DATE,
      },
      salary: {
        type: DataTypes.DOUBLE,
      },
      gender: {
        type: DataTypes.STRING,
      },
      assets: {
        type: DataTypes.STRING,
      },
      assignVehicle: {
        type: DataTypes.STRING,
      },
      uploadAadharCard: {
        type: DataTypes.STRING,
      },
      uploadDrivingLic: {
        type: DataTypes.STRING,
      },
      userId: {
        type: DataTypes.STRING,
      },
      pan: {
        type: DataTypes.STRING,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      dob: {
        type: DataTypes.DATE,
      },
      dlValidUpto: {
        type: DataTypes.DATE,
      },
      // Additional fields from VAHAN DL API
      fatherOrHusband: {
        type: DataTypes.STRING,
      },
      bloodGroup: {
        type: DataTypes.STRING,
      },
      dlIssueDate: {
        type: DataTypes.STRING,
      },
      dlValidityNonTransport: {
        type: DataTypes.STRING,
      },
      dlValidityTransport: {
        type: DataTypes.STRING,
      },
      covDetails: {
        type: DataTypes.JSON,
        defaultValue: [],
      },
      state: {
        type: DataTypes.STRING,
      },
      district: {
        type: DataTypes.STRING,
      },
      pincode: {
        type: DataTypes.STRING,
      },
      completeAddress: {
        type: DataTypes.TEXT,
      },
      dlStatus: {
        type: DataTypes.STRING,
      },
      statusDetails: {
        type: DataTypes.TEXT,
      },
      endorsementAndHazardousDetails: {
        type: DataTypes.TEXT,
      },
      fullDataJson: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: "drivers",
      defaultScope: {
        // exclude password hash by default
        attributes: { exclude: ["createdAt", "updatedAt"] },
      },
    }
  );

  return drivers;
};
