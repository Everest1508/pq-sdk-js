"use strict";

const { PQClient } = require("../client");
const { safeRequestContext } = require("../utils");

const CAPTURED = Symbol("pqCaptured");

/**
 * Express error-handling middleware that captures unhandled exceptions.
 * Must be registered with four args AFTER your routes:
 *
 *   const { pqErrorHandler } = require("pq-befu/integrations/express");
 *   app.use(pqErrorHandler(pq, { environment: "production" }));
 *   app.use(pqResponseHandler(pq));  // optional: catches 5xx responses
 *
 * @param {PQClient} client
 * @param {Object} [options]
 * @param {string} [options.environment]
 * @param {Object} [options.extra]  Extra fields merged into every report.
 * @returns {import("express").ErrorRequestHandler}
 */
function pqErrorHandler(client, options = {}) {
  return function pqErrorMiddleware(err, req, res, next) {
    const ctx = safeRequestContext(req);
    req[CAPTURED] = true;
    client.captureException(err, {
      environment: options.environment,
      page: ctx.page,
      extra: {
        method: ctx.method,
        path: ctx.path,
        ...(options.extra || {}),
      },
    });
    next(err);
  };
}

/**
 * Express middleware that captures 5xx responses (including those produced
 * by render-time failures without a thrown error). Register before your
 * error handler:
 *
 *   app.use(pqResponseHandler(pq, { environment: "production" }));
 *
 * @param {PQClient} client
 * @param {Object} [options]
 * @param {string} [options.environment]
 * @param {Object} [options.extra]
 * @returns {import("express").RequestHandler}
 */
function pqResponseHandler(client, options = {}) {
  return function pqResponseMiddleware(req, res, next) {
    const ctx = safeRequestContext(req);
    res.on("finish", () => {
      if (res.statusCode >= 500 && !req[CAPTURED]) {
        client.captureError({
          message: `${req.method} ${req.originalUrl || req.url} returned ${res.statusCode}`,
          errorType: "ServerError",
          environment: options.environment,
          page: ctx.page,
          extra: {
            status_code: res.statusCode,
            method: ctx.method,
            path: ctx.path,
            ...(options.extra || {}),
          },
        });
      }
    });
    next();
  };
}

/**
 * Convenience factory returning both middlewares.
 *
 *   const { pqExpress } = require("pq-befu/integrations/express");
 *   const { middleware, errorHandler } = pqExpress({ client: pq });
 *   app.use(middleware);
 *   // routes...
 *   app.use(errorHandler);
 *
 * @param {Object} opts
 * @param {PQClient} opts.client
 * @param {string} [opts.environment]
 * @param {Object} [opts.extra]
 * @returns {{ middleware: import("express").RequestHandler, errorHandler: import("express").ErrorRequestHandler }}
 */
function pqExpress({ client, environment, extra } = {}) {
  return {
    middleware: pqResponseHandler(client, { environment, extra }),
    errorHandler: pqErrorHandler(client, { environment, extra }),
  };
}

module.exports = { pqErrorHandler, pqResponseHandler, pqExpress };
