import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Static asset paths exempt from rate limiting
const STATIC_PREFIXES = ["/css/", "/js/", "/fonts/", "/images/", "/site/", "/assets/", "/admin/", "/uploads/", "/downloads/", "/static-build/"];
const STATIC_EXACT = ["/", "/new", "/piattaforma", "/clienti", "/contatti", "/projects", "/services", "/contact", "/about-us", "/about", "/logo.svg", "/favicon.ico", "/site.webmanifest", "/apple-touch-icon.png"];

function isStaticRoute(req: Request): boolean {
  const p = req.path;
  if (STATIC_EXACT.includes(p)) return true;
  return STATIC_PREFIXES.some((prefix) => p.startsWith(prefix));
}

// Rate limit globale: solo API — escluse route statiche e pagine HTML
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Troppe richieste, riprova più tardi" },
  skip: isStaticRoute,
});

// Rate limit per login: anti brute-force
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Troppi tentativi di accesso, riprova tra 15 minuti" },
});

// Rate limit per API pubbliche
export const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit superato" },
});
