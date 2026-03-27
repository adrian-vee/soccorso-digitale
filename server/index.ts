import "./env"; // Validate environment variables at startup
import express from "express";
import bcrypt from "bcrypt";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
// @ts-ignore
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { registerRoutes } from "./routes/index";
import { seedDatabase } from "./seed";
import { pool } from "./db";
import { logger } from "./logger";
import { setupSwagger } from "./swagger";
import { globalLimiter, loginLimiter, publicApiLimiter, authSensitiveLimiter, publicFormLimiter } from "./rate-limit";
import { apiVersionRewrite, apiVersionHeaders } from "./middleware/api-version";
import { stagingBanner } from "./middleware/staging-banner";
import * as fs from "fs";
import * as path from "path";
import { UPLOADS_DIR } from "./uploads-dir";

const app = express();
const log = (...args: unknown[]) => logger.info(args.map(String).join(" "));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    // Allow production domain
    origins.add("https://soccorsodigitale.app");
    origins.add("https://www.soccorsodigitale.app");

    // Allow local development origins for Expo web
    origins.add("http://localhost:8081");
    origins.add("http://127.0.0.1:8081");
    origins.add("http://0.0.0.0:8081");

    // Allow extra origins from env (comma-separated)
    if (process.env.CORS_ORIGINS) {
      process.env.CORS_ORIGINS.split(",").forEach((d) => origins.add(d.trim()));
    }

    const origin = req.header("origin");

    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use((req, res, next) => {
    if (req.path === '/api/admin/upload-apk-chunk') {
      return next();
    }
    express.json({
      limit: "15mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.path === '/api/admin/upload-apk-chunk') {
      return next();
    }
    express.urlencoded({ extended: false })(req, res, next);
  });
}

function setupSession(app: express.Application) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("FATAL: SESSION_SECRET environment variable is required");
  }
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DOMAINS;
  
  app.set("trust proxy", 1);

  const PgSession = connectPgSimple(session);
  
  const sessionMiddleware = session({
    store: new PgSession({
      pool: pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 300,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "croce.sid",
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "strict" : "lax",
      path: "/",
    },
  });

  app.use(sessionMiddleware);
}

function setupRequestLogging(app: express.Application) {
  const isProduction = process.env.NODE_ENV === "production";

  app.use((req: Request, res, next) => {
    // Correlation ID: use X-Request-ID from client or generate a new one
    const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
    (req as any).requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    const start = Date.now();
    const reqPath = req.path;

    if (isProduction) {
      res.on("finish", () => {
        if (!reqPath.startsWith("/api")) return;
        const duration = Date.now() - start;
        logger.info({ requestId, method: req.method, path: reqPath, status: res.statusCode, duration }, `${req.method} ${reqPath} ${res.statusCode}`);
      });
    } else {
      let capturedJsonResponse: Record<string, unknown> | undefined = undefined;
      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        if (!reqPath.startsWith("/api")) return;
        const duration = Date.now() - start;
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }
        log(logLine);
      });
    }

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function serveImpattoPage(res: Response) {
  const impattoPath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "impatto.html",
  );
  
  if (!fs.existsSync(impattoPath)) {
    return res.status(404).send("Pagina non trovata");
  }
  
  const html = fs.readFileSync(impattoPath, "utf-8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(html);
}

function servePartnerProposalPage(res: Response) {
  const partnerPath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "partner-proposal.html",
  );
  
  if (!fs.existsSync(partnerPath)) {
    return res.status(404).send("Pagina non trovata");
  }
  
  const html = fs.readFileSync(partnerPath, "utf-8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(html);
}

function servePartnerAssicurazioniPage(res: Response) {
  const partnerPath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "partner-assicurazioni.html",
  );
  
  if (!fs.existsSync(partnerPath)) {
    return res.status(404).send("Pagina non trovata");
  }
  
  const html = fs.readFileSync(partnerPath, "utf-8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(html);
}

function serveConfidentialityPage(res: Response) {
  const confPath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "impegno-riservatezza.html",
  );
  
  if (!fs.existsSync(confPath)) {
    return res.status(404).send("Pagina non trovata");
  }
  
  const html = fs.readFileSync(confPath, "utf-8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(html);
}

