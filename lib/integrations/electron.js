"use strict";

const { installHooks } = require("../hooks");

/**
 * Electron integration — error tracking across main and renderer processes.
 *
 * Main process:
 *   const { pqElectronMain } = require("pq-befu/integrations/electron");
 *   const pq = new PQClient({ apiKey: "...", baseUrl: "http://localhost:8000" });
 *   pqElectronMain(pq, { environment: "production" });
 *
 * Preload script (sandboxed renderers): set your BrowserWindow's `preload`
 * to the bundled `preload.js` shipped with this package, then renderer code
 * can call `window.pq.captureError({...})` / `window.pq.captureException(err)`.
 *
 * Requires the peer dependency `electron` in your application. It is loaded
 * lazily only when this integration is actually used.
 */

const PQ_IPC_CHANNEL = "pq-renderer-report";

let _electron = null;
function getElectron() {
  if (!_electron) {
    _electron = require("electron");
  }
  return _electron;
}

function serializeError(err) {
  if (!err) return null;
  return {
    message: err.message || String(err),
    name: err.name || "Error",
    stack: err.stack || "",
  };
}

/**
 * Wire PQ into the Electron main process.
 *
 * Captures:
 *   - uncaught exceptions / unhandled rejections in the main process
 *   - renderer process crashes ("render-process-gone")
 *   - utility/GPU process crashes ("child-process-gone")
 *   - unresponsive renderers
 *   - reports forwarded from renderers over IPC (see preload.js)
 *
 * @param {import("../client").PQClient} client
 * @param {Object} [options]
 * @param {string} [options.environment]
 * @param {string} [options.channel]  IPC channel (default "pq-renderer-report").
 * @param {boolean} [options.hooks]   Install process hooks too (default true).
 * @returns {() => void} An uninstall function.
 */
function pqElectronMain(client, options = {}) {
  const electron = getElectron();
  const { app, ipcMain } = electron;
  const environment = options.environment;
  const channel = options.channel || PQ_IPC_CHANNEL;

  const uninstallHooks =
    options.hooks !== false
      ? installHooks(client, { environment })
      : () => {};

  async function handleReport(event, payload) {
    try {
      const page = event && event.sender && event.sender.getURL
        ? event.sender.getURL()
        : "";
      const kind = payload && payload.kind;
      const data = (payload && payload.data) || {};
      if (kind === "error") {
        return await client.captureError({ ...data, environment: data.environment || environment, page: data.page || page });
      }
      if (kind === "exception") {
        const e = payload.error;
        const err = new Error((e && e.message) || "Renderer exception");
        if (e && e.name) err.name = e.name;
        if (e && e.stack) err.stack = e.stack;
        return await client.captureException(err, { ...data, environment: data.environment || environment, page: data.page || page });
      }
      if (kind === "feedback") {
        return await client.sendFeedback(data);
      }
      if (kind === "ticket") {
        return await client.createTicket(data);
      }
    } catch {
      // never let reporting break IPC
    }
    return null;
  }

  function onRenderGone(_event, webContents, details) {
    client.captureError({
      message: `Renderer process gone: ${details.reason}`,
      errorType: "RenderProcessGone",
      environment,
      page: webContents && webContents.getURL ? webContents.getURL() : "",
      extra: {
        reason: details.reason,
        exit_code: details.exitCode,
      },
    });
  }

  function onChildGone(_event, details) {
    client.captureError({
      message: `Child process gone: ${details.type} (${details.reason})`,
      errorType: "ChildProcessGone",
      environment,
      extra: {
        type: details.type,
        reason: details.reason,
        exit_code: details.exitCode,
      },
    });
  }

  function onWebContentsCreated(_event, webContents) {
    webContents.on("unresponsive", () => {
      client.captureError({
        message: "Renderer unresponsive",
        errorType: "RendererUnresponsive",
        environment,
        page: webContents.getURL ? webContents.getURL() : "",
      });
    });
  }

  const onBeforeQuit = () => {
    client.flush();
  };

  ipcMain.handle(channel, handleReport);
  app.on("render-process-gone", onRenderGone);
  app.on("child-process-gone", onChildGone);
  app.on("web-contents-created", onWebContentsCreated);
  app.on("before-quit", onBeforeQuit);

  return function uninstall() {
    ipcMain.removeHandler(channel);
    app.removeListener("render-process-gone", onRenderGone);
    app.removeListener("child-process-gone", onChildGone);
    app.removeListener("web-contents-created", onWebContentsCreated);
    app.removeListener("before-quit", onBeforeQuit);
    uninstallHooks();
  };
}

/**
 * Preload helper for non-sandboxed (or bundled) preload scripts.
 * Exposes `window.pq` via contextBridge.
 *
 *   // preload.js (bundled)
 *   const { pqElectronPreload } = require("pq-befu/integrations/electron");
 *   pqElectronPreload({ channel: "pq-renderer-report" });
 *
 * For sandboxed renderers use the static `preload.js` shipped with the
 * package instead (preload scripts can only require "electron" there).
 *
 * @param {Object} [options]
 * @param {string} [options.channel]  IPC channel (default "pq-renderer-report").
 * @returns {Object} The exposed API object.
 */
function pqElectronPreload(options = {}) {
  const { contextBridge, ipcRenderer } = getElectron();
  const channel = options.channel || PQ_IPC_CHANNEL;
  const api = {
    captureError: (data = {}) => ipcRenderer.invoke(channel, { kind: "error", data }),
    captureException: (err, data = {}) =>
      ipcRenderer.invoke(channel, { kind: "exception", error: serializeError(err), data }),
    sendFeedback: (data = {}) => ipcRenderer.invoke(channel, { kind: "feedback", data }),
    createTicket: (data = {}) => ipcRenderer.invoke(channel, { kind: "ticket", data }),
  };
  contextBridge.exposeInMainWorld("pq", api);
  return api;
}

module.exports = {
  PQ_IPC_CHANNEL,
  pqElectronMain,
  pqElectronPreload,
  serializeError,
};
