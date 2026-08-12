"use strict";

// Example: Electron integration.
// Main process:
//   const { app, BrowserWindow } = require("electron");
//   const { PQClient } = require("pq-befu");
//   const { pqElectronMain } = require("pq-befu/integrations/electron");
//
//   const pq = new PQClient({ apiKey: "...", baseUrl: "http://localhost:8000" });
//   pqElectronMain(pq, { environment: "production" });
//
//   const win = new BrowserWindow({
//     webPreferences: {
//       preload: require.resolve("pq-befu/preload"), // sandboxed renderers OK
//     },
//   });
//
// Renderer process (any context — even sandboxed):
//   window.pq.captureError({ message: "renderer boom" });
//   window.pq.captureException(err, { environment: "production" });
//   window.pq.sendFeedback({ rating: 5, comment: "Great!" });
//   window.pq.createTicket({ title: "Bug", description: "..." });
//
// Alternative (renderer with network access, no IPC): use the fetch client.
//   const { PQBrowserClient } = require("pq-befu/browser");
//   const pq = new PQBrowserClient({ apiKey: "...", baseUrl: "http://localhost:8000" });

const { app, BrowserWindow } = require("electron");
const { PQClient } = require("pq-befu");
const { pqElectronMain } = require("pq-befu/integrations/electron");

const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY || "your_api_key",
  baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
});

// Main-process capture + IPC bridge + renderer crash capture.
pqElectronMain(pq, { environment: "production" });

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: require.resolve("pq-befu/preload"),
    },
  });
  win.loadURL("https://example.com");
}

app.whenReady().then(() => {
  createWindow();
});
