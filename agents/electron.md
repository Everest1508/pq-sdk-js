# PQ SDK Agent Instruction: Electron

## Install and configure

```bash
npm install pq-befu
```

Set `PQ_API_KEY`, `PQ_BASE_URL`, and `NODE_ENV` only in the main-process
environment. Never send `PQ_API_KEY` to renderer code.

## Required integration

In the main process, create one client and call `pqElectronMain` once. For a
sandboxed renderer, use the SDK's preload bridge; it exposes `window.pq` without
exposing the API key.

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

Renderer code can report errors while preserving its current behavior:

```js
try {
  await runAction();
} catch (err) {
  await window.pq.captureException(err);
  throw err;
}
```

Preserve a custom preload and existing Electron security settings. If a custom
preload must remain, use `pqElectronPreload` only when it remains compatible
with the app's context-isolation setup.

## Copy/paste prompt

```text
This is an Electron app. Follow agents/electron.md: initialize one PQClient in
the main process with PQ_API_KEY and PQ_BASE_URL, then call pqElectronMain with
the NODE_ENV-based environment. For sandboxed renderers, use
require.resolve("pq-befu/preload") and call window.pq in renderer code. Never
pass the API key to renderers or weaken Electron security settings. Preserve
existing custom preload behavior, document configuration, and run tests.
```