function serveSaasLandingPage(res: Response) {
  const saasPath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "saas-landing.html",
  );
  
  if (!fs.existsSync(saasPath)) {
    return res.status(404).send("Pagina non trovata");
  }
  
  const html = fs.readFileSync(saasPath, "utf-8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const qrTemplatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const qrPageTemplate = fs.readFileSync(qrTemplatePath, "utf-8");

  const saasLandingPath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "saas-landing-v2.html",
  );
  const saasLandingTemplate = fs.readFileSync(saasLandingPath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  // Public marketing site — Conicorn template served at root
  const sitePath = path.resolve(process.cwd(), "site");
  const conicornPath = path.resolve(process.cwd(), "conicorn");
  if (fs.existsSync(conicornPath)) {
    const adminPath0 = path.resolve(process.cwd(), "admin", "public");
    // Serve Conicorn assets at root-level paths (template uses relative paths → /css, /js, etc.)
    app.use("/css",    express.static(path.join(conicornPath, "css"),    { etag: false, maxAge: 0 }));
    app.use("/js",     express.static(path.join(conicornPath, "js"),     { etag: false, maxAge: 0 }));
    app.use("/fonts",  express.static(path.join(conicornPath, "fonts"),  { etag: false, maxAge: 0 }));
    app.use("/images", express.static(path.join(conicornPath, "images"), { etag: false, maxAge: 0 }));
    app.use("/media",  express.static(path.join(conicornPath, "media"),  { etag: false, maxAge: 0 }));
    // Legacy /site prefix and /conicorn prefix still available
    if (fs.existsSync(sitePath)) {
      app.use("/site", express.static(sitePath, { etag: false, maxAge: 0 }));
    }
    app.use("/conicorn", express.static(conicornPath, { etag: false, maxAge: 0 }));
    // Serve logo from admin/public at root level
    app.get("/logo.svg", (_req, res) => res.sendFile(path.join(adminPath0, "logo.svg")));
    log("Public site: Conicorn template → /css /js /fonts /images /media served from conicorn/");
  } else if (fs.existsSync(sitePath)) {
    const adminPath0 = path.resolve(process.cwd(), "admin", "public");
    app.use("/site", express.static(sitePath, { etag: false, maxAge: 0 }));
    app.use("/css",    express.static(path.join(sitePath, "css"),    { etag: false, maxAge: 0 }));
    app.use("/js",     express.static(path.join(sitePath, "js"),     { etag: false, maxAge: 0 }));
    app.use("/fonts",  express.static(path.join(sitePath, "fonts"),  { etag: false, maxAge: 0 }));
    app.use("/images", express.static(path.join(sitePath, "images"), { etag: false, maxAge: 0 }));
    app.get("/logo.svg", (_req, res) => res.sendFile(path.join(adminPath0, "logo.svg")));
    log("Public site: legacy site/ folder → /css /js /fonts /images");
  }

  // Serve admin panel with SPA fallback (no cache for development)
  const adminPath = path.resolve(process.cwd(), "admin", "public");
  app.use("/admin", express.static(adminPath, {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
  
  // SPA fallback for admin routes - serve index.html for any /admin/* path
  app.get("/admin/*", (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(adminPath, "index.html"));
  });
  
  // Explicit route for /admin to serve fresh index.html
  app.get("/admin", (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(adminPath, "index.html"));
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path.startsWith("/admin")) {
      return next();
    }
    
    if (req.path === "/demo" || req.path === "/piattaforma" || req.path === "/clienti" || req.path === "/contatti" || req.path === "/impatto" || req.path === "/partner-proposal" || req.path === "/partner-assicurazioni" || req.path === "/platform" || req.path === "/impegno-riservatezza" || req.path === "/inizia" || req.path === "/cancella-trial") {
      return next();
    }

    if (req.path.startsWith("/calendario")) {
      return next();
    }

    if (req.path === "/download") {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      // Serve the Conicorn template homepage
      const conicornIndex = path.resolve(process.cwd(), "conicorn", "index.html");
      if (fs.existsSync(conicornIndex)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.sendFile(conicornIndex);
      }
      // Fallback to site/index.html
      const sitePath = path.resolve(process.cwd(), "site", "index.html");
      if (fs.existsSync(sitePath)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.sendFile(sitePath);
      }
      // Fallback to saas-landing-v2.html template
      const saasPath = path.resolve(process.cwd(), "server", "templates", "saas-landing-v2.html");
      if (fs.existsSync(saasPath)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.sendFile(saasPath);
      }
      return res.redirect(302, "/admin");
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use("/uploads", express.static(UPLOADS_DIR));
  app.use("/downloads", express.static(path.resolve(process.cwd(), "public", "downloads")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      stack?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message =
      process.env.NODE_ENV === "production"
        ? status < 500
          ? error.message || "Bad Request"
          : "Internal Server Error"
        : error.message || "Internal Server Error";

    logger.error({
      method: req.method,
      path: req.path,
      status,
      message: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    }, `Error ${status}: ${error.message}`);

    if (!res.headersSent) {
      res.status(status).json({ error: message });
    }
  });
}

(async () => {
  log("Starting Express server...");

  // Security headers — first middleware
  app.use(helmet({ contentSecurityPolicy: false }));

  // Global rate limiting
  app.use(globalLimiter);

  // API v1 URL rewrite (/api/v1/* → /api/*) and version headers
  app.use(apiVersionRewrite);
  app.use("/api", apiVersionHeaders);

  // Staging environment banner
  app.use(stagingBanner);

  setupCors(app);
  setupBodyParsing(app);
  setupSession(app);
  setupRequestLogging(app);

  // Redirect /login → /admin (permanent)
  app.get("/login", (_req, res) => {
    res.redirect(301, "/admin");
  });

  // Public Social Impact Dashboard - MUST be before all other routes
  // Demo Request Page
  app.get("/demo", (req, res) => {
    log("Serving /demo page");
    const demoPath = path.resolve(process.cwd(), "server", "templates", "demo.html");
    if (!fs.existsSync(demoPath)) {
      return res.status(404).send("Pagina non trovata");
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(fs.readFileSync(demoPath, 'utf-8'));
  });

  app.get("/download/:code", (req, res) => {
    const { code } = req.params;
    const apkMetaPath = path.join(UPLOADS_DIR, "apk", "meta.json");
    let validCode = "SD2026APP";
    if (fs.existsSync(apkMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(apkMetaPath, "utf-8"));
        if (meta.accessCode) validCode = meta.accessCode;
      } catch {}
    }
    if (code !== validCode) {
      return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Pagina non disponibile</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#64748b;text-align:center;padding:20px;}div{max-width:400px;}h1{color:#1a1a1a;font-size:24px;}p{font-size:15px;line-height:1.6;}</style></head><body><div><h1>Pagina non disponibile</h1><p>Il link che hai utilizzato non e valido o e scaduto. Contatta il tuo coordinatore per ricevere il link corretto.</p></div></body></html>`);
    }
    const downloadPath = path.resolve(process.cwd(), "admin", "public", "download.html");
    if (!fs.existsSync(downloadPath)) {
      return res.status(404).send("Pagina non trovata");
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(fs.readFileSync(downloadPath, 'utf-8'));
  });

  app.get("/download", (_req, res) => {
    const downloadPath = path.resolve(process.cwd(), "admin", "public", "download.html");
    if (!fs.existsSync(downloadPath)) {
      return res.status(404).send("Pagina non trovata");
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(fs.readFileSync(downloadPath, 'utf-8'));
  });

  app.get("/impatto", (req, res) => {
    log("Serving /impatto page");
    serveImpattoPage(res);
  });

  // Partner Proposal Page
  app.get("/partner-proposal", (req, res) => {
    log("Serving /partner-proposal page");
    servePartnerProposalPage(res);
  });

  // Partner Assicurazioni Page (Insurance Agencies Landing)
  app.get("/partner-assicurazioni", (req, res) => {
    log("Serving /partner-assicurazioni page");
    servePartnerAssicurazioniPage(res);
  });

  // SaaS Landing Page for selling the platform
  app.get("/platform", (req, res) => {
    log("Serving /platform SaaS landing page");
    serveSaasLandingPage(res);
  });

  // Hub directory blocked — nessun listing pubblico delle org
  app.get("/hub", (_req, res) => {
    res.status(404).send("Pagina non trovata");
  });

  // Booking Hub Portal - public pages for each organization
  app.get("/hub/:slug", (req, res) => {
    log(`Serving /hub/${req.params.slug} booking portal`);
    const hubPath = path.resolve(process.cwd(), "server", "templates", "hub.html");
    if (!fs.existsSync(hubPath)) {
      return res.status(404).send("Pagina non trovata");
    }
    let html = fs.readFileSync(hubPath, "utf-8");
    const gmKey = process.env.GOOGLE_MAPS_API_KEY || '';
    html = html.replace('</head>', `<script>window.GOOGLE_MAPS_KEY="${gmKey}";</script></head>`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(html);
  });

  // Public Confidentiality Agreement Page
  app.get("/impegno-riservatezza", (req, res) => {
    log("Serving /impegno-riservatezza page");
    serveConfidentialityPage(res);
  });

  configureExpoAndLanding(app);

  // Rate limiting for auth and public API endpoints
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/register", authSensitiveLimiter);
  app.use("/api/auth/reset-password", authSensitiveLimiter);
  app.use("/api/auth/refresh", authSensitiveLimiter);
  app.use("/api/hub", publicApiLimiter);
  app.use("/api/public/start-trial", publicFormLimiter);
  app.use("/api/public/demo-request", publicFormLimiter);
  app.use("/api/public/contact", publicFormLimiter);
  // v1 paths inherit the rewrite above — these are kept for clarity
  app.use("/api/v1/auth/login", loginLimiter);
  app.use("/api/v1/hub", publicApiLimiter);

  // API Documentation
  setupSwagger(app);

  let server;
  try {
    server = await registerRoutes(app);
    log("Routes registered successfully");
  } catch (error) {
    logger.error({ err: error }, "Error registering routes");
    // Create server even if routes fail
    server = require("http").createServer(app);
  }

  // Auto-migrate location columns if needed
  try {
    await pool.query(`
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude TEXT;
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude TEXT;
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;
    `);
  } catch (e) {
    // ignore if pool not available
  }

  // Auto-create analytics tables (tender_monitors, scorecards, forecasts, etc.)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tender_monitors (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        source_url TEXT,
        cpv_code TEXT,
        cig_code TEXT,
        statione_name TEXT,
        estimated_value REAL,
        deadline TIMESTAMP,
        publication_date TIMESTAMP,
        region TEXT,
        province TEXT,
        service_type TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        required_vehicles INTEGER,
        required_personnel INTEGER,
        duration_months INTEGER,
        notes TEXT,
        priority TEXT DEFAULT 'medium',
        assigned_to VARCHAR,
        is_auto_detected BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tender_simulations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR,
        tender_id VARCHAR,
        name TEXT NOT NULL,
        vehicles_count INTEGER NOT NULL DEFAULT 1,
        personnel_count INTEGER NOT NULL DEFAULT 2,
        hours_per_day REAL NOT NULL DEFAULT 12,
        days_per_month INTEGER NOT NULL DEFAULT 30,
        duration_months INTEGER NOT NULL DEFAULT 12,
        fuel_cost_monthly REAL,
        personnel_cost_monthly REAL,
        vehicle_cost_monthly REAL,
        insurance_cost_monthly REAL,
        maintenance_cost_monthly REAL,
        overhead_cost_monthly REAL,
        total_cost_monthly REAL,
        margin_percent REAL DEFAULT 15,
        proposed_monthly_price REAL,
        proposed_total_price REAL,
        price_per_hour REAL,
        price_per_km REAL,
        market_avg_price REAL,
        competitiveness_score REAL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS org_score_cards (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR NOT NULL,
        total_trips_last_12m INTEGER DEFAULT 0,
        avg_response_time_min REAL,
        fleet_size INTEGER DEFAULT 0,
        active_personnel INTEGER DEFAULT 0,
        coverage_area_km2 REAL,
        total_km_last_12m REAL,
        operational_score REAL DEFAULT 0,
        compliance_score REAL DEFAULT 0,
        sustainability_score REAL DEFAULT 0,
        financial_score REAL DEFAULT 0,
        overall_score REAL DEFAULT 0,
        has_iso_9001 BOOLEAN DEFAULT FALSE,
        has_iso_45001 BOOLEAN DEFAULT FALSE,
        has_iso_14001 BOOLEAN DEFAULT FALSE,
        last_calculated_at TIMESTAMP,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS saas_metrics (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_date DATE NOT NULL,
        mrr REAL DEFAULT 0,
        arr REAL DEFAULT 0,
        new_mrr REAL DEFAULT 0,
        churned_mrr REAL DEFAULT 0,
        expansion_mrr REAL DEFAULT 0,
        total_orgs INTEGER DEFAULT 0,
        active_orgs INTEGER DEFAULT 0,
        trial_orgs INTEGER DEFAULT 0,
        churned_orgs INTEGER DEFAULT 0,
        new_orgs_this_month INTEGER DEFAULT 0,
        total_trips_all_orgs INTEGER DEFAULT 0,
        total_users_all_orgs INTEGER DEFAULT 0,
        total_vehicles_all_orgs INTEGER DEFAULT 0,
        avg_trips_per_org REAL,
        avg_health_score REAL,
        at_risk_orgs INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS org_health_scores (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR NOT NULL,
        login_frequency REAL DEFAULT 0,
        trips_per_week REAL DEFAULT 0,
        feature_adoption REAL DEFAULT 0,
        data_completeness REAL DEFAULT 0,
        last_active_at TIMESTAMP,
        days_since_last_login INTEGER,
        support_tickets INTEGER DEFAULT 0,
        health_score REAL DEFAULT 0,
        risk_level TEXT DEFAULT 'healthy',
        trend TEXT DEFAULT 'stable',
        recommended_action TEXT,
        last_calculated_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS revenue_forecasts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR,
        forecast_month DATE NOT NULL,
        projected_revenue REAL,
        projected_costs REAL,
        projected_profit REAL,
        projected_trips INTEGER,
        projected_km REAL,
        confidence_level REAL,
        forecast_model TEXT DEFAULT 'linear',
        actual_revenue REAL,
        actual_costs REAL,
        actual_profit REAL,
        actual_trips INTEGER,
        revenue_variance REAL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS predictive_alerts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        predicted_date TIMESTAMP,
        confidence REAL,
        related_entity_type TEXT,
        related_entity_id VARCHAR,
        suggested_action TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        resolved_at TIMESTAMP,
        resolved_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS benchmarks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_date DATE NOT NULL,
        metric_type TEXT NOT NULL,
        avg_value REAL,
        median_value REAL,
        p25_value REAL,
        p75_value REAL,
        min_value REAL,
        max_value REAL,
        sample_size INTEGER,
        region TEXT,
        org_size_category TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    log("Analytics tables ensured (CREATE IF NOT EXISTS)");
  } catch (e: any) {
    logger.warn({ err: e }, "Could not ensure analytics tables");
  }

  // Force-set super admin password to known bcrypt hash on every startup
  // Hash of "SoccorsoDigitale2026!" — pre-computed to avoid bcrypt on hot path
  try {
    const SUPER_ADMIN_HASH = "$2b$12$J07aLS/xMV3QTFgbVgPSwujpEfMxquZ86FaABVLVDsKrKt8w9rNAq";
    const result = await pool.query(
      `UPDATE users SET password = $1, is_active = true
       WHERE email = 'superadmin@soccorsodigitale.app' AND (password != $1 OR is_active = false)
       RETURNING id, email`,
      [SUPER_ADMIN_HASH]
    );
    if (result.rows.length > 0) {
      log(`Super admin password/status fixed on startup for ${result.rows[0].email}`);
    }
  } catch (e) {
    logger.warn({ err: e }, "Could not fix super admin password on startup");
  }

  if (process.env.NODE_ENV !== "production") {
    seedDatabase().catch((error) => {
      logger.error({ err: error }, "Error seeding database");
    });
  } else {
    log("Production mode: skipping database seeding (data already exists)");
    if (typeof global.gc === 'function') {
      setInterval(() => { global.gc!(); }, 30000);
      log("Production mode: periodic GC enabled (every 30s)");
    }
  }

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
