"use strict";
/**
 * SurePass KYC integrations (vehicle RC + driving licence), exposed to product
 * backends through the /v1/vahan gateway. Ported from GVPR/GRM transport
 * (services/surrpass.service.js) and mapped onto this service's
 * staticVehicleData / drivers cache.
 * @module surepass.service
 */
const axios = require("axios");
const moment = require("moment-timezone");
const createHttpError = require("http-errors");
const db = require("../models");
const { bumpVahanStat } = require("./vahanStats.service");

// SUREPASS_ENV=PROD|UAT, mirroring VAHANENV — independent of NODE_ENV so a
// staging deploy running NODE_ENV=production doesn't hit the paid prod API.
const isProduction = process.env.SUREPASS_ENV === "PROD";
const SUREPASS_BASE_URL = isProduction
  ? process.env.SUREPASS_PROD_BASE_URL
  : process.env.SUREPASS_BASE_URL;
const SUREPASS_TOKEN = isProduction
  ? process.env.SUREPASS_PROD_TOKEN
  : process.env.SUREPASS_TOKEN;
const SUREPASS_TIMEOUT_MS = Number(process.env.SUREPASS_TIMEOUT_MS) || 20000;

/**
 * Map a SurePass status to the status we send the calling product.
 *
 * Only genuine "bad input" statuses pass through. Anything that means SurePass
 * rejected *our server* (401/403: bad token, IP not whitelisted), throttled us
 * (429) or broke (5xx) becomes 502. Passing a 401 through would make a product
 * frontend treat it as an expired user session and log the user out.
 */
const PASS_THROUGH_STATUSES = [400, 404, 422];

function toClientStatus(upstreamStatus) {
  return PASS_THROUGH_STATUSES.includes(upstreamStatus) ? upstreamStatus : 502;
}

function isConfigured() {
  return Boolean(SUREPASS_BASE_URL && SUREPASS_TOKEN);
}

/**
 * POST to SurePass and unwrap the envelope, turning upstream failures into
 * HTTP errors that are safe for the caller to receive.
 */
async function callSurepass(path, payload) {
  if (!isConfigured()) {
    throw createHttpError[500](
      "SurePass is not configured (SUREPASS_BASE_URL / SUREPASS_TOKEN)"
    );
  }

  let body;
  try {
    const response = await axios.post(SUREPASS_BASE_URL + path, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + SUREPASS_TOKEN,
      },
      timeout: SUREPASS_TIMEOUT_MS,
    });
    body = response.data;
  } catch (error) {
    const errBody = error.response && error.response.data;
    if (!errBody) {
      throw createHttpError[504](`SurePass did not respond: ${error.message}`);
    }
    const upstreamStatus =
      Number(errBody.status_code) || error.response.status || 502;
    const message =
      errBody.message || errBody.message_code || "SurePass lookup failed";
    console.error("[SurePass] error:", path, upstreamStatus, message);
    throw createHttpError(toClientStatus(upstreamStatus), `SurePass: ${message}`);
  }

  if (!body || !body.success || !body.data) {
    throw createHttpError[502](
      (body && (body.message || body.message_code)) || "SurePass returned no data"
    );
  }
  return body.data;
}

/** Empty strings and blanks from SurePass become null so they never overwrite good data. */
function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

/**
 * SurePass can return malformed dates such as "2099-09-00", and "1800-01-01"
 * as a "not applicable" placeholder - drop both.
 */
function cleanDate(value) {
  const str = clean(value);
  if (!str) return null;
  const parsed = moment(str, "YYYY-MM-DD", true);
  if (!parsed.isValid() || parsed.year() < 1900) return null;
  return parsed.format("YYYY-MM-DD");
}

function normalizeVehicleNumber(value) {
  return clean(value)
    ? String(value).toUpperCase().replace(/[^A-Z0-9]/g, "")
    : null;
}

