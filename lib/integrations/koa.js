"use strict";

const { safeRequestContext } = require("../utils");

/**
 * Koa middleware that captures unhandled request errors (5xx) automatically.
 *
 * Usage:
 *   const { pqKoa } = require("pq-befu/integrations/koa");
 *   const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });
 *
 *   const app = new Koa();
 *   app.use(pqKoa(pq, { environment: "production" }));
 *   // ...your routes...
 *
 * Errors are re-thrown so Koa's default error handler still produces the
 * response. Only errors/status codes >= 500 are reported.
 *
 * @param {import("../client").PQClient} client
 * @param {Object} [options]
 * @param {string} [options.environment]
 * @param {Object} [options.extra]  Extra fields merged into every report.
 * @returns {import("koa").Middleware}
 */
function pqKoa(client, options = {}) {
  return async function pqKoaMiddleware(ctx, next) {
    try {
      await next();
      if (ctx.status >= 500) {
        const page = ctx.origin ? `${ctx.origin}${ctx.originalUrl}` : ctx.originalUrl;
        client.captureError({
          message: `${ctx.method} ${ctx.originalUrl || ctx.url} returned ${ctx.status}`,
          errorType: "ServerError",
          environment: options.environment,
          page,
          extra: {
            status_code: ctx.status,
            method: ctx.method,
            path: ctx.originalUrl || ctx.url,
            ...(options.extra || {}),
          },
        });
      }
    } catch (err) {
      const status = ctx.status || (err && (err.status || err.statusCode)) || 500;
      if (status >= 500) {
        const page = ctx.origin ? `${ctx.origin}${ctx.originalUrl}` : ctx.originalUrl;
        client.captureException(err, {
          environment: options.environment,
          page,
          extra: {
            method: ctx.method,
            path: ctx.originalUrl || ctx.url,
            status_code: status,
            ...(options.extra || {}),
          },
        });
      }
      throw err;
    }
  };
}

module.exports = { pqKoa };
