/**
 * Provider API Routes
 *
 * Exposes geocoding, weather, holidays, alerts, and validation
 * endpoints backed by the provider manager infrastructure.
 */

import { Router, Request, Response } from "express";
import { getGeoProvider } from "../providers/geo";
import { getWeatherProvider } from "../providers/weather";
import { getDataProvider } from "../providers/data";
import { getValidationProvider } from "../providers/validation";

export function createProviderRoutes(requireAuth: Function, requireAdmin: Function): Router {
  const router = Router();

  // ─── GEOCODING ──────────────────────────────────────────────
  /** POST /api/providers/geo/geocode */
  router.post("/geo/geocode", requireAuth as any, async (req: Request, res: Response) => {
    const { query, countryCode } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    const orgId = (req as any).organizationId ?? "default";
    const result = await getGeoProvider().geocode(query, orgId, countryCode);

    res.json({
      data: result.data,
      meta: { source: result.source, cached: result.cached, latencyMs: result.latencyMs },
      error: result.error,
    });
  });

  /** POST /api/providers/geo/reverse */
  router.post("/geo/reverse", requireAuth as any, async (req: Request, res: Response) => {
    const { lat, lon } = req.body;
    if (typeof lat !== "number" || typeof lon !== "number") {
      return res.status(400).json({ error: "lat and lon (numbers) are required" });
    }

    const orgId = (req as any).organizationId ?? "default";
    const result = await getGeoProvider().reverseGeocode(lat, lon, orgId);

    res.json({
      data: result.data,
      meta: { source: result.source, cached: result.cached, latencyMs: result.latencyMs },
      error: result.error,
    });
  });

  // ─── WEATHER ────────────────────────────────────────────────
  /** GET /api/providers/weather?lat=X&lon=Y */
  router.get("/weather", requireAuth as any, async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: "lat and lon query params required" });
    }

    const orgId = (req as any).organizationId ?? "default";
    const result = await getWeatherProvider().getWeather(lat, lon, orgId);

    res.json({
      data: result.data,
      meta: { source: result.source, cached: result.cached, latencyMs: result.latencyMs },
      error: result.error,
    });
  });

  /** GET /api/providers/weather/impact?lat=X&lon=Y */
  router.get("/weather/impact", requireAuth as any, async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: "lat and lon query params required" });
    }

    const orgId = (req as any).organizationId ?? "default";
    const result = await getWeatherProvider().getWeatherImpact(lat, lon, orgId);

    res.json({
      data: result.data !== null ? { impactFactor: result.data } : null,
      meta: { source: result.source, cached: result.cached, latencyMs: result.latencyMs },
      error: result.error,
    });
  });

  // ─── HOLIDAYS ───────────────────────────────────────────────
  /** GET /api/providers/holidays/:year */
  router.get("/holidays/:year", requireAuth as any, async (req: Request, res: Response) => {
    const year = parseInt(req.params.year);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: "Valid year (2000-2100) required" });
    }

    const result = await getDataProvider().getHolidays(year);
    res.json({
      data: result.data,
      meta: { source: result.source, cached: result.cached, latencyMs: result.latencyMs },
      error: result.error,
    });
  });

  /** GET /api/providers/holidays/check/:date (YYYY-MM-DD) */
  router.get("/holidays/check/:date", requireAuth as any, async (req: Request, res: Response) => {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date format: YYYY-MM-DD" });
    }

    const result = await getDataProvider().isHoliday(date);
    res.json({
      data: result.data,
      isHoliday: result.data !== null,
      meta: { source: result.source, cached: result.cached, latencyMs: result.latencyMs },
    });
  });

  // ─── EMERGENCY ALERTS ───────────────────────────────────────
  /** GET /api/providers/alerts?region=Veneto */
  router.get("/alerts", requireAuth as any, async (req: Request, res: Response) => {
    const region = req.query.region as string | undefined;
    const result = await getDataProvider().getAlerts(region);

    res.json({
      data: result.data,
      count: result.data?.length ?? 0,
      meta: { source: result.source, cached: result.cached, latencyMs: result.latencyMs },
      error: result.error,
    });
  });

  // ─── VALIDATION ─────────────────────────────────────────────
  /** POST /api/providers/validate/cf */
  router.post("/validate/cf", requireAuth as any, (req: Request, res: Response) => {
    const { codiceFiscale } = req.body;
    if (!codiceFiscale || typeof codiceFiscale !== "string") {
      return res.status(400).json({ error: "codiceFiscale is required" });
    }

    const result = getValidationProvider().validateCF(codiceFiscale);
    const info = getValidationProvider().extractCFInfo(codiceFiscale);

    res.json({ data: { ...result, birthInfo: info } });
  });

  /** POST /api/providers/validate/vat */
  router.post("/validate/vat", requireAuth as any, async (req: Request, res: Response) => {
    const { vatNumber } = req.body;
    if (!vatNumber || typeof vatNumber !== "string") {
      return res.status(400).json({ error: "vatNumber is required" });
    }

    try {
      const result = await getValidationProvider().validateVAT(vatNumber);
      res.json({ data: result });
    } catch (err) {
      res.status(502).json({ error: "VAT validation service unavailable" });
    }
  });

  /** POST /api/providers/validate/password */
  router.post("/validate/password", async (req: Request, res: Response) => {
    // No auth required — used during registration
    const { password } = req.body;
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "password is required" });
    }

    try {
      const result = await getValidationProvider().checkPassword(password);
      res.json({ data: result });
    } catch {
      // Don't block registration if HIBP is down
      res.json({ data: { breached: false, occurrences: 0, message: "Verifica non disponibile" } });
    }
  });

  // ─── HEALTH / ADMIN ─────────────────────────────────────────
  /** GET /api/providers/health */
  router.get("/health", requireAdmin as any, (_req: Request, res: Response) => {
    res.json({
      geo: getGeoProvider().getHealth(),
      weather: getWeatherProvider().getHealth(),
      data: getDataProvider().getHealth(),
      validation: getValidationProvider().getHealth(),
      cache: {
        geo: getGeoProvider().getCacheStats(),
        weather: getWeatherProvider().getCacheStats(),
      },
    });
  });

  return router;
}
