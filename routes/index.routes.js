"use strict";
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.json({ service: "dispatcher-superadmin", ok: true }));

router.use("/v1/vahan", require("./vahan.routes")); // gov-API gateway (VAHAN/DL)
router.use("/v1", require("./integration.routes")); // product backends (apiKey)
router.use("/admin", require("./admin.routes")); // superadmin console

module.exports = router;
