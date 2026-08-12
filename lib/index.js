"use strict";

const { PQClient } = require("./client");
const { captureExceptions, autoCapture, installHooks } = require("./hooks");

module.exports = {
  PQClient,
  captureExceptions,
  autoCapture,
  installHooks,
};
