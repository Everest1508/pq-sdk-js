# PQ SDK Framework Instructions for Agents

Use the section that matches the application's framework. Each section has an
exact integration pattern followed by a copy/paste instruction for a coding
agent.

## Shared configuration

Install the SDK:

```bash
npm install pq-befu
```

Set these server-side environment variables. Never commit or expose `PQ_API_KEY`
to a browser or Electron renderer.

```bash
PQ_API_KEY=your_api_key
PQ_BASE_URL=https://your-pq-platform.example
NODE_ENV=production
```

For every server framework, create **one** client during application startup:

```js
const { PQClient } = require("pq-befu");

const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY,
  baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
});

const environment = process.env.NODE_ENV || "development";
```

## Express

### Required placement

1. Create `pq` and `environment` when the Express app starts.
2. Call `app.use(middleware)` **before** declaring routes.
3. Call `app.use(errorHandler)` **after** every route and before or alongside
   the app's existing error middleware.
4. Do not replace the app's error handler: PQ reports the error and calls
   `next(err)`, so Express retains its normal response behavior.

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
```

### Agent instruction

```text
This is an Express app. Add pq-befu exactly as follows: create one PQClient at
startup from process.env.PQ_API_KEY and process.env.PQ_BASE_URL (default the
base URL only to http://localhost:8000), call pqExpress({ client: pq,
environment: process.env.NODE_ENV || "development" }), register middleware
before all routes, and register errorHandler after all routes. Keep the app's
current error middleware and response behavior intact. Do not hardcode or expose
the API key. Add a shutdown await pq.flush() only if the app already has a
graceful shutdown handler. Document PQ_API_KEY and PQ_BASE_URL and run tests.
```

## Fastify

### Required placement

1. Create `pq` before registering plugins.
2. Register `pqFastify` once using `await app.register(...)`.
3. Do not add a custom Fastify error handler for PQ. The plugin reports 5xx
   errors while preserving Fastify's existing error serialization.

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

### Agent instruction

```text
This is a Fastify app. Create a single PQClient during bootstrap using
PQ_API_KEY and PQ_BASE_URL, then register pqFastify from
pq-befu/integrations/fastify exactly once with { client: pq, environment:
process.env.NODE_ENV || "development" }. Preserve existing Fastify error
handlers and serialization; do not add a replacement error handler. Keep API
keys server-side, document required variables, and run tests.
```

## Koa

### Required placement

1. Create `pq` when the Koa app is created.
2. Register `pqKoa` near the beginning of the middleware chain, before routes.
3. Keep existing error middleware. `pqKoa` reports 5xx errors and re-throws
   exceptions, allowing Koa to keep its original response behavior.

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

### Agent instruction

```text
This is a Koa app. Create one server-side PQClient from PQ_API_KEY and
PQ_BASE_URL, then add pqKoa(pq, { environment: process.env.NODE_ENV ||
"development" }) near the start of the middleware chain, before routes. Do not
catch or swallow errors for PQ and do not replace current error middleware:
pqKoa must re-throw so Koa keeps its existing responses. Document the variables
and run tests.
```

## NestJS

### Required placement

1. Install peer dependencies if the application does not already have them:
   `npm install @nestjs/common rxjs`.
2. In `AppModule`, add the PQ module to `imports`.
3. The module registers a global interceptor, which reports only 5xx request
   exceptions and then re-throws them. Existing exception filters stay active.

```ts
import { Module } from "@nestjs/common";
import { PqSdkModule } from "pq-befu/integrations/nestjs";

@Module({
  imports: [
    PqSdkModule.forRoot({
      apiKey: process.env.PQ_API_KEY,
      baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
      environment: process.env.NODE_ENV || "development",
    }),
  ],
})
export class AppModule {}
```

### Agent instruction

```text
This is a NestJS app. In AppModule, add PqSdkModule.forRoot from
pq-befu/integrations/nestjs. Pass apiKey from process.env.PQ_API_KEY, baseUrl
from process.env.PQ_BASE_URL with http://localhost:8000 as the local fallback,
and environment from NODE_ENV with "development" fallback. Ensure @nestjs/common
and rxjs are installed. Do not remove or reorder exception filters or existing
global interceptors without explaining a concrete conflict. Keep the key out of
client bundles, document configuration, and run the build/tests.
```

## Electron

### Required placement

1. In the **main process**, create the PQ client and call `pqElectronMain` once.
2. For sandboxed renderers, set the `BrowserWindow` preload to the SDK's bundled
   preload file. This exposes `window.pq` without giving the renderer the API
   key.
3. In renderer code, report an exception with `window.pq.captureException(err)`.

```js
// main.js
const { BrowserWindow } = require("electron");
const { PQClient } = require("pq-befu");
const { pqElectronMain } = require("pq-befu/integrations/electron");

const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY,
  baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
});
pqElectronMain(pq, { environment: process.env.NODE_ENV || "development" });

const win = new BrowserWindow({
  webPreferences: { preload: require.resolve("pq-befu/preload") },
});
```

```js
// renderer.js
try {
  await runAction();
} catch (err) {
  await window.pq.captureException(err);
  throw err;
}
```

### Agent instruction

```text
This is an Electron app. Integrate pq-befu in the main process only: construct
one PQClient from PQ_API_KEY and PQ_BASE_URL, then call pqElectronMain(pq,
{ environment: process.env.NODE_ENV || "development" }). For sandboxed
renderers, set BrowserWindow.webPreferences.preload to
require.resolve("pq-befu/preload") and use window.pq from renderer code. Never
pass the API key to a renderer or weaken Electron security settings. Preserve an
existing custom preload; merge the PQ bridge only when its context-isolation
behavior remains safe. Document configuration and run tests.
```

## Browser, web worker, or Deno

### Required placement

Use `PQBrowserClient`, which uses `fetch`, only where it is safe for the
application to use the configured credential. A secret server API key must not
be shipped in public JavaScript.

```js
import { PQBrowserClient } from "pq-befu/browser";

const pq = new PQBrowserClient({
  apiKey: runtimeConfig.pqApiKey,
  baseUrl: runtimeConfig.pqBaseUrl,
});

try {
  await runAction();
} catch (err) {
  await pq.captureException(err, { environment: runtimeConfig.environment });
  throw err;
}
```

### Agent instruction

```text
This is a browser, worker, or Deno app. Use PQBrowserClient from
pq-befu/browser and initialize it at the project's existing runtime-config
boundary. Before adding it, confirm that the configured credential is intended
to be public; never embed a secret server API key in client code. Use
captureException for caught errors, re-throw the original error, and preserve
the existing user experience. Document the public configuration strategy and
run checks.
```

## Rules for every agent

- Use only documented `pq-befu` imports and APIs.
- Do not send passwords, tokens, authorization headers, or full request bodies
  in `extra`, `metadata`, or error messages.
- Use `captureException(err, context)` for caught `Error` objects; use
  `captureError({ message, errorType, ... })` for errors without an `Error`.
- Call `await pq.flush()` before a process that has explicit shutdown handling
  exits, so queued asynchronous reports are sent.
