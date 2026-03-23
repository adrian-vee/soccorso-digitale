# Soccorso Digitale — Piano di Rafforzamento per Produzione/Vendita

> Questo documento contiene tutte le istruzioni per portare il progetto a standard enterprise-ready.
> Ogni sezione è un task autonomo, ordinato per priorità.
> **Segui l'ordine: P0 → P1 → P2.**

---

## FASE 1 — P0: FIX CRITICI (Settimana 1)

### 1.1 Fix Error Handler (server/index.ts)

**File:** `server/index.ts` righe 398-413

**Problema:** L'error handler re-throws l'errore dopo aver inviato la risposta. Questo causa crash del server.

```typescript
// ❌ CODICE ATTUALE (ROTTO)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = err as { status?: number; statusCode?: number; message?: string };
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;  // ← RIMUOVERE: crash dopo response
});
```

**Azione:**
1. Rimuovere il `throw err` alla riga 411
2. Aggiungere logging strutturato dell'errore
3. Non esporre stack trace in produzione
4. Aggiungere request ID per tracciabilità

```typescript
// ✅ CODICE CORRETTO
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const error = err as { status?: number; statusCode?: number; message?: string; stack?: string };
  const status = error.status || error.statusCode || 500;
  const message = process.env.NODE_ENV === "production"
    ? (status < 500 ? error.message || "Bad Request" : "Internal Server Error")
    : error.message || "Internal Server Error";

  // Log strutturato
  console.error(JSON.stringify({
    level: "error",
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    message: error.message,
    stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
  }));

  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
});
```

---

### 1.2 Rimuovere Secret Hardcoded (server/index.ts)

**File:** `server/index.ts` riga 81

**Problema:** `SESSION_SECRET` ha un fallback hardcoded: `"soccorso-digitale-secret-key-2024"`. Chiunque legge il codice può impersonare sessioni.

**Azione:**
1. Rimuovere il fallback
2. Crash all'avvio se `SESSION_SECRET` non è definita
3. Creare un file di validazione environment

```typescript
// ✅ In server/index.ts — sostituire la riga del session secret
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("FATAL: SESSION_SECRET environment variable is required");
}
```

---

### 1.3 Creare Validazione Environment Variables

**File da creare:** `server/env.ts`

**Azione:** Creare un modulo che valida TUTTE le variabili d'ambiente richieste all'avvio del server. Importarlo come prima cosa in `server/index.ts`.

```typescript
// server/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),

  // Opzionali con default
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TRIP_INTEGRITY_SECRET: z.string().optional(),
  GCS_BUCKET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

---

### 1.4 Creare .env.example

**File da creare:** `.env.example`

```env
# === REQUIRED ===
DATABASE_URL=postgresql://user:password@host:5432/soccorso_digitale
SESSION_SECRET=generate-a-random-string-at-least-32-characters-long

# === OPTIONAL (needed for full functionality) ===
NODE_ENV=development
PORT=5000

# Google Maps (geocoding, routing)
GOOGLE_MAPS_API_KEY=

# Email (Resend)
RESEND_API_KEY=

# Payments (Stripe)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Trip integrity signing
TRIP_INTEGRITY_SECRET=

# File storage (Google Cloud Storage)
GCS_BUCKET=
GCS_PROJECT_ID=
GCS_CLIENT_EMAIL=
GCS_PRIVATE_KEY=

# Replit (only needed in Replit environment)
REPLIT_DEV_DOMAIN=
REPLIT_DOMAINS=
```

---

### 1.5 Setup CI/CD — GitHub Actions

**File da creare:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check:types
      - run: npm run lint
      - run: npm run check:format

  test:
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: soccorso_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/soccorso_test
      SESSION_SECRET: test-secret-at-least-32-characters-long-for-ci
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run db:push
      - run: npm test

  build:
    runs-on: ubuntu-latest
    needs: [quality, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run server:build
```

---

### 1.6 Aggiungere .env al .gitignore

**File:** `.gitignore`

**Azione:** Verificare che `.env` sia nel .gitignore. Aggiungere anche:
```
.env
.env.local
.env.production
backup.sql
backup-inserts.sql
```

⚠️ **IMPORTANTE:** I file `backup.sql` e `backup-inserts.sql` NON devono essere nel repository. Contengono dati sensibili. Rimuoverli dalla git history con:
```bash
git rm --cached backup.sql backup-inserts.sql 2>/dev/null || true
```

