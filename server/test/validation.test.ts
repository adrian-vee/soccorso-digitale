import { describe, it, expect } from "vitest";
import { z } from "zod";

// Schema di esempio che rispecchiano quelli reali del progetto
const loginSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(1, "Password obbligatoria"),
});

const tripSchema = z.object({
  patientName: z.string().min(1, "Nome paziente obbligatorio"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

const vehicleSchema = z.object({
  plate: z.string().min(5, "Targa troppo corta").max(10, "Targa troppo lunga"),
  model: z.string().min(2, "Modello obbligatorio"),
  status: z.enum(["available", "in_use", "maintenance"]).optional(),
});

const organizationSchema = z.object({
  name: z.string().min(2, "Nome organizzazione obbligatorio"),
  email: z.string().email("Email non valida"),
  phone: z.string().optional(),
});

// Helper che simula safeParse response
function validateAndRespond<T>(schema: z.ZodSchema<T>, data: unknown): { status: number; body: any } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      status: 400,
      body: { error: "Dati non validi", details: result.error.flatten().fieldErrors },
    };
  }
  return { status: 200, body: result.data };
}

describe("Input Validation (safeParse)", () => {
  describe("Login Schema", () => {
    it("accetta credenziali valide", () => {
      const res = validateAndRespond(loginSchema, { email: "test@example.it", password: "mypassword" });
      expect(res.status).toBe(200);
    });

    it("rifiuta email non valida → 400", () => {
      const res = validateAndRespond(loginSchema, { email: "not-an-email", password: "mypassword" });
      expect(res.status).toBe(400);
      expect(res.body.details.email).toBeDefined();
    });

    it("rifiuta password vuota → 400", () => {
      const res = validateAndRespond(loginSchema, { email: "test@example.it", password: "" });
      expect(res.status).toBe(400);
      expect(res.body.details.password).toBeDefined();
    });

    it("rifiuta body vuoto → 400 con dettagli su tutti i campi", () => {
      const res = validateAndRespond(loginSchema, {});
      expect(res.status).toBe(400);
      expect(res.body.details.email).toBeDefined();
      expect(res.body.details.password).toBeDefined();
    });
  });

  describe("Trip Schema", () => {
    it("accetta viaggio valido", () => {
      const res = validateAndRespond(tripSchema, { patientName: "Mario Rossi", status: "pending" });
      expect(res.status).toBe(200);
    });

    it("rifiuta patientName vuoto → 400", () => {
      const res = validateAndRespond(tripSchema, { patientName: "" });
      expect(res.status).toBe(400);
      expect(res.body.details.patientName).toBeDefined();
    });

    it("rifiuta status non valido → 400", () => {
      const res = validateAndRespond(tripSchema, { patientName: "Mario Rossi", status: "invalid_status" });
      expect(res.status).toBe(400);
      expect(res.body.details.status).toBeDefined();
    });

    it("accetta viaggio con solo patientName (campi opzionali)", () => {
      const res = validateAndRespond(tripSchema, { patientName: "Anna Verdi" });
      expect(res.status).toBe(200);
    });

    it("rifiuta note troppo lunghe → 400", () => {
      const longNote = "x".repeat(1001);
      const res = validateAndRespond(tripSchema, { patientName: "Test", notes: longNote });
      expect(res.status).toBe(400);
    });
  });

  describe("Vehicle Schema", () => {
    it("accetta veicolo valido", () => {
      const res = validateAndRespond(vehicleSchema, { plate: "AA000BB", model: "Fiat Ducato" });
      expect(res.status).toBe(200);
    });

    it("rifiuta targa troppo corta → 400", () => {
      const res = validateAndRespond(vehicleSchema, { plate: "AB", model: "Fiat" });
      expect(res.status).toBe(400);
      expect(res.body.details.plate).toBeDefined();
    });

    it("rifiuta targa troppo lunga → 400", () => {
      const res = validateAndRespond(vehicleSchema, { plate: "AAABBBCCCDDDEEE", model: "Fiat" });
      expect(res.status).toBe(400);
    });

    it("rifiuta status veicolo non valido → 400", () => {
      const res = validateAndRespond(vehicleSchema, { plate: "AA000BB", model: "Fiat", status: "broken" });
      expect(res.status).toBe(400);
    });
  });

  describe("Organization Schema", () => {
    it("accetta organizzazione valida", () => {
      const res = validateAndRespond(organizationSchema, { name: "Croce Rossa Milano", email: "info@cri.it" });
      expect(res.status).toBe(200);
    });

    it("rifiuta nome troppo corto → 400", () => {
      const res = validateAndRespond(organizationSchema, { name: "X", email: "info@org.it" });
      expect(res.status).toBe(400);
      expect(res.body.details.name).toBeDefined();
    });

    it("rifiuta email non valida → 400", () => {
      const res = validateAndRespond(organizationSchema, { name: "Org Valida", email: "not-email" });
      expect(res.status).toBe(400);
      expect(res.body.details.email).toBeDefined();
    });
  });

  describe("SafeParse vs Parse — nessun throw", () => {
    it("safeParse non lancia eccezione con dati invalidi", () => {
      expect(() => {
        tripSchema.safeParse({ patientName: 12345, status: "invalid" });
      }).not.toThrow();
    });

    it("parse lancia ZodError con dati invalidi", () => {
      expect(() => {
        tripSchema.parse({ patientName: "", status: "invalid" });
      }).toThrow();
    });

    it("safeParse restituisce success=false con dettagli", () => {
      const result = tripSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.patientName).toBeDefined();
      }
    });

    it("safeParse restituisce success=true con dati validi", () => {
      const result = tripSchema.safeParse({ patientName: "Test" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.patientName).toBe("Test");
      }
    });
  });
});
