"use strict";
const bcrypt = require("bcryptjs");
const createHttpError = require("http-errors");
const db = require("../models");

/**
 * Server-to-server auth for product backends (apiserver/transport).
 * Expects headers: x-product = <product name>, x-api-key = <raw key>.
 * Attaches req.product on success.
 */
module.exports = async function apiKeyAuth(req, res, next) {
  try {
    const productName = req.header("x-product");
    const apiKey = req.header("x-api-key");
    if (!productName || !apiKey) {
      throw new createHttpError.Unauthorized("Missing x-product or x-api-key");
    }
    const product = await db.product
      .scope("withSecret")
      .findOne({ where: { name: productName, status: "ACTIVE" } });
    if (!product) throw new createHttpError.Unauthorized("Unknown product");

    const ok = await bcrypt.compare(apiKey, product.apiKeyHash);
    if (!ok) throw new createHttpError.Unauthorized("Invalid API key");

    req.product = { id: product.id, name: product.name };
    next();
  } catch (err) {
    next(err);
  }
};