---

## FASE 2 — P1: TESTING E DOCUMENTAZIONE (Settimana 2)

### 2.1 Setup Testing Framework

**Azione:** Installare e configurare Vitest + Supertest per testing backend.

```bash
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
```

**File da creare:** `vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["server/**/*.ts", "shared/**/*.ts"],
      exclude: ["**/*.test.ts", "server/seed.ts"],
    },
    setupFiles: ["./server/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

**File da creare:** `server/test/setup.ts`
```typescript
import { beforeAll, afterAll } from "vitest";
// Setup test database connection, cleanup, etc.

beforeAll(async () => {
  // Ensure test DB is clean
  process.env.NODE_ENV = "test";
});

afterAll(async () => {
  // Close DB connections
});
```

**Aggiungere a `package.json` scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

### 2.2 Scrivere Test Critici

Creare test per le funzionalità core. Priorità: auth → trips → vehicles → billing.

**File da creare:** `server/test/auth.test.ts`
- Test login con credenziali valide → 200 + session cookie
- Test login con credenziali invalide → 401
- Test accesso a route protetta senza sessione → 401
- Test accesso a route protetta con sessione → 200
- Test logout → session invalidata
- Test role-based access (crew vs admin vs director)

**File da creare:** `server/test/trips.test.ts`
- Test creazione viaggio con dati validi → 201
- Test creazione viaggio con dati mancanti → 400
- Test lista viaggi per organizzazione → isolamento multi-tenant
- Test modifica viaggio → 200
- Test eliminazione viaggio → 200
- Test firma crittografica viaggio (HMAC-SHA256) → integrità verificata
- Test che un'organizzazione NON vede i viaggi di un'altra

**File da creare:** `server/test/vehicles.test.ts`
- Test CRUD veicoli
- Test checklist veicolo
- Test inventario veicolo
- Test isolamento multi-tenant

**File da creare:** `server/test/billing.test.ts`
- Test calcolo costi viaggio
- Test webhook Stripe (mock)
- Test deduct credits

**File da creare:** `server/test/validation.test.ts`
- Test tutti gli schema Zod/Drizzle con input invalidi
- Test che errori di validazione restituiscono 400 con messaggio chiaro

**OBIETTIVO MINIMO:** 80% coverage sulle route critiche (auth, trips, billing).

---

### 2.3 Generare Documentazione API (OpenAPI/Swagger)

**Azione:** Creare spec OpenAPI 3.0 per tutti gli endpoint principali.

```bash
npm install swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express
```

**File da creare:** `server/swagger.ts`
```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Soccorso Digitale API",
      version: "2.0.0",
      description: "API per la gestione dei servizi di trasporto sanitario",
      contact: {
        name: "Soccorso Digitale Support",
        email: "support@soccorsodigitale.it",
      },
    },
    servers: [
      { url: "/api", description: "API Server" },
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
        },
      },
    },
    security: [{ sessionAuth: [] }],
  },
  apis: ["./server/routes/*.ts"], // Dopo il refactor dei moduli
};

export function setupSwagger(app: Express) {
  const spec = swaggerJsdoc(options);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Soccorso Digitale API Docs",
  }));
  // Endpoint per scaricare la spec JSON
  app.get("/api-docs.json", (_req, res) => res.json(spec));
}
```

**Azione:** Aggiungere commenti JSDoc/OpenAPI ai route handler. Esempio:

```typescript
/**
 * @openapi
 * /trips:
 *   get:
 *     summary: Lista viaggi per organizzazione
 *     tags: [Trips]
 *     parameters:
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: integer
 *         description: Filtra per sede
 *     responses:
 *       200:
 *         description: Lista viaggi
 *       401:
 *         description: Non autenticato
 */
```

---

### 2.4 Implementare Logging Strutturato

**Azione:** Sostituire `console.log` con un logger strutturato.

```bash
npm install pino pino-pretty
npm install -D @types/pino
```

**File da creare:** `server/logger.ts`
```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  // In produzione: output JSON per aggregazione log
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: { "user-agent": req.headers["user-agent"] },
    }),
    err: pino.stdSerializers.err,
  },
});

