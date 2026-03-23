import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import crypto from "crypto";

// In-memory store for test trips
const tripsStore: Record<number, any[]> = {
  1: [
    { id: 1, organizationId: 1, patientName: "Mario Rossi", status: "pending", createdAt: new Date().toISOString() },
    { id: 2, organizationId: 1, patientName: "Anna Verdi", status: "completed", createdAt: new Date().toISOString() },
  ],
  2: [
    { id: 3, organizationId: 2, patientName: "Luigi Bianchi", status: "pending", createdAt: new Date().toISOString() },
  ],
};
let nextTripId = 10;

function createTripsTestApp() {
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

  // GET /api/trips — lista per organizzazione (multi-tenant isolation)
  app.get("/api/trips", requireAuth, (req: any, res) => {
    const orgId = req.session.organizationId as number;
    const trips = tripsStore[orgId] || [];
    res.json(trips);
  });

  // POST /api/trips — creazione viaggio
  app.post("/api/trips", requireAuth, (req: any, res) => {
    const { patientName, status } = req.body;
    if (!patientName) {
      return res.status(400).json({ error: "Dati non validi", details: { patientName: ["Obbligatorio"] } });
    }
    const orgId = req.session.organizationId as number;
    const trip = { id: nextTripId++, organizationId: orgId, patientName, status: status || "pending", createdAt: new Date().toISOString() };
    if (!tripsStore[orgId]) tripsStore[orgId] = [];
    tripsStore[orgId].push(trip);
    res.status(201).json(trip);
  });

  // PUT /api/trips/:id — modifica viaggio
  app.put("/api/trips/:id", requireAuth, (req: any, res) => {
    const tripId = parseInt(req.params.id);
    const orgId = req.session.organizationId as number;
    const trips = tripsStore[orgId] || [];
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) return res.status(404).json({ error: "Viaggio non trovato" });
    trips[idx] = { ...trips[idx], ...req.body };
    res.json(trips[idx]);
  });

  // DELETE /api/trips/:id — eliminazione viaggio
  app.delete("/api/trips/:id", requireAuth, (req: any, res) => {
    const tripId = parseInt(req.params.id);
    const orgId = req.session.organizationId as number;
    const trips = tripsStore[orgId] || [];
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) return res.status(404).json({ error: "Viaggio non trovato" });
    trips.splice(idx, 1);
    res.json({ success: true });
  });

  // GET /api/trips/:id/signature — firma HMAC-SHA256
  app.get("/api/trips/:id/signature", requireAuth, (req: any, res) => {
    const tripId = parseInt(req.params.id);
    const orgId = req.session.organizationId as number;
    const trips = tripsStore[orgId] || [];
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return res.status(404).json({ error: "Viaggio non trovato" });
    const secret = process.env.TRIP_INTEGRITY_SECRET || "test-integrity-secret";
    const payload = JSON.stringify({ id: trip.id, organizationId: trip.organizationId, patientName: trip.patientName });
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    res.json({ signature, payload });
  });

  // Setup session per i test
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

describe("Trips Routes", () => {
  const app = createTripsTestApp();

  describe("GET /api/trips", () => {
    it("restituisce 401 senza autenticazione", async () => {
      const res = await request(app).get("/api/trips");
      expect(res.status).toBe(401);
    });

    it("restituisce solo i viaggi dell'organizzazione autenticata", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.get("/api/trips");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Tutti i viaggi devono appartenere all'org 1
      res.body.forEach((trip: any) => {
        expect(trip.organizationId).toBe(1);
      });
    });

    it("isolamento multi-tenant: org 2 non vede viaggi org 1", async () => {
      const agent1 = await loginAgent(app, 1, 1);
      const agent2 = await loginAgent(app, 2, 2);

      const res1 = await agent1.get("/api/trips");
      const res2 = await agent2.get("/api/trips");

      const ids1 = res1.body.map((t: any) => t.id);
      const ids2 = res2.body.map((t: any) => t.id);

      // Nessun viaggio in comune
      const overlap = ids1.filter((id: number) => ids2.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  describe("POST /api/trips", () => {
    it("restituisce 400 con dati mancanti", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.post("/api/trips").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.details).toBeDefined();
    });

    it("crea viaggio con dati validi → 201", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.post("/api/trips").send({ patientName: "Test Paziente", status: "pending" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.patientName).toBe("Test Paziente");
      expect(res.body.organizationId).toBe(1);
    });
  });

  describe("PUT /api/trips/:id", () => {
    it("modifica viaggio esistente → 200", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.put("/api/trips/1").send({ status: "in_progress" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("in_progress");
    });

    it("restituisce 404 per viaggio inesistente", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.put("/api/trips/9999").send({ status: "completed" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/trips/:id", () => {
    it("elimina viaggio esistente → 200", async () => {
      const agent = await loginAgent(app, 1, 1);
      // Prima crea un viaggio da eliminare
      const createRes = await agent.post("/api/trips").send({ patientName: "Da Eliminare" });
      const tripId = createRes.body.id;
      const res = await agent.delete(`/api/trips/${tripId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/trips/:id/signature", () => {
    it("restituisce firma HMAC-SHA256 valida", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.get("/api/trips/1/signature");
      expect(res.status).toBe(200);
      expect(res.body.signature).toBeDefined();
      expect(res.body.signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex = 64 chars

      // Verifica l'integrità: ricalcola la firma
      const secret = "test-integrity-secret";
      const expected = crypto.createHmac("sha256", secret).update(res.body.payload).digest("hex");
      expect(res.body.signature).toBe(expected);
    });
  });
});
