# PQ SDK Agent Instruction: Fastify

## Install and configure

```bash
npm install pq-befu
```

Set `PQ_API_KEY`, `PQ_BASE_URL`, and `NODE_ENV` in the server environment.

## Required integration

Create one client before registering plugins. Register `pqFastify` once. Do not
add a PQ-specific Fastify error handler: the plugin reports 5xx errors without
changing Fastify's error serialization.

```js
const Fastify = require("fastify");
const { PQClient } = require("pq-befu");
const { pqFastify } = require("pq-befu/integrations/fastify");

const app = Fastify();
const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY,
  baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
});

await app.register(pqFastify, {
  client: pq,
  environment: process.env.NODE_ENV || "development",
});
```

If an explicit shutdown path exists, call `await pq.flush()` before exit.

## Copy/paste prompt

```text
This is a Fastify app. Follow agents/fastify.md: create one server-side
PQClient from PQ_API_KEY and PQ_BASE_URL, then register pqFastify from
pq-befu/integrations/fastify once with { client: pq, environment:
process.env.NODE_ENV || "development" }. Preserve existing Fastify error
handlers and serialization; do not add a replacement handler. Keep credentials
server-side, document configuration, and run tests.
```