export const createRequestLogger = () => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    res.on("finish", () => {
      logger.info({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
        userId: req.session?.userId,
        organizationId: req.session?.organizationId,
      }, `${req.method} ${req.path} ${res.statusCode}`);
    });

    next();
  };
};
```

**Azione:** Sostituire TUTTI i `console.log` e `console.error` in `server/` con `logger.info()`, `logger.error()`, ecc.

---

### 2.5 Aggiungere Rate Limiting

```bash
npm install express-rate-limit
npm install -D @types/express-rate-limit
```

**File da creare:** `server/rate-limit.ts`
```typescript
import rateLimit from "express-rate-limit";

// Rate limit globale
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 1000, // max 1000 richieste per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Troppe richieste, riprova più tardi" },
});

// Rate limit per login (anti brute-force)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // max 10 tentativi login per IP
  message: { error: "Troppi tentativi di accesso, riprova tra 15 minuti" },
});

// Rate limit per API pubbliche
export const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Rate limit superato" },
});
```

**Azione:** Applicare in `server/index.ts`:
```typescript
app.use(globalLimiter);
app.post("/api/login", loginLimiter, loginHandler);
app.use("/api/hub", publicApiLimiter);
```

---

### 2.6 Aggiungere Helmet (Security Headers)

```bash
npm install helmet
```

**Azione:** In `server/index.ts`, aggiungere prima di tutte le altre middleware:
```typescript
import helmet from "helmet";
app.use(helmet());
```

---

### 2.7 Fix Validazione Input (safeParse)

**Problema:** Le route usano `.parse()` che lancia eccezioni non gestite.

**Azione:** Sostituire TUTTE le occorrenze di `.parse(req.body)` con `.safeParse()`:

```typescript
// ❌ PRIMA
const data = insertTripSchema.parse(req.body);

// ✅ DOPO
const result = insertTripSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({
    error: "Dati non validi",
    details: result.error.flatten().fieldErrors,
  });
}
const data = result.data;
```

Cerca tutte le occorrenze con: `grep -n "\.parse(req\." server/routes.ts`

---

### 2.8 Aumentare Connection Pool

**File:** `server/db.ts` riga 17

```typescript
// ❌ PRIMA
max: 3

// ✅ DOPO
max: process.env.NODE_ENV === "production" ? 20 : 5
```

---

## FASE 3 — P1: REFACTORING (Settimana 2-3)

### 3.1 Spezzare routes.ts in Moduli

**Problema critico:** `server/routes.ts` è un singolo file di 33.188 righe. Questo è ingestibile, non testabile, e fa impressione negativa in una due diligence tecnica.

**Azione:** Creare una cartella `server/routes/` e dividere per dominio:

```
server/routes/
  index.ts          # Registra tutti i router
  auth.ts           # Login, logout, register, session (~500 righe)
  users.ts          # CRUD utenti, profilo, password (~800 righe)
  trips.ts          # CRUD viaggi, GPS, integrity (~3000 righe)
  vehicles.ts       # CRUD veicoli, checklist, documenti (~2500 righe)
  shifts.ts         # Turni, assegnazioni, swap (~2000 righe)
  staff.ts          # Personale, disponibilità, wellness (~2000 righe)
  inventory.ts      # Inventario, scansione, ripristino (~1500 righe)
  billing.ts        # Stripe, pagamenti, abbonamenti (~1000 righe)
  admin.ts          # Endpoint admin, gestione org (~3000 righe)
  hub.ts            # Hub pubblico, prenotazioni (~1500 righe)
  reports.ts        # PDF, export, analytics (~2000 righe)
  sla.ts            # SLA, monitoring, health (~800 righe)
  compliance.ts     # GDPR, audit, volontari (~1500 righe)
  finance.ts        # Costi, ricavi, contratti (~1500 righe)
  esg.ts            # Sostenibilità, impatto (~500 righe)
```

**Pattern per ogni modulo:**
```typescript
// server/routes/trips.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../auth-middleware";
import { db } from "../db";
// ... imports

const router = Router();

router.get("/trips", requireAuth, async (req, res) => {
  // ... handler
});

export default router;
```

**File index:** `server/routes/index.ts`
```typescript
import { Express } from "express";
import authRoutes from "./auth";
import tripRoutes from "./trips";
import vehicleRoutes from "./vehicles";
// ... etc

