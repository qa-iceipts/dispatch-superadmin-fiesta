"use strict";
const express = require("express");
const router = express.Router();
const { PromiseHandler } = require("../middleware/error.handler");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const { resolveTenantEntitlement, meterUsage, meterDbSearch } = require("../middleware/govApiGate");
const vahanController = require("../controllers/vahan.controller");
const sendResVehicle = require("../services/vahanApis/rcEnc"); // POST /validate-vehicle
const sendResDL = require("../services/vahanApis/enc"); // POST /validate-dl

// All VAHAN routes are server-to-server (product backends) — require apiKey.
router.use(apiKeyAuth);

router.get(
  "/vehicle/:vehicleNumber",
  meterDbSearch("VEHICLE_DB_SEARCH"),
  PromiseHandler(vahanController.getVehicleFromDB)
);
router.get(
  "/driver/:dlNumber",
  meterDbSearch("DRIVER_DB_SEARCH"),
  PromiseHandler(vahanController.getDriverFromDB)
);

// Live government-API validations — entitlement-gated AT THE SOURCE + metered.
router.post(
  "/validate-vehicle",
  resolveTenantEntitlement,
  meterUsage("VAHAN_RC"),
  PromiseHandler(sendResVehicle)
);
router.post(
  "/validate-dl",
  resolveTenantEntitlement,
  meterUsage("VAHAN_DL"),
  PromiseHandler(sendResDL)
);

// Save to local cache.
router.post("/save-vehicle", PromiseHandler(vahanController.saveVehicleData));
router.post("/save-driver", PromiseHandler(vahanController.saveDriverData));

module.exports = router;
