"use strict";
const express = require("express");
const router = express.Router();
const apiKeyAuth = require("../middleware/apiKeyAuth");
const { PromiseHandler } = require("../middleware/error.handler");
const c = require("../controllers/integration.controller");

// Server-to-server (product backends). All routes require apiKeyAuth.
router.use(apiKeyAuth);

router.post("/tenants", PromiseHandler(c.upsertTenant));
router.get("/entitlement", PromiseHandler(c.getEntitlement));
router.post("/usage", PromiseHandler(c.recordUsage));

module.exports = router;
