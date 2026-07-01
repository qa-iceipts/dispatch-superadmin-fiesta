const createHttpError = require('http-errors');
const logger = require('../helpers/logger');
const { drivers, staticVehicleData, vehicleMaster, driverMaster } = require('../models');
// Live VAHAN/DL validation is handled by services/vahanApis (enc/rcEnc) wired
// directly in the routes; this controller only does local DB cache get/save.

/**
 * Get vehicle RC details from the local DB — the pre-VAHAN lookup. Checks the
 * superadmin-managed registry (vehicleMaster, CSV-imported fleet) first, then
 * the VAHAN response cache (staticVehicleData). Returns the row with a `_source`
 * tag. 404 if neither has it (caller then falls back to the live VAHAN API).
 */
exports.getVehicleFromDB = async (req, res, next) => {
  const { vehicleNumber } = req.params;

  let vehicle = await vehicleMaster.findOne({ where: { truckNo: vehicleNumber } });
  let source = 'registry';
  if (!vehicle) {
    vehicle = await staticVehicleData.findOne({ where: { truckNo: vehicleNumber } });
    source = 'vahan_cache';
  }

  if (!vehicle) {
    throw new createHttpError.NotFound('Vehicle not found in local database');
  }

  return res.sendResponse(
    { ...vehicle.toJSON(), _source: source },
    'Vehicle found in local database'
  );
};

/**
 * Get driver DL details from the local DB — the pre-VAHAN lookup. Checks the
 * superadmin-managed registry (driverMaster) first, then the VAHAN DL cache
 * (drivers). 404 if neither (caller then falls back to the live VAHAN DL API).
 */
exports.getDriverFromDB = async (req, res, next) => {
  const { dlNumber } = req.params;

  let driver = await driverMaster.findOne({ where: { dlNumber } });
  let source = 'registry';
  if (!driver) {
    driver = await drivers.findOne({ where: { dlNumber } });
    source = 'vahan_cache';
  }

  if (!driver) {
    throw new createHttpError.NotFound('Driver not found in local database');
  }

  return res.sendResponse(
    { ...driver.toJSON(), _source: source },
    'Driver found in local database'
  );
};

/**
 * Save vehicle data to local database
 */
exports.saveVehicleData = async (req, res, next) => {
  try {
    const vehicleData = req.body;

    if (!vehicleData.truckNo) {
      throw new createHttpError.BadRequest('truckNo is required');
    }

    let vehicle = await staticVehicleData.findOne({
      where: { truckNo: vehicleData.truckNo }
    });

    if (vehicle) {
      await vehicle.update(vehicleData);
      logger.info('Vehicle data updated', { truckNo: vehicleData.truckNo });
    } else {
      vehicle = await staticVehicleData.create(vehicleData);
      logger.info('Vehicle data saved', { truckNo: vehicleData.truckNo });
    }

    return res.sendResponse(vehicle, 'Vehicle data saved successfully');
  } catch (error) {
    logger.error('Save vehicle data error', {
      service: 'vahan-controller',
      error: error.message
    });
    next(error);
  }
};

/**
 * Save driver data to local database
 */
exports.saveDriverData = async (req, res, next) => {
  try {
    const driverData = req.body;

    if (!driverData.dlNumber) {
      throw new createHttpError.BadRequest('dlNumber is required');
    }

    let driver = await drivers.findOne({
      where: { dlNumber: driverData.dlNumber }
    });

    if (driver) {
      await driver.update(driverData);
      logger.info('Driver data updated', { dlNumber: driverData.dlNumber });
    } else {
      driver = await drivers.create(driverData);
      logger.info('Driver data saved', { dlNumber: driverData.dlNumber });
    }

    return res.sendResponse(driver, 'Driver data saved successfully');
  } catch (error) {
    logger.error('Save driver data error', {
      service: 'vahan-controller',
      error: error.message
    });
    next(error);
  }
};