export function registerRoutes(app: Express) {
  app.use("/api", authRoutes);
  app.use("/api", tripRoutes);
  app.use("/api", vehicleRoutes);
  // ... etc
}
```

**STRATEGIA:** Non riscrivere la logica. Taglia e incolla le route da `routes.ts` nei moduli corrispondenti. Verifica che i test passino dopo ogni modulo spostato.

---

## FASE 4 — P2: POLISH (Settimana 3)

### 4.1 Aggiornare README.md

Aggiungere le seguenti sezioni al README:

1. **Architettura** — Diagramma (testo) dell'architettura: Client ↔ API ↔ DB ↔ Services
2. **Deployment** — Istruzioni passo-passo per Railway e Vercel
3. **API Reference** — Link a `/api-docs` (Swagger)
4. **Testing** — Come eseguire i test, coverage minima richiesta
5. **Troubleshooting** — Problemi comuni e soluzioni
6. **Security** — Come gestire secrets, rotation, backup
7. **Scaling** — Connection pooling, caching, read replicas

---

### 4.2 Creare CHANGELOG.md

```markdown
# Changelog

## [2.0.0] - 2026-03-22
### Added
- Multi-tenant architecture with full data isolation
- 140 PostgreSQL tables via Drizzle ORM
- 655 REST API endpoints
- React Native mobile app with 44 screens
- Cryptographic trip signing (HMAC-SHA256)
- GDPR compliance module
- Real-time GPS tracking via WebSocket
- PDF generation (10+ templates including UTIF)
- Stripe integration (subscriptions + one-time)
- SLA monitoring and breach detection
- ESG/sustainability tracking
- Health monitoring with email alerts
- Volunteer registry (Art. 17 CTS compliant)
- Admin web dashboard

### Security
- Role-based access control (5+ roles)
- Session-based authentication
- Audit trail with hash chain verification
- GDPR data export and erasure workflows

## [1.0.0] - 2026-03-21
### Added
- Initial release
```

---

### 4.3 Creare SECURITY.md

```markdown
# Security Policy

## Reporting Vulnerabilities
Email: security@soccorsodigitale.it

## Supported Versions
| Version | Supported |
|---------|-----------|
| 2.x     | ✅        |
| 1.x     | ❌        |

## Security Measures
- All data isolated by organizationId (multi-tenant)
- HMAC-SHA256 cryptographic trip signing
- Session-based auth with secure cookies
- GDPR compliance with data export/erasure
- Audit trail with hash chain verification
- Rate limiting on all endpoints
- Input validation via Zod schemas
```

---

### 4.4 Creare LICENSE

Scegliere la licenza appropriata. Per un prodotto commerciale:

```
# PROPRIETARY LICENSE

Copyright (c) 2026 [Nome Azienda]. All rights reserved.

This software and its source code are proprietary and confidential.
Unauthorized copying, distribution, or use is strictly prohibited.
```

---

### 4.5 Creare Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run server:build
RUN npm run check:types

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/index.js"]
```

---

### 4.6 Aggiungere Compression Middleware

```bash
npm install compression
npm install -D @types/compression
```

```typescript
import compression from "compression";
app.use(compression());
```

---

### 4.7 Pre-commit Hooks

```bash
npm install -D husky lint-staged
npx husky init
```

**File:** `.husky/pre-commit`
```bash
npx lint-staged
```

**Aggiungere a `package.json`:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

## CHECKLIST FINALE PRIMA DI VENDERE

- [ ] Error handler fixato (no re-throw)
- [ ] Nessun secret hardcoded nel codice
- [ ] `.env.example` completo
- [ ] Validazione env vars all'avvio
- [ ] GitHub Actions CI/CD funzionante
- [ ] Test suite con >80% coverage su route critiche
- [ ] Documentazione API Swagger accessibile a `/api-docs`
- [ ] Logger strutturato (Pino) al posto di console.log
- [ ] Rate limiting su tutti gli endpoint
- [ ] Helmet per security headers
- [ ] Validazione input con safeParse (no throw)
- [ ] Connection pool adeguato (20+ in prod)
- [ ] `routes.ts` spezzato in moduli
- [ ] README completo con deploy, API, troubleshooting
- [ ] CHANGELOG.md aggiornato
- [ ] SECURITY.md presente
- [ ] LICENSE appropriata
- [ ] Dockerfile funzionante
- [ ] Compression middleware attivo
- [ ] Pre-commit hooks configurati
- [ ] Backup SQL rimossi dal repo
- [ ] `.gitignore` aggiornato
- [ ] Git history pulita con commit significativi