/** SurePass DL expects YYYY-MM-DD; products send DD-MM-YYYY or DD/MM/YYYY too. */
function normalizeDob(value) {
  const str = clean(value);
  if (!str) return null;
  const parsed = moment(str, ["YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY"], true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

/** "DELHI, Delhi" -> { city: "DELHI", state: "Delhi" } */
function splitRegisteredAt(registeredAt) {
  const value = clean(registeredAt);
  if (!value) return { city: null, state: null };
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { city: parts[0] || null, state: null };
  return {
    city: parts.slice(0, -1).join(", "),
    state: parts[parts.length - 1],
  };
}

function extractPincode(address) {
  const value = clean(address);
  const match = value && value.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

/** Drop nulls so a sparse SurePass response never wipes values already on the row. */
function withoutNulls(fields) {
  return Object.keys(fields).reduce((acc, key) => {
    if (fields[key] !== null) acc[key] = fields[key];
    return acc;
  }, {});
}

/**
 * POST /v1/vahan/vehicle-rc-surepass  { vehicleNumber }
 */
async function getVehicleRc(req, res) {
  const vehicleNumber = normalizeVehicleNumber(req.body.vehicleNumber);
  if (!vehicleNumber) throw createHttpError[400]("vehicleNumber is required");

  // Primary: rc-v2. If it fails for any upstream reason, fall back to rc-full,
  // which returns the same keys the mapping below reads.
  let data;
  try {
    data = await callSurepass("/api/v1/rc/rc-v2", {
      id_number: vehicleNumber,
      enrich: true,
    });
  } catch (primaryError) {
    // A missing config would fail the fallback too, so don't retry.
    if (!isConfigured()) throw primaryError;
    console.error(
      "[SurePass] rc-v2 failed, falling back to rc-full:",
      primaryError.message
    );
    data = await callSurepass("/api/v1/rc/rc-full", { id_number: vehicleNumber });
  }

  const truckNo = normalizeVehicleNumber(data.rc_number) || vehicleNumber;
  const metadata = data.response_metadata || {};
  const { city, state } = splitRegisteredAt(data.registered_at);

  const mapped = withoutNulls({
    // Sandbox returns "R***N K****R" - never overwrite a real owner with a mask.
    truckOwner: metadata.masked_owner_name ? null : clean(data.owner_name),
    address: clean(data.present_address),
    pincode: extractPincode(data.present_address),
    state,
    city,
    phoneNumber: clean(data.mobile_number),
    chassis: clean(data.vehicle_chasi_number),
    engine: clean(data.vehicle_engine_number),
    vehicleManufacturerName: clean(data.maker_description),
    model: clean(data.maker_model),
    vehicleColour: clean(data.color),
    normsType: clean(data.norms_type),
    bodyType: clean(data.body_type),
    vehicleCategory: clean(data.vehicle_category),
    vehicleClass: clean(data.vehicle_category_description),
    grossVehicleWeight: clean(data.vehicle_gross_weight),
    unladenWeight: clean(data.unladen_weight),
    vehicleSeatCapacity: clean(data.seat_capacity),
    ownerCount: clean(data.owner_number),
    status: clean(data.rc_status),
    blacklistStatus: clean(data.blacklist_status),
    vehicleInsuranceCompanyName: clean(data.insurance_company),
    vehicleInsurancePolicyNumber: clean(data.insurance_policy_number),
    regAuthority: clean(data.registered_at),
    regDate: cleanDate(data.registration_date),
    fitnessValidUpto: cleanDate(data.fit_up_to),
    rcExpiryDate: cleanDate(data.fit_up_to),
    puccValidUpto: cleanDate(data.pucc_upto),
    vehicleInsuranceUpto: cleanDate(data.insurance_upto),
    permitValidUpto: cleanDate(data.permit_valid_upto),
    vehicleTaxUpto: cleanDate(data.tax_upto) || cleanDate(data.tax_paid_upto),
    // Everything without a dedicated column (permits, financer, ...) is
    // preserved here verbatim.
    fullDataJson: data,
  });

  const vehicle = await db.staticVehicleData.findOne({ where: { truckNo } });
  if (vehicle) {
    await vehicle.update(mapped);
  } else {
    await db.staticVehicleData.create({
      truckNo,
      rcBook: true,
      fitnessCertificate: true,
      ...mapped,
    });
  }

  await bumpVahanStat("surepassRcCount");

  return res.sendResponse({ data });
}

/**
 * POST /v1/vahan/driver-dl-surepass  { dlNumber | dlNo, dob }
 */
async function getDriverDl(req, res) {
  const dlNumber = clean(req.body.dlNumber || req.body.dlNo);
  const dob = normalizeDob(req.body.dob);
  if (!dlNumber || !dob) {
    throw createHttpError[400](
      "dlNumber and dob (YYYY-MM-DD or DD-MM-YYYY) are required"
    );
  }

  const data = await callSurepass("/api/v1/driving-license/driving-license", {
    id_number: dlNumber,
    dob,
  });

  const licenseNumber = clean(data.license_number) || dlNumber;
  // The photo already lives in driverImage; don't store the base64 twice.
  const { profile_image: profileImage, ...dataWithoutImage } = data;

  const mapped = withoutNulls({
    fullName: clean(data.name),
    fatherOrHusband: clean(data.father_or_husband_name),
    dob: cleanDate(data.dob),
    gender: clean(data.gender),
    bloodGroup: clean(data.blood_group),
    driverImage: profileImage ? "data:image/jpeg;base64," + profileImage : null,
    dlIssueDate: cleanDate(data.doi),
    dlValidityNonTransport: cleanDate(data.doe),
    dlValidityTransport: cleanDate(data.transport_doe),
    dlValidUpto: cleanDate(data.doe) || cleanDate(data.transport_doe),
    covDetails: Array.isArray(data.vehicle_classes) ? data.vehicle_classes : null,
    state: clean(data.state),
    pincode: clean(data.permanent_zip),
    address: clean(data.permanent_address),
    completeAddress: clean(data.permanent_address),
    dlStatus: clean(data.current_status),
    fullDataJson: dataWithoutImage,
  });

  const driver = await db.drivers.findOne({ where: { dlNumber: licenseNumber } });
  if (driver) {
    await driver.update(mapped);
  } else {
    await db.drivers.create({ dlNumber: licenseNumber, ...mapped });
  }

  await bumpVahanStat("surepassDlCount");

  return res.sendResponse({ data });
}

module.exports = { getVehicleRc, getDriverDl };
