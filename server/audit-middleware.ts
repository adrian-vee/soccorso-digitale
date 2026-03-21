import { Request, Response, NextFunction } from "express";
import { setRequestContext, clearRequestContext, type AuditContext } from "./audit";

// ============================================================================
// AUDIT MIDDLEWARE
// Enriches requests with audit context for comprehensive logging
// ============================================================================

// Extend Express Request to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: AuditContext;
    }
  }
}

// Extract client IP address from request
function getClientIp(req: Request): string {
  // Check various headers for proxied requests
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(",")[0].trim();
  }
  
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") {
    return realIp;
  }
  
  return req.socket?.remoteAddress || "unknown";
}

// Extract user agent from request
function getUserAgent(req: Request): string {
  return req.headers["user-agent"] || "unknown";
}

// Extract device info from headers (mobile app sends this)
function getDeviceInfo(req: Request): string | undefined {
  const deviceInfo = req.headers["x-device-info"];
  if (typeof deviceInfo === "string") {
    return deviceInfo;
  }
  return undefined;
}

// Audit middleware - attaches context to every request
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Build audit context from session and request
  const session = req.session as any;
  
  const context: AuditContext = {
    actorType: session?.userId ? (session.userRole === "admin" || session.userRole === "director" ? "admin" : "user") : "system",
    actorId: session?.userId || undefined,
    actorName: session?.userName || undefined,
    actorEmail: session?.userEmail || undefined,
    sessionId: req.sessionID || undefined,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    deviceInfo: getDeviceInfo(req),
    locationId: session?.locationId || undefined,
    locationName: session?.locationName || undefined,
    vehicleId: session?.vehicleId || (req.headers["x-vehicle-id"] as string) || undefined,
    vehicleCode: session?.vehicleCode || (req.headers["x-vehicle-code"] as string) || undefined,
  };
  
  // Attach to request for route handlers
  req.auditContext = context;
  
  // Set global context for audit functions
  setRequestContext(context);
  
  // Clear context when response finishes
  res.on("finish", () => {
    clearRequestContext();
  });
  
  next();
}

// Helper to update context with vehicle info (called when vehicle is selected)
export function updateVehicleContext(req: Request, vehicleId: string, vehicleCode: string): void {
  if (req.auditContext) {
    req.auditContext.vehicleId = vehicleId;
    req.auditContext.vehicleCode = vehicleCode;
    setRequestContext(req.auditContext);
  }
}

// Helper to update context with location info
export function updateLocationContext(req: Request, locationId: string, locationName: string): void {
  if (req.auditContext) {
    req.auditContext.locationId = locationId;
    req.auditContext.locationName = locationName;
    setRequestContext(req.auditContext);
  }
}
