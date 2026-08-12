# PQ SDK Agent Instruction: Express

## Install and configure

```bash
npm install pq-befu
```

Set these on the server:

```bash
PQ_API_KEY=your_api_key
PQ_BASE_URL=https://your-pq-platform.example
NODE_ENV=production
```

## Required integration

Create one client at application startup. Register `middleware` before every
route, and register `errorHandler` after every route. Keep any existing Express
error middleware: PQ reports the error and calls `next(err)`.

```js
const express = require("express");
const { PQClient } = require("pq-befu");
const { pqExpress } = require("pq-befu/integrations/express");

const app = express();
const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY,
  baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
});

const { middleware, errorHandler } = pqExpress({
  client: pq,
  environment: process.env.NODE_ENV || "development",
});

app.use(middleware);
app.get("/", (_req, res) => res.send("OK"));
app.use(errorHandler);
// Existing error middleware may remain after this line.
```

If the app already has graceful shutdown handling, add `await pq.flush()` before
the process exits.

## Copy/paste prompt

```text
This is an Express app. Add pq-befu exactly as shown in agents/express.md:
create one PQClient at startup using process.env.PQ_API_KEY and
process.env.PQ_BASE_URL, use pqExpress({ client: pq, environment:
process.env.NODE_ENV || "development" }), register middleware before all routes
and errorHandler after all routes. Keep all existing Express error handlers and
responses unchanged. Do not hardcode or expose credentials. Add await pq.flush()
only to an existing graceful-shutdown path. Document PQ_API_KEY and PQ_BASE_URL,
then run the relevant tests.
```
