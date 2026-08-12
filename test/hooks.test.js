"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { captureExceptions, autoCapture, installHooks } = require("../lib/hooks");
const { PQClient } = require("../lib/client");

function makeClient() {
  return {
    captured: [],
    captureError(payload) {
      this.captured.push(payload);
      return Promise.resolve({ ok: true });
    },
    captureException(err, options) {
      this.captured.push({ err, options });
      return Promise.resolve({ ok: true });
    },
  };
}

test("captureExceptions reports and re-throws", async () => {
  const client = makeClient();
  const err = new Error("boom");
  await assert.rejects(
    () => captureExceptions(client, () => {
      throw err;
    }),
    /boom/
  );
  assert.equal(client.captured.length, 1);
  assert.equal(client.captured[0].err, err);
});

test("captureExceptions returns value on success and captures nothing", async () => {
  const client = makeClient();
  const value = await captureExceptions(client, async () => 42);
  assert.equal(value, 42);
  assert.equal(client.captured.length, 0);
});

test("autoCapture wraps sync and async functions and re-throws", async () => {
  const client = makeClient();
  const fn = autoCapture(client)(function risky(x) {
    if (x < 0) throw new Error("negative");
    return x * 2;
  });
  assert.equal(fn(3), 6);
  await assert.rejects(async () => fn(-1), /negative/);
  assert.equal(client.captured.length, 1);
  assert.equal(client.captured[0].err.message, "negative");
});

test("autoCapture preserves function name", () => {
  const client = makeClient();
  function myFn() {}
  const wrapped = autoCapture(client)(myFn);
  assert.equal(wrapped.name, "myFn");
});

test("installHooks captures uncaughtException via injected error", async () => {
  const client = makeClient();
  const uninstall = installHooks(client, { environment: "production" });
  // Invoke our handler directly (avoids re-triggering the real process default).
  const listeners = process.listeners("uncaughtException");
  const ourHandler = listeners[listeners.length - 1];
  const err = new TypeError("main boom");
  err.name = "TypeError";
  ourHandler(err, "uncaughtException");
  await new Promise((r) => setImmediate(r));
  assert.equal(client.captured.length, 1);
  assert.equal(client.captured[0].options.environment, "production");
  assert.equal(client.captured[0].options.errorType, "UncaughtException");
  uninstall();
});

test("installHooks captures unhandledRejection", async () => {
  const client = makeClient();
  const uninstall = installHooks(client);
  const listeners = process.listeners("unhandledRejection");
  const ourHandler = listeners[listeners.length - 1];
  ourHandler(new Error("rejected"), Promise.resolve());
  await new Promise((r) => setImmediate(r));
  assert.equal(client.captured.length, 1);
  assert.equal(client.captured[0].options.errorType, "UnhandledRejection");
  uninstall();
});

test("installHooks uninstall removes listeners", async () => {
  const client = makeClient();
  const uninstall = installHooks(client);
  const before = process.listenerCount("uncaughtException");
  uninstall();
  const after = process.listenerCount("uncaughtException");
  assert.equal(after, before - 1);
});

test("PQClient captureException is compatible with hooks payloads", async () => {
  const pq = new PQClient({ apiKey: "k", baseUrl: "http://127.0.0.1:1", asyncSend: false });
  const promise = pq.captureException(new Error("compat"));
  assert.ok(promise instanceof Promise);
  assert.equal(await promise, null);
});
