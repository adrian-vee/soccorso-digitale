import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import crypto from "crypto";

// Mock credits store
const creditsStore: Record<number, number> = { 1: 100, 2: 50 };

function createBillingTestApp() {
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

  // GET /api/billing/credits — saldo crediti
  app.get("/api/billing/credits", requireAuth, (req: any, res) => {
    const orgId = req.session.organizationId as number;
    const credits = creditsStore[orgId] ?? 0;
    res.json({ organizationId: orgId, credits });
  });

  // POST /api/billing/deduct — scala crediti
  app.post("/api/billing/deduct", requireAuth, (req: any, res) => {
    const { amount } = req.body;
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Importo non valido" });
    }
    const orgId = req.session.organizationId as number;
    const current = creditsStore[orgId] ?? 0;
    if (current < amount) {
      return res.status(402).json({ error: "Crediti insufficienti", current });
    }
    creditsStore[orgId] = current - amount;
    res.json({ success: true, remaining: creditsStore[orgId] });
  });

  // GET /api/billing/trip-cost/:tripId — calcolo costo viaggio
  app.get("/api/billing/trip-cost/:tripId", requireAuth, (_req, res) => {
    // Calcolo mock basato su km e tipo servizio
    const cost = { base: 25.0, perKm: 1.5, km: 10, total: 40.0, currency: "EUR" };
    res.json(cost);
  });

  // POST /api/billing/webhook — Stripe webhook (mock)
  // Note: in test the body is already parsed by express.json(), so we serialize it back for HMAC
  app.post("/api/billing/webhook", (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "test-webhook-secret";
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Firma webhook mancante" });
    }

    // Re-serialize body to verify HMAC (body already parsed by express.json)
    const payload = JSON.stringify(req.body);
    const expectedSig = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
    const receivedSig = (signature as string).replace("sha256=", "");

    if (receivedSig !== expectedSig) {
      return res.status(400).json({ error: "Firma webhook non valida" });
    }

    const event = req.body;
    if (event.type === "invoice.payment_succeeded") {
      const orgId = event.data?.object?.metadata?.organizationId;
      if (orgId) {
        creditsStore[parseInt(orgId)] = (creditsStore[parseInt(orgId)] || 0) + 100;
      }
    }

    res.json({ received: true });
  });

  // POST /api/test/set-session
  app.post("/api/test/set-session", (req: any, res) => {
    req.session.userId = req.body.userId;
    req.session.organizationId = req.body.organizationId;
    res.json({ ok: true });
  });

  return app;
}

async function loginAgent(app: express.Express, userId: number, orgId: number) {
  const agent = request.agent(app);
  await agent.post("/api/test/set-session").send({ userId, organizationId: orgId });
  return agent;
}

describe("Billing Routes", () => {
  const app = createBillingTestApp();

  describe("GET /api/billing/credits", () => {
    it("restituisce 401 senza autenticazione", async () => {
      const res = await request(app).get("/api/billing/credits");
      expect(res.status).toBe(401);
    });

    it("restituisce il saldo crediti dell'organizzazione", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.get("/api/billing/credits");
      expect(res.status).toBe(200);
      expect(typeof res.body.credits).toBe("number");
      expect(res.body.organizationId).toBe(1);
    });
  });

  describe("POST /api/billing/deduct", () => {
    it("restituisce 400 con importo non valido", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.post("/api/billing/deduct").send({ amount: -5 });
      expect(res.status).toBe(400);
    });

    it("scala crediti correttamente", async () => {
      const agent = await loginAgent(app, 1, 1);
      const beforeRes = await agent.get("/api/billing/credits");
      const before = beforeRes.body.credits;

      const res = await agent.post("/api/billing/deduct").send({ amount: 10 });
      expect(res.status).toBe(200);
      expect(res.body.remaining).toBe(before - 10);
    });

    it("restituisce 402 con crediti insufficienti", async () => {
      const agent = await loginAgent(app, 2, 2);
      // org 2 ha 50 crediti, proviamo a scalarne 1000
      const res = await agent.post("/api/billing/deduct").send({ amount: 1000 });
      expect(res.status).toBe(402);
      expect(res.body.error).toMatch(/insufficienti/i);
    });
  });

  describe("GET /api/billing/trip-cost/:tripId", () => {
    it("restituisce il calcolo del costo viaggio", async () => {
      const agent = await loginAgent(app, 1, 1);
      const res = await agent.get("/api/billing/trip-cost/1");
      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe("number");
      expect(res.body.currency).toBe("EUR");
    });
  });

  describe("POST /api/billing/webhook (Stripe)", () => {
    it("restituisce 400 senza firma webhook", async () => {
      const res = await request(app)
        .post("/api/billing/webhook")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ type: "invoice.payment_succeeded" }));
      expect(res.status).toBe(400);
    });

    it("elabora correttamente webhook con firma valida", async () => {
      const webhookSecret = "test-webhook-secret";
      const payload = JSON.stringify({
        type: "invoice.payment_succeeded",
        data: { object: { metadata: { organizationId: "1" } } },
      });
      const sig = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      const res = await request(app)
        .post("/api/billing/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", sig)
        .send(payload);
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });
});
