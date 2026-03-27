import type { Request, Response, NextFunction } from "express";

const API_VERSION = "v1";
const PLATFORM_VERSION = "2.1.0";

/**
 * URL rewrite: /api/v1/* → /api/*
 * Allows both /api/trips and /api/v1/trips to work identically.
 * Must be mounted BEFORE route registration.
 */
export function apiVersionRewrite(req: Request, _res: Response, next: NextFunction): void {
  const v1Prefix = "/api/v1/";
  if (req.url.startsWith(v1Prefix)) {
    req.url = "/api/" + req.url.slice(v1Prefix.length);
  }
  next();
}

/**
 * Adds X-API-Version and X-Platform-Version headers to all /api responses.
 */
export function apiVersionHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-API-Version", API_VERSION);
  res.setHeader("X-Platform-Version", PLATFORM_VERSION);
  next();
}
