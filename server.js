"use strict";
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const { handleError } = require("./middleware/error.handler");

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({ origin: (o, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: "50mb" })); // large enough for CSV registry imports
// Raw CSV/text body (used by the registry CSV import — avoids JSON-escaping bloat).
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "200mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan("combined"));

// Response formatters (used by ported VAHAN handlers + controllers)
app.response.sendResponse = function (data, message, statusCode) {
  statusCode = statusCode || 200;
  return this.status(statusCode).send({ success: true, status: statusCode, message: message || null, data });
};
app.response.sendError = function (err) {
  const status = parseInt(err.statusCode || err.status || 500);
  return this.status(status).send({ success: false, status, error_message: err.message });
};

app.get("/health", (req, res) =>
  res.status(200).json({ status: "UP", service: "dispatcher-superadmin", ts: new Date() })
);

app.use("/", require("./routes/index.routes"));

// 404
app.use((req, res) =>
  res.status(404).json({ success: false, status: 404, error_message: "Not found" })
);

// error handler
app.use(handleError);

let server;
async function start() {
  try {
    await require("./helpers/dbhelper"); // create db + authenticate + sync
    const port = process.env.PORT || 9000;
    server = app.listen(port, () =>
      console.log(`[dispatcher-superadmin] listening on ${port}`)
    );
    process.on("SIGTERM", () => server && server.close(() => process.exit(0)));
    process.on("SIGINT", () => server && server.close(() => process.exit(0)));
  } catch (err) {
    console.error("[dispatcher-superadmin] startup failed:", err);
    process.exit(1);
  }
}

start();
module.exports = app;
