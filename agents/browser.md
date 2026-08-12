# PQ SDK Agent Instruction: Browser, Worker, or Deno

## Install and configure

```bash
npm install pq-befu
```

Use this integration only when the application has a credential explicitly
intended to be public. Never bundle a secret server `PQ_API_KEY` into browser or
worker code.

## Required integration

Initialize `PQBrowserClient` at the project's existing runtime-config boundary.
It uses `fetch` and has the same reporting methods as `PQClient`.

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

Do not change the application's error UI simply to report an error. Only add
`sendFeedback` or `createTicket` where the product already exposes those user
actions.

## Copy/paste prompt

```text
This is a browser, web-worker, or Deno app. Follow agents/browser.md: use
PQBrowserClient from pq-befu/browser and initialize it at the existing
runtime-config boundary. First confirm the configured credential is intended to
be public; never bundle a secret server API key. Use captureException for
caught errors, re-throw the original error, preserve the existing UI, document
the public configuration strategy, and run checks.
```
