"use strict";

const http = require("http");
const https = require("https");

const VERSION = require("../package.json").version;
const { toSnakeCaseKeys } = require("./utils");

class PQClient {
  /**
   * Client for the PQ Platform ingestion API.
   *
   * Usage:
   *   const { PQClient } = require("pq-befu");
   *
   *   const pq = new PQClient({
   *     apiKey: "your_api_key_here",
   *     baseUrl: "http://localhost:8000",
   *   });
   *
   *   await pq.captureError({ message: "Something broke", errorType: "TypeError" });
   *   await pq.sendFeedback({ rating: 5, comment: "Great product!" });
   *   await pq.createTicket({ title: "Bug report", description: "Login fails on mobile", ticketType: "bug" });
   *
   *   // Ensure all async requests complete before exit
   *   await pq.flush();
   *
   * @param {Object} options
   * @param {string} options.apiKey        API key from your product settings (required).
   * @param {string} [options.baseUrl]     Your PQ Platform URL (default http://localhost:8000).
   * @param {number} [options.timeout]     HTTP timeout in milliseconds (default 5000).
   * @param {boolean} [options.asyncSend]  Send reports without blocking (default true).
   * @param {string}  [options.userAgent]  Custom User-Agent string (optional).
   */
  constructor({
    apiKey,
    baseUrl = "http://localhost:8000",
    timeout = 5000,
    asyncSend = true,
    userAgent = undefined,
  } = {}) {
    if (!apiKey) {
      throw new Error("PQClient: apiKey is required");
    }
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.timeout = timeout;
    this.asyncSend = asyncSend;
    this.userAgent = userAgent || `pq-befu-node/${VERSION}`;
    this._pending = [];
  }

  /**
   * Wait for all pending async requests to complete.
   * Call this before your process exits to ensure no data is lost.
   * Not needed when asyncSend=false (sync mode).
   *
   * @returns {Promise<void>}
   */
  flush() {
    const pending = this._pending.splice(0);
    return Promise.all(pending).then(() => undefined);
  }

  _post(endpoint, data) {
    const url = new URL(`${this.baseUrl}/api/v1/${endpoint}`);
    const body = JSON.stringify(toSnakeCaseKeys(data));
    const transport = url.protocol === "https:" ? https : http;
    return new Promise((resolve) => {
      const req = transport.request(
        {
          method: "POST",
          hostname: url.hostname,
          port: url.port || undefined,
          path: url.pathname + url.search,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Length": Buffer.byteLength(body),
            "User-Agent": this.userAgent,
          },
          timeout: this.timeout,
        },
        (res) => {
          let raw = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            raw += chunk;
          });
          res.on("end", () => {
            try {
              resolve(JSON.parse(raw));
            } catch {
              resolve({ status_code: res.statusCode, body: raw });
            }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
      req.write(body);
      req.end();
    });
  }

  _send(endpoint, data) {
    const promise = this._post(endpoint, data);
    if (this.asyncSend) {
      this._pending.push(promise);
    }
    return promise;
  }

  /**
   * Report an error to the platform.
   *
   * @param {Object} options
   * @param {string} options.message     Error message (required).
   * @param {string} [options.errorType] Exception/error type (e.g. "TypeError").
   * @param {string} [options.stacktrace] Stack trace string.
   * @param {...any} options             Optional fields — environment, version, page,
   *                                     userRef, device, os, browser, requestPayload, extra.
   * @returns {Promise<Object|null>}
   */
  captureError({ message, errorType = "", stacktrace = "", ...extra } = {}) {
    const data = {
      message: String(message).slice(0, 1000),
      error_type: String(errorType).slice(0, 255),
      stacktrace: String(stacktrace || ""),
      ...extra,
    };
    return this._send("errors/capture/", data);
  }

  /**
   * Report a caught error/exception.
   *
   * @param {Error} err                 The error object to report.
   * @param {Object} [options]          Extra fields passed to captureError.
   * @param {string} [options.message]  Override the error message.
   * @param {string} [options.errorType] Override the error type.
   * @param {string} [options.stacktrace] Override the stack trace.
   * @returns {Promise<Object|null>}
   */
  captureException(err, options = {}) {
    if (!err) return Promise.resolve(null);
    const { message, errorType, stacktrace, ...extra } = options;
    return this.captureError({
      message: message || err.message || String(err),
      errorType: errorType || err.name || "Error",
      stacktrace: stacktrace || (err.stack ? String(err.stack) : ""),
      ...extra,
    });
  }

  /**
   * Submit user feedback (rating 1-5).
   *
   * @param {Object} options
   * @param {number} options.rating     Integer 1-5.
   * @param {string} [options.comment]  Free text comment.
   * @param {string} [options.userRef]  Identifier for the user giving feedback.
   * @param {...any} options            Optional fields — version, screenshotUrl.
   * @returns {Promise<Object|null>}
   */
  sendFeedback({ rating, comment = "", userRef = "", ...extra } = {}) {
    const data = { rating, comment, user_ref: userRef, ...extra };
    return this._send("feedback/", data);
  }

  /**
   * Create a support ticket.
   *
   * @param {Object} options
   * @param {string} options.title        Ticket title.
   * @param {string} [options.description] Detailed description.
   * @param {string} [options.ticketType] One of "bug", "feature", "question".
   * @param {string} [options.userRef]    Identifier for the user reporting.
   * @param {...any} options              Optional fields — externalId, metadata.
   * @returns {Promise<Object|null>}
   */
  createTicket({
    title,
    description = "",
    ticketType = "bug",
    userRef = "",
    ...extra
  } = {}) {
    const data = {
      title: String(title).slice(0, 500),
      description,
      ticket_type: ticketType,
      user_ref: userRef,
      ...extra,
    };
    return this._send("tickets/", data);
  }
}

module.exports = { PQClient };
