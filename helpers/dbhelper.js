"use strict";
require("dotenv").config();
const mysql = require("mysql2/promise");
const env = process.env.NODE_ENV || "development";
const config = require("../config/config")[env];

/**
 * Create the database if it doesn't exist, then authenticate + sync models.
 * Resolves to the db object.
 */
module.exports = (async function initialize() {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\`;`
  );
  await connection.end();

  const db = require("../models");
  await db.sequelize.authenticate();
  console.log(" => [dispatcher-superadmin] DB authenticated");
  await db.sequelize.sync({ force: false });
  console.log(" => [dispatcher-superadmin] DB synced");
  return db;
})();
