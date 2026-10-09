"use strict";
/**
 * Shared counters for the VAHAN-family APIs (Protean VAHAN + SurePass + local
 * DB searches).
 * @module vahanStats.service
 */
const moment = require("moment-timezone");
const db = require("../models");

/**
 * usageEvent.type values that belong to the VAHAN family. Every product that
 * calls /v1/vahan/* is metered under one of these, per tenant.
 */
const VAHAN_API_TYPES = [
  "VAHAN_RC", // Protean vehicle RC
  "VAHAN_DL", // Protean driving licence
  "SUREPASS_RC", // SurePass vehicle RC
  "SUREPASS_DL", // SurePass driving licence
  "VEHICLE_DB_SEARCH", // local registry/cache lookup (free)
  "DRIVER_DB_SEARCH", // local registry/cache lookup (free)
];

/**
 * Increment a global monthly counter on vahanApiStats (vehicleEntryCount,
 * dlNumberCount, surepassRcCount, surepassDlCount). Never throws — a counter
 * failure must not fail an already-successful lookup.
 */
async function bumpVahanStat(field) {
  try {
    const month = moment().month() + 1;
    const year = moment().year();
    const [stats] = await db.vahanApiStats.findOrCreate({
      where: { month, year },
      defaults: { month, year },
    });
    await stats.increment(field);
  } catch (e) {
    console.error(`[vahanStats] failed to bump ${field}:`, e.message);
  }
}

module.exports = { VAHAN_API_TYPES, bumpVahanStat };
