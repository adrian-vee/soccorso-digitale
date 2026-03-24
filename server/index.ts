import "./env"; // Validate environment variables at startup
import express from "express";
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
import { globalLimiter, loginLimiter, publicApiLimiter } from "./rate-limit";
import * as fs from "fs";
import * as path from "path";

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

    // Allow local development origins for Expo web
    origins.add("http://localhost:8081");
    origins.add("http://127.0.0.1:8081");
    origins.add("http://0.0.0.0:8081");

    const origin = req.header("origin");

    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
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
  
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;

    if (isProduction) {
      res.on("finish", () => {
        if (!reqPath.startsWith("/api")) return;
        const duration = Date.now() - start;
        log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
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

  // Public marketing site — explicit routes + /site/* static assets
  const sitePath = path.resolve(process.cwd(), "site");
  if (fs.existsSync(sitePath)) {
    const adminPath0 = path.resolve(process.cwd(), "admin", "public");
    // Serve site CSS/JS/images under /site/ prefix (legacy)
    app.use("/site", express.static(sitePath, { etag: false, maxAge: 0 }));
    // Serve site assets at root-level paths (mdx.so clone uses relative paths resolving to /)
    app.use("/css",    express.static(path.join(sitePath, "css"),    { etag: false, maxAge: 0 }));
    app.use("/js",     express.static(path.join(sitePath, "js"),     { etag: false, maxAge: 0 }));
    app.use("/fonts",  express.static(path.join(sitePath, "fonts"),  { etag: false, maxAge: 0 }));
    app.use("/images", express.static(path.join(sitePath, "images"), { etag: false, maxAge: 0 }));
    // Serve logo from admin/public at root level (HTML files reference /logo.svg)
    app.get("/logo.svg", (_req, res) => res.sendFile(path.join(adminPath0, "logo.svg")));
    // Explicit page routes — must be before /admin handlers
    app.get("/piattaforma", (_req, res) => res.sendFile(path.join(sitePath, "piattaforma.html")));
    app.get("/clienti",     (_req, res) => res.sendFile(path.join(sitePath, "clienti.html")));
    app.get("/contatti",    (_req, res) => res.sendFile(path.join(sitePath, "contatti.html")));
    // Test route — mdx.so clone (same as / but explicit for QA)
    app.get("/new", (_req, res) => res.sendFile(path.join(sitePath, "index.html")));
    // mdx.so page routes — redirect to home (these are mdx.so internal pages)
    app.get("/projects",  (_req, res) => res.redirect("/"));
    app.get("/services",  (_req, res) => res.redirect("/"));
    app.get("/contact",   (_req, res) => res.redirect("/"));
    app.get("/about-us",  (_req, res) => res.redirect("/"));
    app.get("/about",     (_req, res) => res.redirect("/"));
    log("Public site: /piattaforma /clienti /contatti + /css /js /fonts /images /new assets");
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

  // Serve React dashboard (Next.js static export) at /dashboard
  const dashboardPath = path.resolve(process.cwd(), "dashboard-static");
  if (fs.existsSync(dashboardPath)) {
    app.use("/dashboard", express.static(dashboardPath, { maxAge: "1h" }));
    // Per-route HTML files exist (trailingSlash: true), but add fallback for direct nav
    app.get("/dashboard", (_req, res) => res.sendFile(path.join(dashboardPath, "index.html")));
    app.get("/dashboard/*", (req, res) => {
      // Try the pre-rendered HTML for the route, fall back to index
      const routeFile = path.join(dashboardPath, req.path.replace("/dashboard", ""), "index.html");
      if (fs.existsSync(routeFile)) {
        res.sendFile(routeFile);
      } else {
        res.sendFile(path.join(dashboardPath, "index.html"));
      }
    });
    log("React dashboard: /dashboard → dashboard-static/");
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path.startsWith("/admin")) {
      return next();
    }
    
    if (req.path === "/demo" || req.path === "/impatto" || req.path === "/partner-proposal" || req.path === "/partner-assicurazioni" || req.path === "/platform" || req.path === "/impegno-riservatezza") {
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
      const siteIndex = path.resolve(process.cwd(), "site", "index.html");
      if (fs.existsSync(siteIndex)) {
        return res.sendFile(siteIndex);
      }
      const html = saasLandingTemplate.replace(/APP_NAME_PLACEHOLDER/g, appName);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
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

  setupCors(app);
  setupBodyParsing(app);
  setupSession(app);
  setupRequestLogging(app);

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
    const apkMetaPath = path.resolve(process.cwd(), "uploads", "apk", "meta.json");
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

  // Booking Hub Directory - list all organizations with booking_hub enabled
  app.get("/hub", (_req, res) => {
    const hubDirPath = path.resolve(process.cwd(), "server", "templates", "hub-directory.html");
    if (!fs.existsSync(hubDirPath)) {
      return res.status(404).send("Pagina non trovata");
    }
    const html = fs.readFileSync(hubDirPath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(html);
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

  // Rate limiting for login and public API
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/hub", publicApiLimiter);

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
