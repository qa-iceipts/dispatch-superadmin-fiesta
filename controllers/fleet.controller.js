"use strict";
const { parse } = require("csv-parse/sync");
const { Op } = require("sequelize");
const db = require("../models");
const { createHttpError } = require("../middleware/error.handler");

/**
 * fleet.controller — central vehicle & driver (DL) registries managed by the
 * superadmin: paginated listing, create / update / delete, and CSV import.
 *
 * Both entities are handled by one generic implementation parameterized by a
 * model + its searchable columns, so vehicles and drivers stay in lock-step.
 */

// Columns we never accept from the client/CSV — managed by Sequelize / the PK.
const PROTECTED = new Set(["createdAt", "updatedAt"]);

/** The model's own writable attributes (everything except timestamps). */
function writableAttrs(model) {
  return Object.keys(model.rawAttributes).filter((a) => !PROTECTED.has(a));
}

/** Booleans / numbers, derived from the model so coercion stays in sync. */
function typedAttrs(model) {
  const bool = new Set();
  const num = new Set();
  for (const [name, def] of Object.entries(model.rawAttributes)) {
    const key = def.type && def.type.key;
    if (key === "BOOLEAN") bool.add(name);
    else if (["DOUBLE", "FLOAT", "INTEGER", "DECIMAL"].includes(key)) num.add(name);
  }
  return { bool, num };
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v === null || v === undefined || v === "") return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

/**
 * Keep only known columns, coerce types, drop empty id so a UUID is generated.
 * Used for both single create/update and CSV rows.
 */
function sanitize(model, raw, { keepId }) {
  const allowed = new Set(writableAttrs(model));
  const { bool, num } = typedAttrs(model);
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!allowed.has(k) || PROTECTED.has(k)) continue;
    if (k === "id") {
      if (keepId && v !== null && v !== undefined && String(v).trim() !== "") {
        out.id = String(v).trim();
      }
      continue;
    }
    if (bool.has(k)) out[k] = toBool(v);
    else if (num.has(k)) out[k] = v === "" || v === null || v === undefined ? null : Number(v);
    else out[k] = v === undefined ? null : v;
  }
  return out;
}

/** GET list with pagination + optional search across `searchCols`. */
async function list(model, searchCols, req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const q = (req.query.q || "").trim();

  const where = {};
  if (q && searchCols.length) {
    where[Op.or] = searchCols.map((c) => ({ [c]: { [Op.like]: `%${q}%` } }));
  }

  const { rows, count } = await model.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
  });

  return res.json({
    success: true,
    data: {
      rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit) || 1,
    },
  });
}

async function getOne(model, req, res) {
  const row = await model.findByPk(req.params.id);
  if (!row) throw new createHttpError.NotFound("not found");
  return res.json({ success: true, data: row });
}

async function create(model, req, res) {
  const payload = sanitize(model, req.body, { keepId: true });
  const row = await model.create(payload);
  return res.status(201).json({ success: true, data: row });
}

async function update(model, req, res) {
  const row = await model.findByPk(req.params.id);
  if (!row) throw new createHttpError.NotFound("not found");
  const payload = sanitize(model, req.body, { keepId: false });
  await row.update(payload);
  return res.json({ success: true, data: row });
}

async function remove(model, req, res) {
  const row = await model.findByPk(req.params.id);
  if (!row) throw new createHttpError.NotFound("not found");
  await row.destroy();
  return res.json({ success: true, data: { id: req.params.id, deleted: true } });
}

/**
 * POST import — body { csv: "<raw csv text>" }. First row = headers (must match
 * the export column names). Rows with an existing `id` are updated; the rest are
 * inserted. Unknown columns are ignored, so createdAt/updatedAt in the file are
 * harmless.
 */
async function importCsv(model, req, res) {
  // Accept either a raw text body (Content-Type text/csv|text/plain) or a
  // JSON body { csv: "..." } (handy for Postman). Raw text is preferred for
  // large files because it avoids JSON-string escaping overhead.
  const csv = typeof req.body === "string" ? req.body : req.body && req.body.csv;
  if (!csv || typeof csv !== "string" || !csv.trim()) {
    throw new createHttpError.BadRequest("csv (string) is required");
  }
  // Auto-detect delimiter from the header line so both comma CSV and
  // tab-separated (TSV, e.g. pasted from a spreadsheet) exports work.
  const headerLine = csv.replace(/^﻿/, "").split(/\r?\n/)[0] || "";
  const delimiter =
    (headerLine.match(/\t/g) || []).length >
    (headerLine.match(/,/g) || []).length
      ? "\t"
      : ",";

  let records;
  try {
    records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      // Real-world spreadsheet exports often have stray/unescaped quotes inside
      // fields (e.g. an address or measurement with a " mark). Be tolerant of
      // them instead of failing the whole import, and skip lines that still
      // cannot be parsed rather than aborting everything.
      relax_quotes: true,
      skip_records_with_error: true,
      delimiter,
    });
  } catch (e) {
    throw new createHttpError.BadRequest(`CSV parse error: ${e.message}`);
  }
  if (!records.length) {
    throw new createHttpError.BadRequest("CSV has no data rows");
  }

  const rows = records.map((r) => sanitize(model, r, { keepId: true }));
  const updatable = writableAttrs(model).filter((a) => a !== "id");

  const result = await model.bulkCreate(rows, {
    updateOnDuplicate: updatable,
    validate: false,
  });

  return res.status(201).json({
    success: true,
    data: { imported: result.length, parsed: records.length },
  });
}

// ── Bind the generic handlers to each model ───────────────────────────────
const VEHICLE_SEARCH = ["truckNo", "truckOwner", "phoneNumber", "city", "state"];
const DRIVER_SEARCH = ["dlNumber", "fullName", "mobile", "email", "pan"];

module.exports = {
  // Vehicles
  listVehicles: (req, res) => list(db.vehicleMaster, VEHICLE_SEARCH, req, res),
  getVehicle: (req, res) => getOne(db.vehicleMaster, req, res),
  createVehicle: (req, res) => create(db.vehicleMaster, req, res),
  updateVehicle: (req, res) => update(db.vehicleMaster, req, res),
  deleteVehicle: (req, res) => remove(db.vehicleMaster, req, res),
  importVehicles: (req, res) => importCsv(db.vehicleMaster, req, res),

  // Drivers (DL)
  listDrivers: (req, res) => list(db.driverMaster, DRIVER_SEARCH, req, res),
  getDriver: (req, res) => getOne(db.driverMaster, req, res),
  createDriver: (req, res) => create(db.driverMaster, req, res),
  updateDriver: (req, res) => update(db.driverMaster, req, res),
  deleteDriver: (req, res) => remove(db.driverMaster, req, res),
  importDrivers: (req, res) => importCsv(db.driverMaster, req, res),
};
