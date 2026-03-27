import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Soccorso Digitale API",
      version: "2.1.0",
      description: "API per la gestione dei servizi di trasporto sanitario programmati. Supporta sia /api/v1/* (versioned) che /api/* (legacy).",
      contact: {
        name: "Soccorso Digitale",
        url: "https://soccorsodigitale.app",
        email: "hello@soccorsodigitale.app",
      },
    },
    servers: [
      { url: "/api/v1", description: "API v1 (corrente)" },
      { url: "/api", description: "API legacy (alias di v1)" },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "croce.sid",
        },
      },
    },
    security: [{ sessionAuth: [] }],
    tags: [
      { name: "Auth", description: "Autenticazione e sessioni" },
      { name: "Trips", description: "Gestione viaggi" },
      { name: "Vehicles", description: "Gestione veicoli" },
      { name: "Billing", description: "Fatturazione e pagamenti" },
      { name: "Users", description: "Gestione utenti" },
    ],
    paths: {
      "/auth/login": {
        post: {
          summary: "Login utente",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email", example: "admin@org.it" },
                    password: { type: "string", minLength: 1, example: "password" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Login riuscito, sessione creata" },
            400: { description: "Dati mancanti o non validi" },
            401: { description: "Credenziali non valide" },
          },
        },
      },
      "/auth/logout": {
        post: {
          summary: "Logout utente",
          tags: ["Auth"],
          responses: {
            200: { description: "Logout riuscito, sessione invalidata" },
          },
        },
      },
      "/trips": {
        get: {
          summary: "Lista viaggi per organizzazione",
          tags: ["Trips"],
          parameters: [
            {
              in: "query",
              name: "locationId",
              schema: { type: "integer" },
              description: "Filtra per sede",
            },
            {
              in: "query",
              name: "status",
              schema: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
              description: "Filtra per stato",
            },
          ],
          responses: {
            200: { description: "Lista viaggi dell'organizzazione" },
            401: { description: "Non autenticato" },
          },
        },
        post: {
          summary: "Crea nuovo viaggio",
          tags: ["Trips"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["patientName"],
                  properties: {
                    patientName: { type: "string" },
                    status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
                    scheduledAt: { type: "string", format: "date-time" },
                    notes: { type: "string", maxLength: 1000 },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Viaggio creato" },
            400: { description: "Dati non validi" },
            401: { description: "Non autenticato" },
          },
        },
      },
      "/vehicles": {
        get: {
          summary: "Lista veicoli per organizzazione",
          tags: ["Vehicles"],
          responses: {
            200: { description: "Lista veicoli" },
            401: { description: "Non autenticato" },
          },
        },
        post: {
          summary: "Aggiungi veicolo",
          tags: ["Vehicles"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["plate", "model"],
                  properties: {
                    plate: { type: "string", minLength: 5, maxLength: 10 },
                    model: { type: "string" },
                    status: { type: "string", enum: ["available", "in_use", "maintenance"] },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Veicolo aggiunto" },
            400: { description: "Dati non validi" },
            401: { description: "Non autenticato" },
          },
        },
      },
      "/billing/credits": {
        get: {
          summary: "Saldo crediti organizzazione",
          tags: ["Billing"],
          responses: {
            200: { description: "Saldo crediti" },
            401: { description: "Non autenticato" },
          },
        },
      },
    },
  },
  apis: [],
};

export function setupSwagger(app: Express): void {
  const spec = swaggerJsdoc(options);
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Soccorso Digitale API Docs",
    })
  );
  app.get("/api-docs.json", (_req, res) => res.json(spec));
}
