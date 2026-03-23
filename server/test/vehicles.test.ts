import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

const vehiclesStore: Record<number, any[]> = {
  1: [
    { id: 1, organizationId: 1, plate: "AA000BB", model: "Fiat Ducato", status: "available" },
    { id: 2, organizationId: 1, plate: "CC111DD", model: "Mercedes Sprinter", status: "in_use" },
  ],
  2: [
    { id: 3, organizationId: 2, plate: "EE222FF", model: "Ford Transit", status: "available" },
  ],
};
let nextVehicleId = 10;

const checklistsStore: Record<number, any> = {
  1: { vehicleId: 1, items: ["Defibrillatore OK", "Ossigeno OK"], completedAt: null },
};

function createVehiclesTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret-at-least-32-chars-long",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  );

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non autenticato" });
    next();
  };

  // GET /api/vehicles
  app.get("/api/vehicles", requireAuth, (req: any, res) => {
    const orgId = req.session.organizationId as number;
    res.json(vehiclesStore[orgId] || []);
  });

  // POST /api/vehicles
  app.post("/api/vehicles", requireAuth, (req: any, res) => {
    const { plate, model } = req.body;
    if (!plate || !model) {
      return res.status(400).json({ error: "Dati non validi", details: { plate: !plate ? ["Obbligatorio"] : [], model: !model ? ["Obbligatorio"] : [] } });
    }
    const orgId = req.session.organizationId as number;
    const vehicle = { id: nextVehicleId++, organizationId: orgId, plate, model, status: "available" };
    if (!vehiclesStore[orgId]) vehiclesStore[orgId] = [];
    vehiclesStore[orgId].push(vehicle);
    res.status(201).json(vehicle);
  });

  // PUT /api/vehicles/:id
  app.put("/api/vehicles/:id", requireAuth, (req: any, res) => {
    const id = parseInt(req.params.id);
    const orgId = req.session.organizationId as number;
    const vehicles = vehiclesStore[orgId] || [];
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx === -1) return res.status(404).json({ error: "Veicolo non trovato" });
    vehicles[idx] = { ...vehicles[idx], ...req.body };
    res.json(vehicles[idx]);
  });

  // DELETE /api/vehicles/:id
  app.delete("/api/vehicles/:id", requireAuth, (req: any, res) => {
    const id = parseInt(req.params.id);
    const orgId = req.session.organizationId as number;
    const vehicles = vehiclesStore[orgId] || [];
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx === -1) return res.status(404).json({ error: "Veicolo non trovato" });
    vehicles.splice(idx, 1);
    res.json({ success: true });
  });

  // GET /api/vehicles/:id/checklist
  app.get("/api/vehicles/:id/checklist", requireAuth, (req: any, res) => {
    const id = parseInt(req.params.id);
    const orgId = req.session.organizationId as number;
    const vehicles = vehiclesStore[orgId] || [];
    const vehicle = vehicles.find((v) => v.id === id);
    if (!vehicle) return res.status(404).json({ error: "Veicolo non trovato" });
    const checklist = checklistsStore[id] || { vehicleId: id, items: [], completedAt: null };
    res.json(checklist);
  });

  // POST /api/test/set-session
  app.post("/api/test/set-session", (req: any, res) => {
    req.session.userId = req.body.userId;
    req.session.organizationId = req.body.organizationId;
    req.session.role = req.body.role;
    res.json({ ok: true });
  });

  return app;
}

async function loginAgent(app: express.Express, userId: number, orgId: number) {
  const agent = request.agent(app);
  await agent.post("/api/test/set-session").send({ userId, organizationId: orgId, role: "admin" });
  return agent;
}

describe("Vehicles Routes", () => {
  const app = createVehiclesTestApp();

  describe("GET /api/vehicles", () => {
    it("restituisce 401 senza autenticazione", async () => {
      const res = await request(app).get("/api/vehicles");
      expect(res.status).toBe(401);
    });

    it("restituisce lista veicoli dell'organizzazione", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.get("/api/vehicles");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((v: any) => expect(v.organizationId).toBe(1));
    });

    it("isolamento multi-tenant: org 2 non vede veicoli org 1", async () => {
      const agent1 = await loginAgent(app, 1, 1);
      const agent2 = await loginAgent(app, 2, 2);
      const res1 = await agent1.get("/api/vehicles");
      const res2 = await agent2.get("/api/vehicles");
      const ids1 = res1.body.map((v: any) => v.id);
      const ids2 = res2.body.map((v: any) => v.id);
      expect(ids1.filter((id: number) => ids2.includes(id)).length).toBe(0);
    });
  });

  describe("POST /api/vehicles", () => {
    it("restituisce 400 con dati mancanti", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.post("/api/vehicles").send({ plate: "XX000YY" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("crea veicolo con dati validi → 201", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.post("/api/vehicles").send({ plate: "ZZ999WW", model: "Iveco Daily" });
      expect(res.status).toBe(201);
      expect(res.body.plate).toBe("ZZ999WW");
      expect(res.body.organizationId).toBe(1);
    });
  });

  describe("PUT /api/vehicles/:id", () => {
    it("aggiorna veicolo esistente → 200", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.put("/api/vehicles/1").send({ status: "maintenance" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("maintenance");
    });

    it("restituisce 404 per veicolo inesistente", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.put("/api/vehicles/9999").send({ status: "available" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/vehicles/:id", () => {
    it("elimina veicolo → 200", async () => {
      const agent = await loginAgent(app, 1, 1);
      const createRes = await agent.post("/api/vehicles").send({ plate: "DEL000", model: "Da Eliminare" });
      const id = createRes.body.id;
      const res = await agent.delete(`/api/vehicles/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/vehicles/:id/checklist", () => {
    it("restituisce checklist del veicolo", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.get("/api/vehicles/1/checklist");
      expect(res.status).toBe(200);
      expect(res.body.vehicleId).toBe(1);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("restituisce 404 per veicolo di altra org", async () => {
      const agent = await loginAgent(app, 1, 1);
      // vehicleId 3 appartiene all'org 2
      const res = await agent.get("/api/vehicles/3/checklist");
      expect(res.status).toBe(404);
    });
  });
});
