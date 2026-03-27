# Soccorso Digitale — Documento di Architettura

> Versione: 2.1.0 — Aggiornato: 2026-03-27

---

## 1. Panoramica

Soccorso Digitale è una piattaforma SaaS multi-tenant per la gestione dei trasporti sanitari programmati (dialisi, visite specialistiche, dimissioni ospedaliere, trasferimenti inter-ospedalieri, servizi 118).

Serve cooperative di soccorso, ULSS, ASL, e operatori privati accreditati SSN per gestire:
- Pianificazione e dispaccio servizi di trasporto
- Flotta veicoli e manutenzione
- Turni e disponibilità personale
- Magazzino materiali sanitari
- Fatturazione e contratti con strutture sanitarie
- Partecipazione a gare d'appalto ANAC

---

## 2. Stack Tecnologico

| Componente | Tecnologia | Versione |
|------------|-----------|---------|
| Backend | Express.js (TypeScript) | 4.x |
| Database | PostgreSQL | 16 |
| ORM | Drizzle ORM | 0.39.x |
| Auth | Sessioni server-side + bcrypt | — |
| App Mobile | React Native (Expo SDK 54) | — |
| Dashboard Admin | Vanilla JS + HTML/CSS | — |
| Deploy | Railway (PaaS containerizzato) | — |
| CDN/DNS | Cloudflare | — |
| Pagamenti | Stripe | — |
| Email | Resend (hello@soccorsodigitale.app) | — |
| Monitoring | Sentry + PostHog + UptimeRobot | — |
| Logging | Pino (JSON strutturato) | 10.x |

---

## 3. Architettura

### 3.1 Deployment

Il sistema è deployato come applicazione monolitica su Railway con Docker. Il database PostgreSQL è hostato su Railway con backup automatici.

```
Internet
  └─ Cloudflare (TLS, WAF, CDN)
       └─ Railway (porta 5000)
            ├─ Express.js (API + static files)
            └─ PostgreSQL (Railway managed)
```

### 3.2 Struttura API

Tutte le API sono REST over HTTPS, versionate con URL path:

- **Canonical**: `/api/v1/{resource}` (es. `/api/v1/trips`)
- **Legacy alias**: `/api/{resource}` — reindirizzato internamente a v1 da middleware URL rewrite

Headers di versione presenti su ogni risposta API:
```
X-API-Version: v1
X-Platform-Version: 2.1.0
X-Request-ID: <uuid>   (correlation ID per request tracing)
```

### 3.3 Route per dominio

| File | Prefisso | Responsabilità |
|------|---------|----------------|
| auth.routes.ts | `/api/auth` | Login, logout, sessioni, reset password |
| trips.routes.ts | `/api/trips` | CRUD servizi di trasporto, dispaccio |
| fleet.routes.ts | `/api/vehicles` | Flotta, GPS, documenti, manutenzione |
| shifts.routes.ts | `/api/shifts` | Turni, disponibilità, pianificazione |
| inventory.routes.ts | `/api/inventory` | Magazzino materiali, scadenze |
| finance.routes.ts | `/api/finance` | Analisi economica, contratti |
| booking.routes.ts | `/api/hub` | Hub prenotazioni pubblico (pazienti) |
| billing.routes.ts | `/api/billing` | Stripe, abbonamenti, crediti |
| analytics.routes.ts | `/api/analytics` | KPI, report, gare ANAC |
| admin.routes.ts | `/api/admin` | Gestione organizzazioni (superadmin) |
| crm.routes.ts | `/api/crm` | CRM, campagne email |
| providers.routes.ts | `/api/providers` | Geocoding, meteo, festività |
| webhooks.routes.ts | `/api/webhooks` | Stripe, Resend webhook handlers |
| saas-onboarding.routes.ts | `/api/saas` | Trial, onboarding SaaS |

Documentazione interattiva: `/api-docs` (Swagger UI)

---

## 4. Isolamento Multi-tenant

### 4.1 Modello

Il sistema adotta **shared database, shared schema** con isolamento a livello di riga.

Ogni tabella operativa contiene la colonna `organization_id` come discriminatore tenant. Tutte le query filtrano automaticamente per `organization_id` estratto dalla sessione autenticata.

```
Tenant A (ULSS 6)     Tenant B (Croce Europa)
     │                        │
     └──── organization_id ───┘
               │
         tender_monitors
           trips
           vehicles
           staff_members
           shifts
           ... (~130 tabelle)
```

### 4.2 Enforcement

1. **Login** → sessione con `userId`, `organizationId`, `userRole`
2. **Ogni request** → `getEffectiveOrgId(req)` estrae l'org dal contesto sessione
3. **Ogni query DB** → filtra per `organization_id`
4. **Scritture** → `organization_id` impostato dal contesto auth, non dal client

### 4.3 Tabelle condivise vs tenant-specific

| Tipo | Tabelle |
|------|---------|
| **Condivise** | `plans`, `marketplace_modules`, `ssn_structures`, `holidays`, `carbon_emission_factors`, `fuel_prices` |
| **Tenant-specific** | Tutte le altre (~130+ tabelle operative) |

