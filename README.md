# PQ SDK

Node.js SDK for the PQ Platform — error tracking, feedback, and ticketing.

Zero runtime dependencies (uses only Node's built-in `http`/`https`). Works with Express, Fastify, Koa, NestJS, Electron, or any Node.js app.

The JS counterpart of the Python `pq-befu` package.

## Install

```bash
npm install pq-befu
```

Framework adapters are optional — install what you use:

```bash
npm install express       # if using Express
npm install fastify       # if using Fastify
npm install koa           # if using Koa
npm install @nestjs/common rxjs   # if using NestJS
npm install electron      # if using Electron
```

## Quick Start

```js
const { PQClient } = require("pq-befu");

const pq = new PQClient({
  apiKey: "your_api_key",
  baseUrl: "http://localhost:8000",
});

// Report an error
await pq.captureError({ message: "Something broke", errorType: "TypeError" });

// Report a caught error
try {
  JSON.parse("{oops");
} catch (err) {
  await pq.captureException(err);
}

// Submit feedback
await pq.sendFeedback({ rating: 5, comment: "Great product!" });

// Create a ticket
await pq.createTicket({
  title: "Bug report",
  description: "Login fails on mobile",
  ticketType: "bug",
});

// Ensure all async requests complete before the process exits
await pq.flush();
```

## Auto-Capture

### Run a function, capture on failure

```js
const { captureExceptions } = require("pq-befu");

await captureExceptions(pq, async () => {
  await doSomethingRisky();
}, { environment: "production" });
```

### Wrap a function (decorator style)

```js
const { autoCapture } = require("pq-befu");

const safe = autoCapture(pq, { environment: "production" })(async function myJob() {
  // exceptions here are auto-reported, then re-thrown
});
```

### Global hooks (uncaught exceptions & unhandled rejections)

```js
const { installHooks } = require("pq-befu");

const pq = new PQClient({ apiKey: "...", baseUrl: "..." });
const uninstall = installHooks(pq, { environment: "production" });

// Later: uninstall()
```

## Framework Integrations

### Express

```js
const express = require("express");
const { PQClient } = require("pq-befu");
const { pqExpress } = require("pq-befu/integrations/express");

const app = express();
const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });

const { middleware, errorHandler } = pqExpress({ client: pq, environment: "production" });
app.use(middleware);

// ...your routes...

app.use(errorHandler); // must be after routes
```

Or use the two middlewares independently:

```js
const { pqErrorHandler, pqResponseHandler } = require("pq-befu/integrations/express");

app.use(pqResponseHandler(pq));   // captures 5xx responses
// routes...
app.use(pqErrorHandler(pq));      // captures thrown exceptions
```

### Fastify

```js
const fastify = require("fastify");
const { PQClient } = require("pq-befu");
const { pqFastify } = require("pq-befu/integrations/fastify");

const app = fastify();
const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });

await app.register(pqFastify, { client: pq, environment: "production" });
// Fastify's default error handling is preserved; only 5xx errors are reported.
```

### Koa

```js
const Koa = require("koa");
const { PQClient } = require("pq-befu");
const { pqKoa } = require("pq-befu/integrations/koa");

const app = new Koa();
const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });

app.use(pqKoa(pq, { environment: "production" }));
// routes...
// Errors are re-thrown so Koa's default error handler still responds.
```

### NestJS

```js
// main.ts
import { PqInterceptor } from "pq-befu/integrations/nestjs";
import { PQClient } from "pq-befu";

const app = await NestFactory.create(AppModule);
const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });
app.useGlobalInterceptors(new PqInterceptor(pq, { environment: "production" }));
```

Or with DI:

```ts
import { Module } from "@nestjs/common";
import { PqSdkModule } from "pq-befu/integrations/nestjs";

@Module({
  imports: [PqSdkModule.forRoot({ apiKey: "your_key", baseUrl: "http://localhost:8000" })],
})
export class AppModule {}
```

### Electron

Covers the **main process** (uncaught exceptions, unhandled rejections, renderer crashes, unresponsive renderers, child/GPU process crashes) and the **renderer** via an IPC bridge.

**Main process**

```js
const { app, BrowserWindow } = require("electron");
const { PQClient } = require("pq-befu");
const { pqElectronMain } = require("pq-befu/integrations/electron");

const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });
pqElectronMain(pq, { environment: "production" });

function createWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      preload: require.resolve("pq-befu/preload"), // works in sandboxed renderers
    },
  });
  win.loadURL("https://example.com");
}
```

**Renderer process** (sandboxed is fine) — `window.pq` is exposed by the preload:

```js
window.pq.captureError({ message: "renderer boom" });
window.pq.captureException(err, { environment: "production" });
window.pq.sendFeedback({ rating: 5, comment: "Great!" });
window.pq.createTicket({ title: "Bug report", description: "..." });
```

**Renderer with direct network access** (no IPC) — use the fetch-based client:

```js
const { PQBrowserClient } = require("pq-befu/browser");
const pq = new PQBrowserClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });
await pq.captureException(err);
```

`PQBrowserClient` has the same API as `PQClient` and also works in the browser, web workers, or Deno.

## Configuration

| Option     | Default                    | Description                               |
|------------|----------------------------|-------------------------------------------|
| `apiKey`   | (required)                 | API key from your product settings        |
| `baseUrl`  | `http://localhost:8000`    | Your PQ Platform URL                      |
| `timeout`  | `5000`                     | HTTP timeout in milliseconds              |
| `asyncSend`| `true`                     | Send reports without blocking the request |

All payload keys are camelCase in JS and converted to the platform's snake_case fields (`userRef` → `user_ref`, `requestPayload` → `request_payload`, …) automatically.

## API

### `PQClient`

| Method | Description |
|--------|-------------|
| `captureError({ message, errorType, stacktrace, ...extra })` | Report an error. Extra fields: `environment`, `version`, `page`, `userRef`, `device`, `os`, `browser`, `requestPayload`, `extra`. |
| `captureException(err, options)` | Report a caught error, deriving message/type/stack from the `Error`. |
| `sendFeedback({ rating, comment, userRef, ...extra })` | Submit feedback (rating 1–5). Extra: `version`, `screenshotUrl`. |
| `createTicket({ title, description, ticketType, userRef, ...extra })` | Create a ticket (`bug` \| `feature` \| `question`). Extra: `externalId`, `metadata`. |
| `flush()` | Wait for all pending async sends to complete. |

`PQBrowserClient` (`pq-befu/browser`) exposes the same methods but sends via global `fetch` — for Electron renderers, browsers, workers, and Deno.

### Hooks

| Function | Description |
|----------|-------------|
| `captureExceptions(client, fn, defaults?)` | Run `fn`; auto-report exceptions, then re-throw. |
| `autoCapture(client, defaults?)` | Wrap a function; auto-report its exceptions. |
| `installHooks(client, defaults?)` | Global `uncaughtException` / `unhandledRejection` capture. |

## Development

```bash
cd pq-sdk-js
npm install
npm test
```

## License

MIT
