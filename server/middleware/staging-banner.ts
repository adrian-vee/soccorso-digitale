import type { Request, Response, NextFunction } from "express";

/**
 * Sets res.locals.isStaging when NODE_ENV=staging.
 * Frontend can check window.__CONFIG__.isStaging to show the banner.
 */
export function stagingBanner(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "staging") {
    res.locals.isStaging = true;
    res.setHeader("X-Environment", "staging");
  }
  next();
}
