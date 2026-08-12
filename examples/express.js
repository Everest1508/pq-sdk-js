"use strict";

// Example: Express integration.
// Run against a local PQ Platform:  node examples/express.js
const express = require("express");
const { PQClient } = require("pq-befu");
const { pqExpress } = require("pq-befu/integrations/express");

const app = express();
const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY || "your_api_key",
  baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
});

const { middleware, errorHandler } = pqExpress({ client: pq, environment: "development" });

app.use(express.json());
app.use(middleware);

app.get("/", (req, res) => {
  res.json({ ok: true });
});

app.get("/feedback", async (req, res) => {
  await pq.sendFeedback({ rating: 5, comment: "Nice!", userRef: "user-1" });
  res.json({ ok: true });
});

app.get("/boom", () => {
  throw new Error("Something exploded");
});

app.use(errorHandler);

app.listen(3000, () => console.log("Example listening on http://localhost:3000"));
