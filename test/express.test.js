"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { pqErrorHandler, pqResponseHandler, pqExpress } = require("../lib/integrations/express");

function makeStubClient() {
  return {
    errors: [],
    captureError(payload) {
      this.errors.push(payload);
      return Promise.resolve({ ok: true });
    },
    captureException(err, options) {
      this.errors.push({ ...options, message: err.message, error_type: err.name });
      return Promise.resolve({ ok: true });
    },
  };
}

async function withServer(app, fn) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("error handler captures thrown exception and passes to next", async () => {
  const express = require("express");
  const client = makeStubClient();
  const app = express();
  app.get("/boom", () => {
    const err = new Error("route failed");
    err.name = "RouteError";
    throw err;
  });
  app.use(pqErrorHandler(client, { environment: "production" }));
  app.use((req, res) => res.status(500).send("Internal Server Error"));

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/boom`);
    assert.equal(res.status, 500);
  });

  assert.equal(client.errors.length, 1);
  assert.equal(client.errors[0].error_type, "RouteError");
  assert.equal(client.errors[0].message, "route failed");
  assert.equal(client.errors[0].environment, "production");
  assert.equal(client.errors[0].extra.method, "GET");
  assert.equal(client.errors[0].extra.path, "/boom");
});

test("error handler does not interfere with successful responses", async () => {
  const express = require("express");
  const client = makeStubClient();
  const app = express();
  app.get("/ok", (req, res) => res.json({ hello: "world" }));
  app.use(pqErrorHandler(client));

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/ok`);
    assert.equal(res.status, 200);
  });

  assert.equal(client.errors.length, 0);
});

test("response handler captures 5xx responses and not 4xx", async () => {
  const express = require("express");
  const client = makeStubClient();
  const app = express();
  app.use(pqResponseHandler(client));
  app.get("/oops", (req, res) => res.status(500).send("oops"));
  app.get("/missing", (req, res) => res.status(404).send("nope"));

  await withServer(app, async (base) => {
    const [a, b] = await Promise.all([fetch(`${base}/oops`), fetch(`${base}/missing`)]);
    assert.equal(a.status, 500);
    assert.equal(b.status, 404);
    await new Promise((r) => setTimeout(r, 50));
  });

  assert.equal(client.errors.length, 1);
  assert.equal(client.errors[0].errorType, "ServerError");
  assert.equal(client.errors[0].extra.status_code, 500);
});

test("pqExpress convenience factory returns both middlewares", () => {
  const client = makeStubClient();
  const { middleware, errorHandler } = pqExpress({ client });
  assert.equal(typeof middleware, "function");
  assert.equal(typeof errorHandler, "function");
  assert.equal(middleware.length, 3);
  assert.equal(errorHandler.length, 4);
});

test("pqExpress dedupes: exception + 5xx captured once", async () => {
  const express = require("express");
  const client = makeStubClient();
  const app = express();
  const { middleware, errorHandler } = pqExpress({ client });
  app.use(middleware);
  app.get("/boom", () => {
    throw new Error("dedupe me");
  });
  app.use(errorHandler);

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/boom`);
    assert.equal(res.status, 500);
  });

  assert.equal(client.errors.length, 1);
  assert.equal(client.errors[0].error_type, "Error");
  assert.equal(client.errors[0].message, "dedupe me");
});
