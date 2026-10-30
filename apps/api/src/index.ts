import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { VERSION } from "@viaguard/core";

export const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    version: VERSION,
    service: "viaguard-api",
    timestamp: new Date().toISOString(),
  });
});

const port = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== "test") {
  console.log(`Viaguard API starting on http://localhost:${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}
