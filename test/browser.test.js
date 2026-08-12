"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { PQBrowserClient } = require("../lib/browser");

function startCaptureServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function collector() {
  const requests = [];
  return {
    requests,
    handler: (req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        requests.push({ url: req.url, headers: req.headers, body: JSON.parse(raw || "{}") });
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      });
    },
  };
}

test("PQBrowserClient is a PQClient subclass", () => {
  const pq = new PQBrowserClient({ apiKey: "k", baseUrl: "http://localhost:8000" });
  const { PQClient } = require("../lib/client");
  assert.ok(pq instanceof PQClient);
});

test("PQBrowserClient sends via fetch with snake_case payload and auth", async () => {
  const col = collector();
  const server = await startCaptureServer(col.handler);
  const pq = new PQBrowserClient({ apiKey: "renderer_key", baseUrl: server.baseUrl, asyncSend: false });

  const result = await pq.captureError({ message: "renderer boom", errorType: "TypeError", userRef: "r1" });

  assert.deepEqual(result, { ok: true });
  assert.equal(col.requests.length, 1);
  assert.equal(col.requests[0].url, "/api/v1/errors/capture/");
  assert.equal(col.requests[0].headers.authorization, "Bearer renderer_key");
  assert.equal(col.requests[0].body.message, "renderer boom");
  assert.equal(col.requests[0].body.user_ref, "r1");
  await server.close();
});

test("PQBrowserClient captures exception with stack", async () => {
  const col = collector();
  const server = await startCaptureServer(col.handler);
  const pq = new PQBrowserClient({ apiKey: "k", baseUrl: server.baseUrl, asyncSend: false });

  const err = new Error("browser error");
  await pq.captureException(err, { environment: "test" });

  assert.equal(col.requests[0].body.error_type, "Error");
  assert.match(col.requests[0].body.stacktrace, /browser error/);
  assert.equal(col.requests[0].body.environment, "test");
  await server.close();
});

test("PQBrowserClient network failure resolves to null", async () => {
  const pq = new PQBrowserClient({ apiKey: "k", baseUrl: "http://127.0.0.1:1", asyncSend: false });
  assert.equal(await pq.captureError({ message: "x" }), null);
});

test("PQBrowserClient supports asyncSend + flush", async () => {
  let hits = 0;
  const server = await startCaptureServer((req, res) => {
    hits += 1;
    req.resume();
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end('{"ok":true}');
  });
  const pq = new PQBrowserClient({ apiKey: "k", baseUrl: server.baseUrl, asyncSend: true });

  await Promise.all([
    pq.sendFeedback({ rating: 4 }),
    pq.createTicket({ title: "t" }),
  ]);
  await pq.flush();
  assert.equal(hits, 2);
  assert.equal(pq._pending.length, 0);
  await server.close();
});
