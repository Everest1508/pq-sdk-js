"use strict";

// Static Electron preload bridge for sandboxed renderers.
// Set this file as your BrowserWindow `preload`:
//   new BrowserWindow({ preload: require.resolve("pq-befu/preload"), ... })
//
// Renderer code can then call (via the `window.pq` bridge):
//   window.pq.captureError({ message: "..." })
//   window.pq.captureException(err, { environment: "production" })
//   window.pq.sendFeedback({ rating: 5, comment: "..." })
//   window.pq.createTicket({ title: "...", description: "..." })
//
// Reports are forwarded over IPC to the main process, which must have run
// pqElectronMain(pq). The channel below must match PQ_IPC_CHANNEL.

const { contextBridge, ipcRenderer } = require("electron");

const CHANNEL = "pq-renderer-report";

function serializeError(err) {
  if (!err) return null;
  return {
    message: err.message || String(err),
    name: err.name || "Error",
    stack: err.stack || "",
  };
}

contextBridge.exposeInMainWorld("pq", {
  captureError: (data = {}) => ipcRenderer.invoke(CHANNEL, { kind: "error", data }),
  captureException: (err, data = {}) =>
    ipcRenderer.invoke(CHANNEL, { kind: "exception", error: serializeError(err), data }),
  sendFeedback: (data = {}) => ipcRenderer.invoke(CHANNEL, { kind: "feedback", data }),
  createTicket: (data = {}) => ipcRenderer.invoke(CHANNEL, { kind: "ticket", data }),
});
