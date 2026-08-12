# PQ SDK Agent Instruction: Koa

## Install and configure

```bash
npm install pq-befu
```

Set `PQ_API_KEY`, `PQ_BASE_URL`, and `NODE_ENV` in the server environment.

## Required integration

Create one client when the Koa app starts. Register `pqKoa` near the beginning
of the middleware chain, before routes. Keep existing error middleware: PQ
reports server errors and re-throws them so Koa's response behavior stays the
same.

```js
const Koa = require("koa");
const { PQClient } = require("pq-befu");
const { pqKoa } = require("pq-befu/integrations/koa");

const app = new Koa();
const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY,
  baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
});

app.use(pqKoa(pq, {
  environment: process.env.NODE_ENV || "development",
}));
// Register routes after this line.
```

If an explicit shutdown path exists, call `await pq.flush()` before exit.

## Copy/paste prompt

```text
This is a Koa app. Follow agents/koa.md: create one server-side PQClient from
PQ_API_KEY and PQ_BASE_URL, then add pqKoa(pq, { environment:
process.env.NODE_ENV || "development" }) near the start of the middleware chain
before routes. Do not swallow errors or replace existing Koa error middleware;
pqKoa must re-throw to preserve response behavior. Document configuration and
run tests.
```
