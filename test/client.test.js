"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { PQClient } = require("../lib/client");
const { toSnakeCase, toSnakeCaseKeys } = require("../lib/utils");

function startCaptureServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((r) => {
            server.close(r);
          }),
      });
    });
  });
}

const RESPONSES = {
  errors: { error_group_id: 1, occurrence_id: 1, fingerprint: "abc" },
  feedback: { feedback_id: 2 },
  tickets: { ticket_id: 3, ui_ticket_id: 4 },
};

function jsonHandler(requests, kind) {
  return (req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({ url: req.url, method: req.method, headers: req.headers, body: JSON.parse(raw || "{}") });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(RESPONSES[kind] || { ok: true }));
    });
  };
}

test("PQClient requires apiKey", () => {
  assert.throws(() => new PQClient({}), /apiKey/);
});

test("captureError sends snake_case payload to /api/v1/errors/capture/", async () => {
  const requests = [];
  const server = await startCaptureServer(jsonHandler(requests, "errors"));
  const pq = new PQClient({
    apiKey: "test_key_123",
    baseUrl: server.baseUrl,
    asyncSend: false,
  });

  const result = await pq.captureError({
    message: "Test error",
    errorType: "TypeError",
    stacktrace: "at foo (file.js:1)",
    environment: "production",
    userRef: "u1",
    requestPayload: { body: { a: 1 } },
  });

  assert.deepEqual(result, RESPONSES.errors);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/v1/errors/capture/");
  assert.equal(requests[0].headers.authorization, "Bearer test_key_123");
  assert.match(requests[0].headers["content-type"], /application\/json/);
  const body = requests[0].body;
  assert.equal(body.message, "Test error");
  assert.equal(body.error_type, "TypeError");
  assert.equal(body.environment, "production");
  assert.equal(body.user_ref, "u1");
  assert.deepEqual(body.request_payload, { body: { a: 1 } });

  await server.close();
});

test("captureError slices long message and error_type", async () => {
  const requests = [];
  const server = await startCaptureServer(jsonHandler(requests, "errors"));
  const pq = new PQClient({
    apiKey: "k",
    baseUrl: server.baseUrl,
    asyncSend: false,
  });
  await pq.captureError({ message: "x".repeat(2000), errorType: "E".repeat(500) });
  assert.equal(requests[0].body.message.length, 1000);
  assert.equal(requests[0].body.error_type.length, 255);
  await server.close();
});

test("captureException derives message, errorType and stacktrace from Error", async () => {
  const requests = [];
  const server = await startCaptureServer(jsonHandler(requests, "errors"));
  const pq = new PQClient({ apiKey: "k", baseUrl: server.baseUrl, asyncSend: false });

  const err = new Error("boom");
  err.name = "ValueError";
  const result = await pq.captureException(err, { environment: "staging" });

  assert.deepEqual(result, RESPONSES.errors);
  assert.equal(requests[0].body.message, "boom");
  assert.equal(requests[0].body.error_type, "ValueError");
  assert.match(requests[0].body.stacktrace, /boom/);
  assert.equal(requests[0].body.environment, "staging");
  await server.close();
});

test("captureException returns null for falsy error", async () => {
  const pq = new PQClient({ apiKey: "k", baseUrl: "http://127.0.0.1:9", asyncSend: false });
  assert.equal(await pq.captureException(null), null);
});

test("sendFeedback sends to /api/v1/feedback/", async () => {
  const requests = [];
  const server = await startCaptureServer(jsonHandler(requests, "feedback"));
  const pq = new PQClient({ apiKey: "k", baseUrl: server.baseUrl, asyncSend: false });

  const result = await pq.sendFeedback({
    rating: 5,
    comment: "Great!",
    userRef: "u2",
    screenshotUrl: "https://example.com/shot.png",
  });

  assert.deepEqual(result, RESPONSES.feedback);
  assert.equal(requests[0].url, "/api/v1/feedback/");
  assert.equal(requests[0].body.rating, 5);
  assert.equal(requests[0].body.comment, "Great!");
  assert.equal(requests[0].body.user_ref, "u2");
  assert.equal(requests[0].body.screenshot_url, "https://example.com/shot.png");
  await server.close();
});

test("createTicket sends to /api/v1/tickets/", async () => {
  const requests = [];
  const server = await startCaptureServer(jsonHandler(requests, "tickets"));
  const pq = new PQClient({ apiKey: "k", baseUrl: server.baseUrl, asyncSend: false });

  const result = await pq.createTicket({
    title: "Bug report",
    description: "Login fails",
    ticketType: "bug",
    externalId: "EXT-1",
  });

  assert.deepEqual(result, RESPONSES.tickets);
  assert.equal(requests[0].url, "/api/v1/tickets/");
  assert.equal(requests[0].body.title, "Bug report");
  assert.equal(requests[0].body.ticket_type, "bug");
  assert.equal(requests[0].body.external_id, "EXT-1");
  await server.close();
});

test("network failure resolves to null", async () => {
  const pq = new PQClient({ apiKey: "k", baseUrl: "http://127.0.0.1:1", asyncSend: false });
  const result = await pq.captureError({ message: "test" });
  assert.equal(result, null);
});

test("asyncSend queues requests and flush waits for them", async () => {
  let hits = 0;
  const server = await startCaptureServer((req, res) => {
    hits += 1;
    req.resume();
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end('{"ok": true}');
  });
  const pq = new PQClient({ apiKey: "k", baseUrl: server.baseUrl, asyncSend: true });

  const results = await Promise.all([
    pq.captureError({ message: "a" }),
    pq.sendFeedback({ rating: 1 }),
    pq.createTicket({ title: "t" }),
  ]);

  assert.deepEqual(results, [{ ok: true }, { ok: true }, { ok: true }]);
  await pq.flush();
  assert.equal(hits, 3);
  assert.equal(pq._pending.length, 0);
  await server.close();
});

test("baseUrl trailing slashes are stripped", () => {
  const pq = new PQClient({ apiKey: "k", baseUrl: "http://localhost:8000///" });
  assert.equal(pq.baseUrl, "http://localhost:8000");
});

test("toSnakeCase converts camelCase keys", () => {
  assert.equal(toSnakeCase("userRef"), "user_ref");
  assert.equal(toSnakeCase("requestPayload"), "request_payload");
  assert.equal(toSnakeCase("URLValue"), "url_value");
  assert.deepEqual(toSnakeCaseKeys({ myKey: 1, nested: { deepKey: 2 } }), {
    my_key: 1,
    nested: { deep_key: 2 },
  });
});
