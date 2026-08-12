"use strict";

const { PQClient } = require("./client");
const { toSnakeCaseKeys } = require("./utils");

/**
 * Fetch-based PQClient for browser-like environments (Electron renderer,
 * web workers, Deno, or any context with a global `fetch`). Same API as
 * PQClient — override only the transport.
 *
 * In Electron, use this directly in the renderer when the renderer has
 * network access, or use the IPC bridge (see integrations/electron.js)
 * for sandboxed renderers that forward reports to the main process.
 *
 * Usage:
 *   const { PQBrowserClient } = require("pq-befu/browser");
 *   const pq = new PQBrowserClient({ apiKey: "...", baseUrl: "http://localhost:8000" });
 *   await pq.captureError({ message: "Renderer error" });
 */
class PQBrowserClient extends PQClient {
  _post(endpoint, data) {
    const url = `${this.baseUrl}/api/v1/${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": this.userAgent,
      },
      body: JSON.stringify(toSnakeCaseKeys(data)),
      signal: controller.signal,
    })
      .then(async (res) => {
        try {
          return await res.json();
        } catch {
          return { status_code: res.status, body: await res.text() };
        }
      })
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }
}

module.exports = { PQBrowserClient };
