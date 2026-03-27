import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express, Request, Response, NextFunction } from "express";
import { requireSuperAdmin } from "./auth-middleware";

const rb = {
  required: true,
  content: { "application/json": { schema: { type: "object" } } },
} as const;

const auth401 = { 401: { description: "Non autenticato" } } as const;
const std200 = { 200: { description: "OK" }, ...auth401 } as const;
const std201 = { 201: { description: "Creato" }, 400: { description: "Dati non validi" }, ...auth401 } as const;
const pub200 = { 200: { description: "OK" } } as const;

function pathParam(name: string, type = "integer") {
  return { in: "path" as const, name, required: true, schema: { type } };
}

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Soccorso Digitale API",
      version: "2.1.0",
      description:
        "API per la gestione dei servizi di trasporto sanitario programmati. Supporta sia /api/v1/* (versioned) che /api/* (legacy).",
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
      { name: "Fleet", description: "Gestione flotta e veicoli" },
      { name: "Shifts", description: "Turni e pianificazione personale" },
      { name: "Inventory", description: "Inventario e dotazioni" },
      { name: "Finance", description: "Finanza e rimborsi" },
      { name: "Booking", description: "Servizi programmati mobile" },
      { name: "Billing", description: "Fatturazione, pagamenti e marketplace" },
      { name: "Analytics", description: "Analisi e dashboard" },
      { name: "Admin", description: "Amministrazione sistema" },
      { name: "CRM", description: "CRM e campagne email" },
      { name: "Providers", description: "Provider esterni (geo, meteo, validazione)" },
      { name: "Webhooks", description: "Webhook in entrata" },
      { name: "SaaS", description: "Onboarding SaaS e marketplace" },
      { name: "OrgAdmin", description: "Amministrazione organizzazione" },
      { name: "Hub", description: "Portale Hub prenotazioni esterne" },
    ],
    paths: {
      // ──────────────────────────────────────────────────────────────────────
      // AUTH
      // ──────────────────────────────────────────────────────────────────────
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
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Login riuscito" },
            400: { description: "Dati mancanti" },
            401: { description: "Credenziali non valide" },
          },
        },
      },
      "/auth/logout": {
        post: {
          summary: "Logout utente",
          tags: ["Auth"],
          security: [],
          responses: { 200: { description: "Logout riuscito" } },
        },
      },
      "/auth/session": {
        get: {
          summary: "Stato sessione corrente",
          tags: ["Auth"],
          security: [],
          responses: { 200: { description: "Stato autenticazione" } },
        },
      },
      "/auth/register": {
        post: {
          summary: "Registra nuovo utente",
          tags: ["Auth"],
          security: [],
          requestBody: rb,
          responses: { 200: { description: "Utente creato" }, 400: { description: "Email già registrata o dati non validi" } },
        },
      },
      "/auth/refresh": {
        post: {
          summary: "Rinnova Supabase access token",
          tags: ["Auth"],
          security: [],
          requestBody: rb,
          responses: { 200: { description: "Token rinnovato" }, 400: { description: "refresh_token mancante" }, 401: { description: "Token non valido" } },
        },
      },
      "/auth/reset-password": {
        post: {
          summary: "Richiedi reset password via email",
          tags: ["Auth"],
          security: [],
          requestBody: rb,
          responses: { 200: { description: "Email inviata" }, 400: { description: "Email obbligatoria" } },
        },
      },
      "/auth/me": {
        get: {
          summary: "Profilo utente corrente",
          tags: ["Auth"],
          responses: std200,
        },
      },
      "/user-settings": {
        get: {
          summary: "Impostazioni utente corrente",
          tags: ["Auth"],
          responses: std200,
        },
        put: {
          summary: "Aggiorna impostazioni utente",
          tags: ["Auth"],
          requestBody: rb,
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // DASHBOARD
      // ──────────────────────────────────────────────────────────────────────
      "/dashboard/metrics": {
        get: {
          summary: "Metriche dashboard principale",
          tags: ["Analytics"],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // TRIPS
      // ──────────────────────────────────────────────────────────────────────
      "/trips": {
        get: {
          summary: "Lista viaggi organizzazione",
          tags: ["Trips"],
          parameters: [
            { in: "query", name: "locationId", schema: { type: "integer" } },
            { in: "query", name: "status", schema: { type: "string" } },
            { in: "query", name: "from", schema: { type: "string", format: "date" } },
            { in: "query", name: "to", schema: { type: "string", format: "date" } },
          ],
          responses: std200,
        },
        post: {
          summary: "Crea nuovo viaggio",
          tags: ["Trips"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/trips/{id}": {
        get: {
          summary: "Dettaglio viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/trips/{id}/authorization": {
        get: {
          summary: "Autorizzazione viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/trips/{id}/authorization/pdf": {
        get: {
          summary: "PDF autorizzazione viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: { 200: { description: "PDF binario" }, ...auth401 },
        },
      },
      "/trips/{id}/pdf": {
        get: {
          summary: "PDF viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: pub200,
        },
      },
      "/trips/{id}/financials": {
        get: {
          summary: "Dati finanziari viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/trips/{id}/verify-integrity": {
        get: {
          summary: "Verifica integrità record viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          security: [],
          responses: pub200,
        },
      },
      "/trips/{id}/check-sla": {
        post: {
          summary: "Verifica SLA viaggio",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/trips/bulk-delete": {
        post: {
          summary: "Eliminazione massiva viaggi",
          tags: ["Trips"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/trips-with-device-auth": {
        get: {
          summary: "Viaggi con autorizzazione dispositivo",
          tags: ["Trips"],
          responses: std200,
        },
      },
      "/integrity/stats": {
        get: {
          summary: "Statistiche integrità dati",
          tags: ["Trips"],
          responses: std200,
        },
      },
      "/reports/trips-pdf": {
        get: {
          summary: "Report PDF lista viaggi",
          tags: ["Trips"],
          responses: { 200: { description: "PDF binario" }, ...auth401 },
        },
      },
      "/reports/trip/{id}/pdf": {
        get: {
          summary: "PDF singolo viaggio (report)",
          tags: ["Trips"],
          parameters: [pathParam("id")],
          responses: { 200: { description: "PDF binario" }, ...auth401 },
        },
      },
      "/soccorso-live/pdf": {
        post: {
          summary: "Genera PDF Soccorso Live",
          tags: ["Trips"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/soccorso-live/report": {
        post: {
          summary: "Crea report Soccorso Live",
          tags: ["Trips"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/public/soccorso-live/report/{token}": {
        get: {
          summary: "Visualizza report Soccorso Live pubblico",
          tags: ["Trips"],
          security: [],
          parameters: [pathParam("token", "string")],
          responses: pub200,
        },
      },
      "/documents/{filename}": {
        get: {
          summary: "Scarica documento allegato",
          tags: ["Trips"],
          parameters: [pathParam("filename", "string")],
          responses: std200,
        },
      },
      "/address-autocomplete": {
        get: {
          summary: "Autocompletamento indirizzo",
          tags: ["Trips"],
          security: [],
          parameters: [{ in: "query", name: "q", required: true, schema: { type: "string" } }],
          responses: pub200,
        },
      },
      "/place-details": {
        get: {
          summary: "Dettagli luogo Google Places",
          tags: ["Trips"],
          security: [],
          responses: pub200,
        },
      },
      "/places/autocomplete": {
        get: {
          summary: "Autocompletamento Google Places",
          tags: ["Trips"],
          security: [],
          responses: pub200,
        },
      },
      "/places/details": {
        get: {
          summary: "Dettagli luogo (v2)",
          tags: ["Trips"],
          security: [],
          responses: pub200,
        },
      },
      "/directions": {
        get: {
          summary: "Calcolo percorso",
          tags: ["Trips"],
          security: [],
          responses: pub200,
        },
      },
      "/distance": {
        post: {
          summary: "Calcola distanza tra due punti",
          tags: ["Trips"],
          security: [],
          requestBody: rb,
          responses: pub200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // FLEET (Vehicles + Locations)
      // ──────────────────────────────────────────────────────────────────────
      "/vehicles": {
        get: {
          summary: "Lista veicoli organizzazione",
          tags: ["Fleet"],
          responses: std200,
        },
        post: {
          summary: "Aggiungi veicolo",
          tags: ["Fleet"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/vehicles/{id}": {
        get: {
          summary: "Dettaglio veicolo",
          tags: ["Fleet"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna veicolo",
          tags: ["Fleet"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina veicolo",
          tags: ["Fleet"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/last-trip": {
        get: {
          summary: "Ultimo viaggio del veicolo",
          tags: ["Fleet"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/next-progressive": {
        get: {
          summary: "Prossimo numero progressivo viaggio",
          tags: ["Fleet"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/locations": {
        get: {
          summary: "Lista sedi organizzazione",
          tags: ["Fleet"],
          responses: std200,
        },
        post: {
          summary: "Crea sede",
          tags: ["Fleet"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/org/primary-location": {
        get: {
          summary: "Sede primaria organizzazione",
          tags: ["Fleet"],
          responses: std200,
        },
      },
      "/locations/{id}": {
        get: {
          summary: "Dettaglio sede",
          tags: ["Fleet"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna sede",
          tags: ["Fleet"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina sede",
          tags: ["Fleet"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/locations/{id}/set-primary": {
        put: {
          summary: "Imposta sede come primaria",
          tags: ["Fleet"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/organizations/{orgId}/logo": {
        post: {
          summary: "Carica logo organizzazione",
          tags: ["OrgAdmin"],
          parameters: [pathParam("orgId")],
          requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object" } } } },
          responses: std200,
        },
        get: {
          summary: "Scarica logo organizzazione",
          tags: ["OrgAdmin"],
          security: [],
          parameters: [pathParam("orgId")],
          responses: pub200,
        },
        delete: {
          summary: "Elimina logo organizzazione",
          tags: ["OrgAdmin"],
          parameters: [pathParam("orgId")],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // SHIFTS
      // ──────────────────────────────────────────────────────────────────────
      "/notifications": {
        get: {
          summary: "Lista notifiche",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/shift-notifications": {
        get: {
          summary: "Notifiche turni",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/staff-members": {
        get: {
          summary: "Lista membri staff",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea membro staff",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/staff-members/{id}": {
        get: {
          summary: "Dettaglio membro staff",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        patch: {
          summary: "Aggiorna membro staff",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina membro staff",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/staff-members/by-user/{userId}": {
        get: {
          summary: "Membro staff per userId",
          tags: ["Shifts"],
          parameters: [pathParam("userId")],
          responses: std200,
        },
      },
      "/staff-members/self-register": {
        post: {
          summary: "Auto-registrazione membro staff",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/shift-templates": {
        get: {
          summary: "Lista template turni",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea template turno",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/shift-templates/{id}": {
        get: {
          summary: "Dettaglio template turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        patch: {
          summary: "Aggiorna template turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina template turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/shift-templates/{id}/generate": {
        post: {
          summary: "Genera istanze da template turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/shift-instances": {
        get: {
          summary: "Lista istanze turni",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea istanza turno",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/shift-instances/open": {
        get: {
          summary: "Turni aperti (disponibili per iscrizione)",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/shift-instances/generate-week": {
        post: {
          summary: "Genera turni per settimana",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/shift-instances/bulk-delete": {
        post: {
          summary: "Eliminazione massiva istanze turni",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/shift-instances/cleanup-orphans": {
        post: {
          summary: "Pulizia istanze turni orfane",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/shift-instances/{id}": {
        get: {
          summary: "Dettaglio istanza turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        patch: {
          summary: "Aggiorna istanza turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina istanza turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/shift-instances/{shiftId}/signup": {
        post: {
          summary: "Iscrizione volontaria a turno",
          tags: ["Shifts"],
          parameters: [pathParam("shiftId")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/shift-audit-log": {
        get: {
          summary: "Log audit turni",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/shift-report/pdf": {
        get: {
          summary: "Report PDF turni",
          tags: ["Shifts"],
          responses: { 200: { description: "PDF binario" }, ...auth401 },
        },
      },
      "/shift-report/data": {
        get: {
          summary: "Dati report turni",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/shift-report/staff-pdf": {
        get: {
          summary: "Report PDF per singolo operatore",
          tags: ["Shifts"],
          responses: { 200: { description: "PDF binario" }, ...auth401 },
        },
      },
      "/shift-report/staff-ics": {
        get: {
          summary: "Calendario ICS operatore",
          tags: ["Shifts"],
          responses: { 200: { description: "File ICS" }, ...auth401 },
        },
      },
      "/shift-stats": {
        get: {
          summary: "Statistiche turni",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/shift-assignments": {
        get: {
          summary: "Lista assegnazioni turni",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea assegnazione turno",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/shift-assignments/{id}": {
        patch: {
          summary: "Aggiorna assegnazione turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina assegnazione turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/shift-assignments/{id}/check-in": {
        post: {
          summary: "Check-in turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/shift-assignments/{id}/check-out": {
        post: {
          summary: "Check-out turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/staff-availability": {
        get: {
          summary: "Lista disponibilità staff",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea disponibilità staff",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/staff-availability/{staffMemberId}": {
        get: {
          summary: "Disponibilità per membro staff",
          tags: ["Shifts"],
          parameters: [pathParam("staffMemberId")],
          responses: std200,
        },
      },
      "/staff-availability/{id}": {
        patch: {
          summary: "Aggiorna disponibilità staff",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina disponibilità staff",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/shift-swap-requests": {
        get: {
          summary: "Lista richieste scambio turno",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea richiesta scambio turno",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/shift-swap-requests/{id}": {
        patch: {
          summary: "Aggiorna richiesta scambio turno",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/service-events": {
        get: {
          summary: "Lista eventi di servizio",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea evento di servizio",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/service-events/{id}": {
        get: {
          summary: "Dettaglio evento di servizio",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        patch: {
          summary: "Aggiorna evento di servizio",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina evento di servizio",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/event-assignments": {
        get: {
          summary: "Lista assegnazioni eventi",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Crea assegnazione evento",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/event-assignments/{id}": {
        patch: {
          summary: "Aggiorna assegnazione evento",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina assegnazione evento",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/shift-activity-logs": {
        get: {
          summary: "Log attività turni",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/monthly-schedule": {
        get: {
          summary: "Calendario mensile turni",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/monthly-schedule/suggestions": {
        get: {
          summary: "Suggerimenti pianificazione mensile",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/monthly-schedule/assign": {
        post: {
          summary: "Assegna turno in calendario mensile",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/monthly-schedule/unassign": {
        post: {
          summary: "Rimuovi assegnazione da calendario mensile",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/monthly-schedule/assign/{assignmentId}": {
        delete: {
          summary: "Elimina assegnazione mensile",
          tags: ["Shifts"],
          parameters: [pathParam("assignmentId")],
          responses: std200,
        },
      },
      "/monthly-schedule/copy-from-previous": {
        post: {
          summary: "Copia turni dal mese precedente",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/monthly-schedule/generate": {
        post: {
          summary: "Genera turni mensili automaticamente",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/realtime-availability": {
        get: {
          summary: "Disponibilità real-time operatori",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/admin/shift-settings/rules": {
        get: {
          summary: "Regole impostazioni turni",
          tags: ["Shifts"],
          responses: std200,
        },
        put: {
          summary: "Aggiorna regole turni",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/shift-settings/staff": {
        get: {
          summary: "Impostazioni staff per turni",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/admin/shift-settings/staff/{staffId}": {
        put: {
          summary: "Aggiorna impostazioni staff specifico",
          tags: ["Shifts"],
          parameters: [pathParam("staffId")],
          requestBody: rb,
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // ESG & CARBON (under Shifts/Finance)
      // ──────────────────────────────────────────────────────────────────────
      "/esg/dashboard": {
        get: {
          summary: "Dashboard ESG",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/esg/snapshots": {
        get: {
          summary: "Snapshot ESG",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/esg/snapshots/generate": {
        post: {
          summary: "Genera snapshot ESG",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/esg/goals": {
        get: {
          summary: "Obiettivi ESG",
          tags: ["Finance"],
          responses: std200,
        },
        post: {
          summary: "Crea obiettivo ESG",
          tags: ["Finance"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/carbon/factors": {
        get: {
          summary: "Fattori di emissione carbonio",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/carbon/factors/seed": {
        post: {
          summary: "Inizializza fattori carbonio di default",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/carbon/calculate/{tripId}": {
        post: {
          summary: "Calcola emissioni CO2 per viaggio",
          tags: ["Finance"],
          parameters: [pathParam("tripId")],
          responses: std200,
        },
      },
      "/carbon/calculate-bulk": {
        post: {
          summary: "Calcolo massivo emissioni CO2",
          tags: ["Finance"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/carbon/stats": {
        get: {
          summary: "Statistiche carbonio",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/carbon/by-vehicle": {
        get: {
          summary: "Emissioni CO2 per veicolo",
          tags: ["Finance"],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // BURNOUT
      // ──────────────────────────────────────────────────────────────────────
      "/burnout/thresholds": {
        get: {
          summary: "Soglie burnout",
          tags: ["Shifts"],
          responses: std200,
        },
        post: {
          summary: "Imposta soglie burnout",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/burnout/dashboard": {
        get: {
          summary: "Dashboard burnout operatori",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/burnout/workload/{staffMemberId}": {
        get: {
          summary: "Carico di lavoro operatore",
          tags: ["Shifts"],
          parameters: [pathParam("staffMemberId")],
          responses: std200,
        },
      },
      "/burnout/staff-risk": {
        get: {
          summary: "Rischio burnout per staff",
          tags: ["Shifts"],
          responses: std200,
        },
      },
      "/burnout/operator/{id}": {
        get: {
          summary: "Dettaglio burnout operatore",
          tags: ["Shifts"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/burnout/calculate": {
        post: {
          summary: "Calcola indice burnout",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/burnout/calculate-from-trips": {
        post: {
          summary: "Calcola burnout da viaggi",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/burnout/calculate-from-shifts": {
        post: {
          summary: "Calcola burnout da turni",
          tags: ["Shifts"],
          requestBody: rb,
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // REIMBURSEMENTS
      // ──────────────────────────────────────────────────────────────────────
      "/reimbursements/location-distances": {
        get: {
          summary: "Distanze tra sedi per rimborsi",
          tags: ["Finance"],
          responses: std200,
        },
        post: {
          summary: "Imposta distanze tra sedi",
          tags: ["Finance"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/reimbursements/volunteers": {
        get: {
          summary: "Volontari per rimborsi",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/reimbursements/generate-test-shifts": {
        post: {
          summary: "Genera turni di test per rimborsi",
          tags: ["Finance"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/reimbursements/volunteer-shifts/{staffMemberId}": {
        get: {
          summary: "Turni volontario per rimborso",
          tags: ["Finance"],
          parameters: [pathParam("staffMemberId")],
          responses: std200,
        },
      },
      "/reimbursements/calculate": {
        post: {
          summary: "Calcola rimborsi",
          tags: ["Finance"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/reimbursements": {
        get: {
          summary: "Lista rimborsi",
          tags: ["Finance"],
          responses: std200,
        },
      },
      "/reimbursements/{id}": {
        get: {
          summary: "Dettaglio rimborso",
          tags: ["Finance"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        delete: {
          summary: "Elimina rimborso",
          tags: ["Finance"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/reimbursements/{id}/send": {
        post: {
          summary: "Invia rimborso al volontario",
          tags: ["Finance"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/reimbursements/{id}/sign": {
        post: {
          summary: "Firma rimborso (pubblica)",
          tags: ["Finance"],
          security: [],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: pub200,
        },
      },
      "/reimbursements/{id}/approve": {
        post: {
          summary: "Approva rimborso",
          tags: ["Finance"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/reimbursements/{id}/pdf": {
        get: {
          summary: "PDF rimborso",
          tags: ["Finance"],
          parameters: [pathParam("id")],
          responses: { 200: { description: "PDF binario" }, ...auth401 },
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // INVENTORY
      // ──────────────────────────────────────────────────────────────────────
      "/inventory/items": {
        get: {
          summary: "Lista articoli inventario",
          tags: ["Inventory"],
          responses: std200,
        },
        post: {
          summary: "Crea articolo inventario",
          tags: ["Inventory"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/inventory/items/{id}": {
        get: {
          summary: "Dettaglio articolo inventario",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        patch: {
          summary: "Aggiorna articolo inventario",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina articolo inventario",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/inventory/barcode/{barcode}": {
        get: {
          summary: "Ricerca articolo per barcode",
          tags: ["Inventory"],
          parameters: [pathParam("barcode", "string")],
          responses: std200,
        },
      },
      "/inventory/barcode/override": {
        post: {
          summary: "Override barcode articolo",
          tags: ["Inventory"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/inventory/barcode/learn": {
        post: {
          summary: "Apprendi nuovo barcode",
          tags: ["Inventory"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/inventory": {
        get: {
          summary: "Inventario veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna inventario veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/inventory/pending": {
        get: {
          summary: "Articoli inventario in attesa di rifornimento",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/inventory/usage": {
        post: {
          summary: "Registra utilizzo articoli inventario",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          requestBody: rb,
          responses: std200,
        },
        get: {
          summary: "Storico utilizzo inventario veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/inventory/replenish": {
        post: {
          summary: "Rifornisci inventario veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/inventory/replenish-history": {
        get: {
          summary: "Storico rifornimenti inventario",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/locations/{locationId}/warehouse": {
        get: {
          summary: "Magazzino sede",
          tags: ["Inventory"],
          parameters: [pathParam("locationId")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna magazzino sede",
          tags: ["Inventory"],
          parameters: [pathParam("locationId")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/inventory/alerts/low-stock": {
        get: {
          summary: "Articoli sotto scorta minima",
          tags: ["Inventory"],
          responses: std200,
        },
      },
      "/inventory/alerts/expiring": {
        get: {
          summary: "Articoli in scadenza",
          tags: ["Inventory"],
          responses: std200,
        },
      },
      "/inventory/dashboard": {
        get: {
          summary: "Dashboard inventario",
          tags: ["Inventory"],
          responses: std200,
        },
      },
      "/inventory/fleet-compliance": {
        get: {
          summary: "Conformità dotazioni flotta",
          tags: ["Inventory"],
          responses: std200,
        },
      },
      "/inventory/vehicle-compliance/{vehicleId}": {
        get: {
          summary: "Conformità dotazioni singolo veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/inventory/templates": {
        get: {
          summary: "Lista template dotazioni",
          tags: ["Inventory"],
          responses: std200,
        },
        post: {
          summary: "Crea template dotazioni",
          tags: ["Inventory"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/inventory/templates/{id}": {
        get: {
          summary: "Dettaglio template dotazioni",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        patch: {
          summary: "Aggiorna template dotazioni",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina template dotazioni",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/inventory/templates/{templateId}/items": {
        get: {
          summary: "Articoli template dotazioni",
          tags: ["Inventory"],
          parameters: [pathParam("templateId")],
          responses: std200,
        },
        post: {
          summary: "Aggiungi articolo a template",
          tags: ["Inventory"],
          parameters: [pathParam("templateId")],
          requestBody: rb,
          responses: std201,
        },
      },
      "/inventory/templates/{templateId}/items/{itemId}": {
        patch: {
          summary: "Aggiorna articolo in template",
          tags: ["Inventory"],
          parameters: [pathParam("templateId"), pathParam("itemId")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Rimuovi articolo da template",
          tags: ["Inventory"],
          parameters: [pathParam("templateId"), pathParam("itemId")],
          responses: std200,
        },
      },
      "/inventory/vehicles-templates": {
        get: {
          summary: "Template associati ai veicoli",
          tags: ["Inventory"],
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/template": {
        get: {
          summary: "Template dotazioni veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
        post: {
          summary: "Assegna template dotazioni a veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/checklist-items": {
        get: {
          summary: "Checklist dotazioni veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/vehicles/{vehicleId}/active-event": {
        get: {
          summary: "Evento sportivo attivo per veicolo",
          tags: ["Inventory"],
          parameters: [pathParam("vehicleId")],
          responses: std200,
        },
      },
      "/sporting-events": {
        get: {
          summary: "Lista eventi sportivi",
          tags: ["Inventory"],
          responses: std200,
        },
        post: {
          summary: "Crea evento sportivo",
          tags: ["Inventory"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/sporting-events/{id}": {
        get: {
          summary: "Dettaglio evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        patch: {
          summary: "Aggiorna evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/sporting-events/{eventId}/checkout": {
        post: {
          summary: "Checkout dotazioni evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("eventId")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/sporting-events/{eventId}/checkin/{logId}": {
        post: {
          summary: "Checkin dotazioni evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("eventId"), pathParam("logId")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/sporting-events/stats/inventory": {
        get: {
          summary: "Statistiche inventario eventi sportivi",
          tags: ["Inventory"],
          responses: std200,
        },
      },
      "/sporting-events/{eventId}/assignments": {
        post: {
          summary: "Assegna veicolo a evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("eventId")],
          requestBody: rb,
          responses: std201,
        },
      },
      "/sporting-events/{eventId}/assignments/{assignmentId}": {
        delete: {
          summary: "Rimuovi assegnazione da evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("eventId"), pathParam("assignmentId")],
          responses: std200,
        },
      },
      "/sporting-events/{id}/pdf": {
        get: {
          summary: "PDF evento sportivo",
          tags: ["Inventory"],
          parameters: [pathParam("id")],
          responses: { 200: { description: "PDF binario" }, ...auth401 },
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // BOOKING (Scheduled Services / Mobile)
      // ──────────────────────────────────────────────────────────────────────
      "/scheduled-services": {
        get: {
          summary: "Lista servizi programmati",
          tags: ["Booking"],
          responses: std200,
        },
        post: {
          summary: "Crea servizio programmato",
          tags: ["Booking"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/scheduled-services/{id}": {
        get: {
          summary: "Dettaglio servizio programmato",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna servizio programmato",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina servizio programmato",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/scheduled-services/bulk": {
        post: {
          summary: "Crea servizi programmati in blocco",
          tags: ["Booking"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/scheduled-services/{id}/status": {
        patch: {
          summary: "Aggiorna stato servizio programmato",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/scheduled-services/vehicle/{vehicleId}/date/{date}": {
        delete: {
          summary: "Elimina servizi programmati per veicolo e data",
          tags: ["Booking"],
          parameters: [pathParam("vehicleId"), pathParam("date", "string")],
          responses: std200,
        },
      },
      "/scheduled-services/upload-pdf": {
        post: {
          summary: "Carica PDF pianificazione servizi",
          tags: ["Booking"],
          requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object" } } } },
          responses: std200,
        },
      },
      "/scheduled-services/import-pdf": {
        post: {
          summary: "Importa pianificazione da PDF",
          tags: ["Booking"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/mobile/today": {
        get: {
          summary: "Servizi odierni per veicolo (mobile)",
          tags: ["Booking"],
          responses: std200,
        },
      },
      "/mobile/scheduled-services/{id}/start": {
        patch: {
          summary: "Avvia servizio programmato (mobile)",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/mobile/scheduled-services/{id}/complete": {
        patch: {
          summary: "Completa servizio programmato (mobile)",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/mobile/scheduled-services/{id}/suspend": {
        patch: {
          summary: "Sospendi servizio programmato (mobile)",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/mobile/scheduled-services/{id}/cancel": {
        patch: {
          summary: "Annulla servizio programmato (mobile)",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/mobile/scheduled-services/{id}/wait": {
        patch: {
          summary: "Metti in attesa servizio programmato (mobile)",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/mobile/scheduled-services/{id}/resume": {
        patch: {
          summary: "Riprendi servizio programmato (mobile)",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/mobile/empty-trip/start": {
        post: {
          summary: "Avvia viaggio a vuoto (mobile)",
          tags: ["Booking"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/mobile/empty-trip/{id}/complete": {
        patch: {
          summary: "Completa viaggio a vuoto (mobile)",
          tags: ["Booking"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/mobile/scheduled-services": {
        post: {
          summary: "Crea servizio programmato da mobile",
          tags: ["Booking"],
          requestBody: rb,
          responses: std201,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // BILLING
      // ──────────────────────────────────────────────────────────────────────
      "/admin/premium-modules": {
        get: {
          summary: "Moduli premium disponibili",
          tags: ["Billing"],
          responses: std200,
        },
      },
      "/admin/org-subscriptions": {
        get: {
          summary: "Abbonamenti organizzazione",
          tags: ["Billing"],
          responses: std200,
        },
      },
      "/admin/create-checkout-session": {
        post: {
          summary: "Crea sessione checkout Stripe",
          tags: ["Billing"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/payment-history": {
        get: {
          summary: "Storico pagamenti",
          tags: ["Billing"],
          responses: std200,
        },
      },
      "/marketplace": {
        get: {
          summary: "Marketplace moduli",
          tags: ["Billing"],
          responses: std200,
        },
      },
      "/marketplace/my-purchases": {
        get: {
          summary: "Miei acquisti marketplace",
          tags: ["Billing"],
          responses: std200,
        },
      },
      "/marketplace/my-purchases-detailed": {
        get: {
          summary: "Miei acquisti marketplace (dettaglio)",
          tags: ["Billing"],
          responses: std200,
        },
      },
      "/marketplace/activate-trial": {
        post: {
          summary: "Attiva trial modulo",
          tags: ["Billing"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/marketplace/cancel-subscription": {
        post: {
          summary: "Annulla abbonamento modulo",
          tags: ["Billing"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/marketplace/purchase": {
        post: {
          summary: "Acquista modulo",
          tags: ["Billing"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/marketplace/invoice/{paymentId}": {
        get: {
          summary: "Fattura acquisto marketplace",
          tags: ["Billing"],
          parameters: [pathParam("paymentId")],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // ANALYTICS
      // ──────────────────────────────────────────────────────────────────────
      "/admin/analytics/overview": {
        get: {
          summary: "Overview analytics organizzazione",
          tags: ["Analytics"],
          responses: std200,
        },
      },
      "/admin/analytics/trips": {
        get: {
          summary: "Analytics viaggi",
          tags: ["Analytics"],
          responses: std200,
        },
      },
      "/admin/analytics/vehicles": {
        get: {
          summary: "Analytics veicoli",
          tags: ["Analytics"],
          responses: std200,
        },
      },
      "/admin/analytics/staff": {
        get: {
          summary: "Analytics staff",
          tags: ["Analytics"],
          responses: std200,
        },
      },
      "/admin/analytics/finance": {
        get: {
          summary: "Analytics finanza",
          tags: ["Analytics"],
          responses: std200,
        },
      },
      "/admin/analytics/export": {
        get: {
          summary: "Esporta dati analytics",
          tags: ["Analytics"],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // ADMIN
      // ──────────────────────────────────────────────────────────────────────
      "/admin/organizations": {
        get: {
          summary: "Lista organizzazioni (super admin)",
          tags: ["Admin"],
          responses: std200,
        },
      },
      "/config/maps": {
        get: {
          summary: "Configurazione chiavi Maps",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },
      "/public/apk-info": {
        get: {
          summary: "Informazioni APK disponibile",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },
      "/admin/apk-access-code": {
        get: {
          summary: "Leggi codice accesso APK",
          tags: ["Admin"],
          responses: std200,
        },
        put: {
          summary: "Aggiorna codice accesso APK",
          tags: ["Admin"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/public/download-apk": {
        get: {
          summary: "Scarica APK (con codice accesso)",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },
      "/admin/upload-apk-init": {
        post: {
          summary: "Inizializza upload APK",
          tags: ["Admin"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/upload-apk-chunk": {
        post: {
          summary: "Carica chunk APK",
          tags: ["Admin"],
          requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object" } } } },
          responses: std200,
        },
      },
      "/admin/upload-apk-complete": {
        post: {
          summary: "Finalizza upload APK",
          tags: ["Admin"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/delete-apk": {
        delete: {
          summary: "Elimina APK",
          tags: ["Admin"],
          responses: std200,
        },
      },
      "/public/request-demo": {
        post: {
          summary: "Richiedi demo",
          tags: ["Admin"],
          security: [],
          requestBody: rb,
          responses: pub200,
        },
      },
      "/google-maps-loader": {
        get: {
          summary: "Script loader Google Maps",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },
      "/health": {
        get: {
          summary: "Health check sistema",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },
      "/public/status": {
        get: {
          summary: "Stato pubblico sistema",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },
      "/public/activity-feed": {
        get: {
          summary: "Feed attività pubblica",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },
      "/public/impact": {
        get: {
          summary: "Impatto pubblico (statistiche anonime)",
          tags: ["Admin"],
          security: [],
          responses: pub200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // WEBHOOKS
      // ──────────────────────────────────────────────────────────────────────
      "/webhooks/stripe": {
        post: {
          summary: "Webhook Stripe",
          tags: ["Webhooks"],
          security: [],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "Webhook processato" }, 400: { description: "Firma non valida" } },
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // CRM
      // ──────────────────────────────────────────────────────────────────────
      "/crm/track/open/{pixelId}": {
        get: {
          summary: "Tracking apertura email (pixel)",
          tags: ["CRM"],
          security: [],
          parameters: [pathParam("pixelId", "string")],
          responses: pub200,
        },
      },
      "/crm/track/click/{logId}": {
        get: {
          summary: "Tracking click link email",
          tags: ["CRM"],
          security: [],
          parameters: [pathParam("logId", "string")],
          responses: pub200,
        },
      },
      "/crm/webhooks/resend": {
        post: {
          summary: "Webhook Resend (bounce/complaint)",
          tags: ["CRM"],
          security: [],
          requestBody: rb,
          responses: pub200,
        },
      },
      "/crm/stats": {
        get: {
          summary: "Statistiche CRM globali",
          tags: ["CRM"],
          responses: std200,
        },
      },
      "/crm/organizations": {
        get: {
          summary: "Lista organizzazioni CRM",
          tags: ["CRM"],
          responses: std200,
        },
        post: {
          summary: "Crea organizzazione CRM",
          tags: ["CRM"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/crm/organizations/{id}": {
        get: {
          summary: "Dettaglio organizzazione CRM",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna organizzazione CRM",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina organizzazione CRM",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/templates": {
        get: {
          summary: "Lista template email CRM",
          tags: ["CRM"],
          responses: std200,
        },
        post: {
          summary: "Crea template email CRM",
          tags: ["CRM"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/crm/templates/{id}": {
        put: {
          summary: "Aggiorna template email CRM",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina template email CRM",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/send-single": {
        post: {
          summary: "Invia email singola CRM",
          tags: ["CRM"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/crm/smtp": {
        get: {
          summary: "Configurazione SMTP CRM",
          tags: ["CRM"],
          responses: std200,
        },
        post: {
          summary: "Imposta configurazione SMTP CRM",
          tags: ["CRM"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/crm/smtp/test": {
        post: {
          summary: "Test configurazione SMTP",
          tags: ["CRM"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/crm/smtp/{id}": {
        delete: {
          summary: "Elimina configurazione SMTP",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/campaigns": {
        get: {
          summary: "Lista campagne email",
          tags: ["CRM"],
          responses: std200,
        },
        post: {
          summary: "Crea campagna email",
          tags: ["CRM"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/crm/campaigns/{id}": {
        put: {
          summary: "Aggiorna campagna email",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/crm/campaigns/{id}/send": {
        post: {
          summary: "Invia campagna email",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/campaigns/{id}/pause": {
        post: {
          summary: "Metti in pausa campagna email",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/campaigns/{id}/resume": {
        post: {
          summary: "Riprendi campagna email",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/campaigns/{id}/stop": {
        post: {
          summary: "Ferma campagna email",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/campaigns/{id}/stats": {
        get: {
          summary: "Statistiche campagna email",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/campaigns/{id}/preview": {
        get: {
          summary: "Anteprima campagna email",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/analytics": {
        get: {
          summary: "Analytics email CRM",
          tags: ["CRM"],
          responses: std200,
        },
      },
      "/crm/discovery/jobs": {
        get: {
          summary: "Lista job discovery CRM",
          tags: ["CRM"],
          responses: std200,
        },
      },
      "/crm/discovery/jobs/{id}": {
        get: {
          summary: "Dettaglio job discovery CRM",
          tags: ["CRM"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/crm/discovery/google-places": {
        post: {
          summary: "Avvia discovery Google Places",
          tags: ["CRM"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/crm/discovery/enrich": {
        post: {
          summary: "Avvia enrichment email (Hunter)",
          tags: ["CRM"],
          responses: std200,
        },
      },
      "/crm/discovery/enrich-apollo": {
        post: {
          summary: "Avvia enrichment Apollo",
          tags: ["CRM"],
          responses: std200,
        },
      },
      "/crm/map-data": {
        get: {
          summary: "Dati mappa CRM",
          tags: ["CRM"],
          responses: std200,
        },
      },
      "/crm/unsubscribe/{orgId}": {
        get: {
          summary: "Disiscrivi organizzazione da email CRM",
          tags: ["CRM"],
          security: [],
          parameters: [pathParam("orgId")],
          responses: pub200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // SAAS / MARKETPLACE
      // ──────────────────────────────────────────────────────────────────────
      "/saas/marketplace-items": {
        get: {
          summary: "Lista item marketplace SaaS",
          tags: ["SaaS"],
          responses: std200,
        },
        post: {
          summary: "Crea item marketplace SaaS",
          tags: ["SaaS"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/saas/marketplace-items/{id}": {
        put: {
          summary: "Aggiorna item marketplace SaaS",
          tags: ["SaaS"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina item marketplace SaaS",
          tags: ["SaaS"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/saas/marketplace-stats": {
        get: {
          summary: "Statistiche marketplace SaaS",
          tags: ["SaaS"],
          responses: std200,
        },
      },
      "/saas/marketplace-analytics": {
        get: {
          summary: "Analytics marketplace SaaS",
          tags: ["SaaS"],
          responses: std200,
        },
      },
      "/saas/expire-trials": {
        post: {
          summary: "Scade trial attivi",
          tags: ["SaaS"],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // PROVIDERS
      // ──────────────────────────────────────────────────────────────────────
      "/providers/geo/geocode": {
        post: {
          summary: "Geocodifica indirizzo",
          tags: ["Providers"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/providers/geo/w3w": {
        post: {
          summary: "Converti coordinate What3Words",
          tags: ["Providers"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/providers/geo/reverse": {
        post: {
          summary: "Geocodifica inversa",
          tags: ["Providers"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/providers/weather": {
        get: {
          summary: "Condizioni meteo attuali",
          tags: ["Providers"],
          responses: std200,
        },
      },
      "/providers/weather/impact": {
        get: {
          summary: "Impatto meteo su operazioni",
          tags: ["Providers"],
          responses: std200,
        },
      },
      "/providers/holidays/{year}": {
        get: {
          summary: "Festività per anno",
          tags: ["Providers"],
          parameters: [pathParam("year")],
          responses: std200,
        },
      },
      "/providers/holidays/check/{date}": {
        get: {
          summary: "Verifica se data è festiva",
          tags: ["Providers"],
          parameters: [pathParam("date", "string")],
          responses: std200,
        },
      },
      "/providers/alerts": {
        get: {
          summary: "Alert operativi attivi",
          tags: ["Providers"],
          responses: std200,
        },
      },
      "/providers/validate/cf": {
        post: {
          summary: "Valida codice fiscale",
          tags: ["Providers"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/providers/validate/vat": {
        post: {
          summary: "Valida partita IVA",
          tags: ["Providers"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/providers/validate/password": {
        post: {
          summary: "Valida sicurezza password",
          tags: ["Providers"],
          security: [],
          requestBody: rb,
          responses: pub200,
        },
      },
      "/providers/health": {
        get: {
          summary: "Health check provider esterni",
          tags: ["Providers"],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // ORG ADMIN (org-admin-routes.ts)
      // ──────────────────────────────────────────────────────────────────────
      "/org/users": {
        get: {
          summary: "Lista utenti organizzazione",
          tags: ["OrgAdmin"],
          responses: std200,
        },
        post: {
          summary: "Crea utente organizzazione",
          tags: ["OrgAdmin"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/org/users/{id}": {
        get: {
          summary: "Dettaglio utente organizzazione",
          tags: ["OrgAdmin"],
          parameters: [pathParam("id")],
          responses: std200,
        },
        put: {
          summary: "Aggiorna utente organizzazione",
          tags: ["OrgAdmin"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina utente organizzazione",
          tags: ["OrgAdmin"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/org/roles": {
        get: {
          summary: "Lista ruoli personalizzati",
          tags: ["OrgAdmin"],
          responses: std200,
        },
        post: {
          summary: "Crea ruolo personalizzato",
          tags: ["OrgAdmin"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/org/roles/{id}": {
        put: {
          summary: "Aggiorna ruolo personalizzato",
          tags: ["OrgAdmin"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina ruolo personalizzato",
          tags: ["OrgAdmin"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/org/invitations": {
        get: {
          summary: "Lista inviti organizzazione",
          tags: ["OrgAdmin"],
          responses: std200,
        },
        post: {
          summary: "Invia invito utente",
          tags: ["OrgAdmin"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/org/invitations/{id}": {
        delete: {
          summary: "Revoca invito",
          tags: ["OrgAdmin"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/org/settings": {
        get: {
          summary: "Impostazioni organizzazione",
          tags: ["OrgAdmin"],
          responses: std200,
        },
        put: {
          summary: "Aggiorna impostazioni organizzazione",
          tags: ["OrgAdmin"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/org/access-logs": {
        get: {
          summary: "Log accessi organizzazione",
          tags: ["OrgAdmin"],
          responses: std200,
        },
      },
      "/org/audit-log": {
        get: {
          summary: "Audit log organizzazione",
          tags: ["OrgAdmin"],
          responses: std200,
        },
      },

      // ──────────────────────────────────────────────────────────────────────
      // HUB (hub-routes.ts)
      // ──────────────────────────────────────────────────────────────────────
      "/hub/directory": {
        get: {
          summary: "Directory organizzazioni Hub",
          tags: ["Hub"],
          security: [],
          responses: pub200,
        },
      },
      "/hub/{slug}/info": {
        get: {
          summary: "Info organizzazione Hub",
          tags: ["Hub"],
          security: [],
          parameters: [pathParam("slug", "string")],
          responses: pub200,
        },
      },
      "/hub/{slug}/pricing": {
        get: {
          summary: "Listino prezzi Hub",
          tags: ["Hub"],
          security: [],
          parameters: [pathParam("slug", "string")],
          responses: pub200,
        },
      },
      "/hub/autocomplete": {
        get: {
          summary: "Autocompletamento ricerca Hub",
          tags: ["Hub"],
          security: [],
          responses: pub200,
        },
      },
      "/hub/calculate-route": {
        post: {
          summary: "Calcola percorso Hub",
          tags: ["Hub"],
          security: [],
          requestBody: rb,
          responses: pub200,
        },
      },
      "/hub/{slug}/register": {
        post: {
          summary: "Registra cliente Hub",
          tags: ["Hub"],
          security: [],
          parameters: [pathParam("slug", "string")],
          requestBody: rb,
          responses: pub200,
        },
      },
      "/hub/{slug}/login": {
        post: {
          summary: "Login cliente Hub",
          tags: ["Hub"],
          security: [],
          parameters: [pathParam("slug", "string")],
          requestBody: rb,
          responses: pub200,
        },
      },
      "/hub/logout": {
        post: {
          summary: "Logout cliente Hub",
          tags: ["Hub"],
          security: [],
          responses: pub200,
        },
      },
      "/hub/me": {
        get: {
          summary: "Profilo cliente Hub",
          tags: ["Hub"],
          security: [],
          responses: pub200,
        },
      },
      "/hub/availability": {
        get: {
          summary: "Disponibilità Hub",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/hub/bookings": {
        post: {
          summary: "Crea prenotazione Hub",
          tags: ["Hub"],
          requestBody: rb,
          responses: std201,
        },
        get: {
          summary: "Le mie prenotazioni Hub",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/hub/bookings/{id}": {
        get: {
          summary: "Dettaglio prenotazione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/hub/bookings/{id}/cancel": {
        put: {
          summary: "Annulla prenotazione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/hub/bookings/{id}/invoice": {
        put: {
          summary: "Richiedi fattura prenotazione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/hub/notifications": {
        get: {
          summary: "Notifiche cliente Hub",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/hub/notifications/{id}/read": {
        put: {
          summary: "Segna notifica Hub come letta",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/hub/validate-discount": {
        post: {
          summary: "Valida codice sconto Hub",
          tags: ["Hub"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/hub/crew/missions": {
        get: {
          summary: "Missioni equipaggio Hub",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/hub/crew/missions/{id}/status": {
        put: {
          summary: "Aggiorna stato missione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/hub/bookings": {
        get: {
          summary: "Tutte le prenotazioni Hub (admin)",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/admin/hub/bookings/{id}/confirm": {
        put: {
          summary: "Conferma prenotazione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/admin/hub/bookings/{id}/reject": {
        put: {
          summary: "Rifiuta prenotazione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/hub/bookings/{id}/assign": {
        put: {
          summary: "Assegna veicolo a prenotazione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/hub/bookings/{id}/status": {
        put: {
          summary: "Aggiorna stato prenotazione Hub (admin)",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/hub/super-stats": {
        get: {
          summary: "Statistiche super-admin Hub",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/admin/hub/availability": {
        get: {
          summary: "Disponibilità Hub (admin)",
          tags: ["Hub"],
          responses: std200,
        },
        post: {
          summary: "Crea slot disponibilità Hub",
          tags: ["Hub"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/admin/hub/availability/copy": {
        post: {
          summary: "Copia disponibilità Hub da settimana precedente",
          tags: ["Hub"],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/hub/availability/{id}": {
        delete: {
          summary: "Elimina slot disponibilità Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/admin/hub/availability/overrides": {
        post: {
          summary: "Crea override disponibilità Hub",
          tags: ["Hub"],
          requestBody: rb,
          responses: std201,
        },
        get: {
          summary: "Lista override disponibilità Hub",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/admin/hub/availability/overrides/{id}": {
        delete: {
          summary: "Elimina override disponibilità Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/admin/hub/clients": {
        get: {
          summary: "Lista clienti Hub",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/admin/hub/clients/{id}/toggle": {
        put: {
          summary: "Attiva/disattiva cliente Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/admin/hub/conventions": {
        get: {
          summary: "Lista convenzioni Hub",
          tags: ["Hub"],
          responses: std200,
        },
        post: {
          summary: "Crea convenzione Hub",
          tags: ["Hub"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/admin/hub/conventions/{id}": {
        put: {
          summary: "Aggiorna convenzione Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
      },
      "/admin/hub/pricing": {
        get: {
          summary: "Listino prezzi Hub (admin)",
          tags: ["Hub"],
          responses: std200,
        },
        post: {
          summary: "Crea voce listino Hub",
          tags: ["Hub"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/admin/hub/pricing/{id}": {
        put: {
          summary: "Aggiorna voce listino Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina voce listino Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
      "/admin/hub/stats": {
        get: {
          summary: "Statistiche Hub (admin)",
          tags: ["Hub"],
          responses: std200,
        },
      },
      "/admin/hub/discount-codes": {
        get: {
          summary: "Lista codici sconto Hub",
          tags: ["Hub"],
          responses: std200,
        },
        post: {
          summary: "Crea codice sconto Hub",
          tags: ["Hub"],
          requestBody: rb,
          responses: std201,
        },
      },
      "/admin/hub/discount-codes/{id}": {
        put: {
          summary: "Aggiorna codice sconto Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          requestBody: rb,
          responses: std200,
        },
        delete: {
          summary: "Elimina codice sconto Hub",
          tags: ["Hub"],
          parameters: [pathParam("id")],
          responses: std200,
        },
      },
    },
  },
  apis: [],
};

// Async wrapper so Express catches rejections from requireSuperAdmin
function guardSwagger(req: Request, res: Response, next: NextFunction) {
  requireSuperAdmin(req, res, next).catch(next);
}

export function setupSwagger(app: Express): void {
  const spec = swaggerJsdoc(options);
  app.use(
    "/api-docs",
    guardSwagger,
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Soccorso Digitale API Docs",
    })
  );
  app.get("/api-docs.json", guardSwagger, (_req, res) => res.json(spec));
}
