"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

// Requiring the module must not fail when `electron` is not installed
// (it is a lazy peer dependency).
const { serializeError, PQ_IPC_CHANNEL } = require("../lib/integrations/electron");

test("electron module loads without electron installed", () => {
  assert.equal(PQ_IPC_CHANNEL, "pq-renderer-report");
});

test("serializeError extracts name, message, stack", () => {
  const err = new Error("renderer boom");
  err.name = "TypeError";
  const out = serializeError(err);
  assert.equal(out.message, "renderer boom");
  assert.equal(out.name, "TypeError");
  assert.match(out.stack, /renderer boom/);
});

test("serializeError returns null for falsy input", () => {
  assert.equal(serializeError(null), null);
  assert.equal(serializeError(undefined), null);
});

test("serializeError handles non-Error values", () => {
  const out = serializeError("oops");
  assert.equal(out.message, "oops");
  assert.equal(out.name, "Error");
});
