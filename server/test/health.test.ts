import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";

// Minimal app that mirrors the health endpoint and v1 rewrite middleware
function createHealthTestApp() {
  const app = express();
  app.use(express.json());

  // Mirror the api-version rewrite logic
  app.use((req, _res, next) => {
    if (req.url.startsWith("/api/v1/")) {
      req.url = "/api/" + req.url.slice("/api/v1/".length);
    }
    next();
  });

  // Minimal health endpoint (same shape as admin.routes.ts)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "2.1.0" });
  });

  return app;
}

describe("Health Check & API Versioning", () => {
  const app = createHealthTestApp();

  it("GET /api/health → 200", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/v1/health → 200 (v1 alias)", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("API v1 rewrite: /api/v1/trips → same as /api/trips", async () => {
    const innerApp = express();
    innerApp.use((req, _res, next) => {
      if (req.url.startsWith("/api/v1/")) {
        req.url = "/api/" + req.url.slice("/api/v1/".length);
      }
      next();
    });
    innerApp.get("/api/trips", (_req, res) => res.json({ rewritten: true }));

    const res = await request(innerApp).get("/api/v1/trips");
    expect(res.status).toBe(200);
    expect(res.body.rewritten).toBe(true);
  });
});
