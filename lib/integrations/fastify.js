"use strict";

const { safeRequestContext } = require("../utils");

/**
 * Fastify plugin that captures unhandled request errors (5xx) automatically.
 *
 * Usage:
 *   const { pqFastify } = require("pq-befu/integrations/fastify");
 *   const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });
 *
 *   const app = fastify();
 *   await app.register(pqFastify, { client: pq, environment: "production" });
 *
 * The plugin preserves Fastify's default error handling — it only reports
 * errors with a final status code >= 500.
 *
 * @param {import("fastify").FastifyInstance} fastify
 * @param {Object} opts
 * @param {import("../client").PQClient} opts.client
 * @param {string} [opts.environment]
 * @param {Object} [opts.extra]  Extra fields merged into every report.
 */
async function pqFastify(fastify, opts = {}) {
  const client = opts.client;
  const environment = opts.environment;

  fastify.decorate("pqClient", client);

  fastify.addHook("onError", async (request, reply, error) => {
    const statusCode = reply.statusCode || 500;
    if (statusCode < 500) return;
    const page = request.protocol
      ? `${request.protocol}://${request.hostname || "localhost"}${request.url}`
      : request.url;
    client.captureException(error, {
      environment,
      page,
      extra: {
        method: request.method,
        path: request.url,
        status_code: statusCode,
        ...(opts.extra || {}),
      },
    });
  });

  // Preserve the default error serializer by not overriding setErrorHandler.
}

module.exports = { pqFastify };
