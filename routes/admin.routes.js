"use strict";
const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const { PromiseHandler } = require("../middleware/error.handler");
const c = require("../controllers/admin.controller");
const d = require("../controllers/dashboard.controller");
const f = require("../controllers/fleet.controller");

// Superadmin console APIs. All routes require adminAuth (M1 token placeholder).
router.use(adminAuth);

// Dashboard & analytics
router.get("/dashboard", PromiseHandler(d.getDashboard));
router.get("/usage", PromiseHandler(d.getUsageAnalytics));

// Clients (real mine logins, created via apiserver — auto-approved, no OTP)
router.post("/clients", PromiseHandler(c.createClient));

// Products
router.post("/products", PromiseHandler(c.createProduct));
router.get("/products", PromiseHandler(c.listProducts));

// Tenants
router.post("/tenants", PromiseHandler(c.createTenant));
router.get("/tenants", PromiseHandler(c.listTenants));
router.get("/tenants/:id", PromiseHandler(c.getTenant));
router.get("/tenants/:id/usage", PromiseHandler(d.getTenantUsage));
router.put("/tenants/:id/billing", PromiseHandler(c.setBilling));
router.put("/tenants/:id/gov-access", PromiseHandler(c.setGovAccess));
router.put("/tenants/:id/quota", PromiseHandler(c.setQuota));

// Vehicle registry
router.get("/vehicles", PromiseHandler(f.listVehicles));
router.post("/vehicles", PromiseHandler(f.createVehicle));
router.post("/vehicles/import", PromiseHandler(f.importVehicles));
router.get("/vehicles/:id", PromiseHandler(f.getVehicle));
router.put("/vehicles/:id", PromiseHandler(f.updateVehicle));
router.delete("/vehicles/:id", PromiseHandler(f.deleteVehicle));

// Driver (DL) registry
router.get("/drivers", PromiseHandler(f.listDrivers));
router.post("/drivers", PromiseHandler(f.createDriver));
router.post("/drivers/import", PromiseHandler(f.importDrivers));
router.get("/drivers/:id", PromiseHandler(f.getDriver));
router.put("/drivers/:id", PromiseHandler(f.updateDriver));
router.delete("/drivers/:id", PromiseHandler(f.deleteDriver));

module.exports = router;