### 4.4 Ruoli (RBAC)

| Ruolo | Accesso |
|-------|---------|
| `super_admin` | Cross-tenant, tutte le funzionalità |
| `admin` | Organizzazione propria, gestione completa |
| `operator` | Organizzazione propria, operatività |
| `driver` | Lettura turni e servizi assegnati |
| `viewer` | Sola lettura |

---

## 5. Sicurezza

### 5.1 Autenticazione

- Login con email/password → bcrypt (cost factor 10)
- Sessioni server-side (express-session + PostgreSQL store)
- CSRF: SameSite=strict in produzione
- Session fixation protection: rigenerazione sessione al login

### 5.2 Comunicazioni

- HTTPS/TLS su tutte le comunicazioni (Cloudflare + Railway)
- HSTS abilitato via Cloudflare
- CORS configurato per domini autorizzati

### 5.3 Dati sensibili

- Password hashate bcrypt — mai in chiaro nei log
- Credenziali SMTP cifrate con AES-256-CBC nel DB
- Nomi pazienti: auto-cancellati 24h dopo import (GDPR) via job schedulato
- Nessun dato sensibile (CF, carte, password) nei log applicativi

### 5.4 Integrità dati

- Hash chain HMAC-SHA256 su ogni viaggio (rilevamento manomissioni)
- Audit log tracciato per operazioni critiche

### 5.5 Rate limiting

- Login: 10 req/15min per IP
- API globale: 100 req/min per IP
- Hub pubblico: 30 req/min per IP

---

## 6. Database

### 6.1 Statistiche schema

- **148 tabelle** definite in `shared/schema.ts`
- ORM: Drizzle ORM (type-safe, zero-runtime overhead)
- Migration: `npm run db:push` (Drizzle Kit)
- Tables critiche auto-create al boot del server (CREATE IF NOT EXISTS)

### 6.2 Tabelle principali

```
Operative:        trips, vehicles, staff_members, shifts, locations
Booking:          hub_bookings, hub_clients, hub_service_pricing
Magazzino:        inventory_items, inventory_usage, inventory_expiry_alerts
Finance:          contracts, financial_profiles, fuel_entries
Analytics:        tender_monitors, org_score_cards, saas_metrics, benchmarks
CRM:              crm_organizations, crm_contacts, crm_campaigns, crm_email_templates
Sicurezza:        audit_logs, audit_hash_chain_verifications, gdpr_erasure_requests
Infrastruttura:   user_sessions, monitoring_tokens, api_cache
```

---

## 7. Monitoring e Osservabilità

| Sistema | Funzione |
|---------|---------|
| **Sentry** | Error tracking con stack trace, breadcrumbs, release tracking |
| **PostHog** | Product analytics, session recording, feature flags |
| **UptimeRobot** | Health check HTTP ogni 5 minuti su `/api/health` |
| **Pino** | Logging JSON strutturato con correlation ID (`X-Request-ID`) |

Log format (produzione):
```json
{
  "level": "info",
  "time": 1711540800000,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/trips",
  "status": 201,
  "duration": 45
}
```

---

## 8. Backup e Disaster Recovery

- PostgreSQL backup automatici giornalieri (Railway managed)
- Codice sorgente su GitHub (versioning completo, branch protection su `main`)
- Nessun dato critico stored solo in-memory
- RTO target: < 30 minuti (Railway restart automatico)

---

## 9. Conformità

### 9.1 GDPR

- Dati personali pazienti accessibili solo all'organizzazione proprietaria
- Auto-cancellazione nomi pazienti 24h dopo import
- Endpoint export e cancellazione dati su richiesta (`/api/gdpr/export`, `/api/gdpr/erase`)
- Agreements DPA tracciati in `data_processing_agreements`
- Log di accesso in `audit_log_entries`

### 9.2 Standard di riferimento

| Standard | Applicazione |
|----------|-------------|
| OWASP Top 10 | Sicurezza applicativa |
| ISO/IEC 25010 | Qualità software |
| Linee guida AgID | Servizi digitali PA |
| ANAC OpenData OCDS | Import gare d'appalto sanitarie |
| D.Lgs. 196/2003 + GDPR | Privacy e dati personali |

### 9.3 Audit pre-lancio (2026-03-27)

- 48/55 controlli PASS, 0 FAIL critici
- Isolamento dati multi-tenant verificato
- Auth ibrida funzionante
- Hash chain HMAC-SHA256 per integrità viaggi confermata

---

## 10. Ambienti

| Ambiente | URL | Branch | Note |
|---------|-----|--------|------|
| **Produzione** | `soccorso-digitale-production.up.railway.app` | `main` | Auto-deploy su push |
| **Staging** | TBD (Railway branch deploy) | `staging` | Vedere `docs/STAGING_SETUP.md` |
| **Development** | `localhost:5000` | qualsiasi | `npm run dev` |
