"use strict";

// Example: Fastify integration.
// Run against a local PQ Platform:  node examples/fastify.js
const Fastify = require("fastify");
const { PQClient } = require("pq-befu");
const { pqFastify } = require("pq-befu/integrations/fastify");

async function main() {
  const app = Fastify({ logger: true });
  const pq = new PQClient({
    apiKey: process.env.PQ_API_KEY || "your_api_key",
    baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
  });

  await app.register(pqFastify, { client: pq, environment: "development" });

  app.get("/", async () => ({ ok: true }));

  app.get("/boom", async () => {
    throw new Error("Something exploded");
  });

  await app.listen({ port: 3000 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
