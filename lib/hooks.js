"use strict";

/**
 * Run fn and auto-report any exception to the platform, then re-throw.
 * This is the JS analogue of the Python `capture_exceptions` context manager.
 *
 * Usage:
 *   await captureExceptions(pq, async () => {
 *     await doSomethingRisky();
 *   }, { environment: "production" });
 *
 * @param {import("./client").PQClient} client
 * @param {Function} fn      Async or sync function to run.
 * @param {Object} [defaults] Extra fields passed to captureException.
 * @returns {Promise<any>} The return value of fn.
 */
async function captureExceptions(client, fn, defaults = {}) {
  try {
    return await fn();
  } catch (err) {
    client.captureException(err, defaults);
    throw err;
  }
}

/**
 * Wrap a function so any exception it throws is auto-reported to the platform.
 * The JS analogue of the Python `@auto_capture` decorator. Works on both
 * async and sync functions.
 *
 * Usage:
 *   const safe = autoCapture(pq, async function myView() { ... }, { environment: "production" });
 *
 * @param {import("./client").PQClient} client
 * @param {Object} [defaults] Extra fields passed to captureException.
 * @returns {(fn: Function) => Function} A decorator that wraps fn.
 */
function autoCapture(client, defaults = {}) {
  return function decorator(fn) {
    function wrapper(...args) {
      try {
        return fn(...args);
      } catch (err) {
        client.captureException(err, defaults);
        throw err;
      }
    }
    Object.defineProperty(wrapper, "name", {
      value: fn.name || "anonymous",
      configurable: true,
    });
    return wrapper;
  };
}

/**
 * Install process-level hooks that capture ALL unhandled errors and
 * unhandled promise rejections. Sends a report to the PQ Platform, then
 * falls through to the default behavior (crash the process, print the
 * error, etc.). Call once at app startup.
 *
 * Note: process listeners are shared across the whole app. If you only
 * want per-request capture, use a framework integration (Express/Fastify/etc.)
 * instead of this global hook.
 *
 * Usage:
 *   const pq = new PQClient({ apiKey: "...", baseUrl: "..." });
 *   installHooks(pq, { environment: "production" });
 *
 * @param {import("./client").PQClient} client
 * @param {Object} [defaults] Extra fields passed to captureError.
 * @returns {() => void} An uninstall function that restores default behavior.
 */
function installHooks(client, defaults = {}) {
  function onUncaughtException(err, origin) {
    client.captureException(err, {
      errorType: "UncaughtException",
      stacktrace: err && err.stack ? String(err.stack) : String(err),
      extra: { origin: String(origin || "") },
      ...defaults,
    });
    // If we are the only listener, restore Node's default behavior (crash).
    if (process.listenerCount("uncaughtException") === 1) {
      process.removeListener("uncaughtException", onUncaughtException);
      process.emit("uncaughtException", err, origin);
    }
  }

  function onUnhandledRejection(reason, promise) {
    client.captureException(
      reason instanceof Error ? reason : new Error(String(reason)),
      {
        errorType: "UnhandledRejection",
        stacktrace:
          reason && reason.stack ? String(reason.stack) : new Error().stack,
        extra: {
          promise: String(
            promise && promise.constructor ? promise.constructor.name : "Promise"
          ),
        },
        ...defaults,
      }
    );
  }

  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);

  return function uninstall() {
    process.removeListener("uncaughtException", onUncaughtException);
    process.removeListener("unhandledRejection", onUnhandledRejection);
  };
}

module.exports = { captureExceptions, autoCapture, installHooks };
