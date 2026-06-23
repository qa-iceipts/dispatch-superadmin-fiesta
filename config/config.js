"use strict";
require("dotenv").config();

const env = process.env.NODE_ENV || "development";

const base = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  dialect: process.env.DB_DIALECT || "mysql",
};

module.exports = {
  activeEnv: env,
  development: { ...base },
  test: { ...base },
  production: { ...base },
};
