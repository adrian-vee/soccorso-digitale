import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
    organizationId?: string;
    managedLocationIds?: string[];
  }
}

declare global {
  namespace Express {
    interface Request {
      tokenUser?: { id: string; role: string; organizationId?: string };
    }
  }
}

async function checkTokenAuth(req: Request): Promise<{ id: string; role: string; organizationId?: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  if (!token) return null;
  
  const user = await storage.getUserByToken(token);
  if (!user) return null;
  
  return { id: user.id, role: user.role, organizationId: user.organizationId ?? undefined };
}

export async function checkQueryTokenAuth(req: Request): Promise<{ id: string; role: string; organizationId?: string } | null> {
  const token = req.query.token as string | undefined;
  if (!token) return null;
  const user = await storage.getUserByToken(token);
  if (!user) return null;
  return { id: user.id, role: user.role, organizationId: user.organizationId ?? undefined };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    if (req.session.userRole === "branch_manager" && !req.session.managedLocationIds) {
      const userLocs = await storage.getUserLocations(req.session.userId);
      req.session.managedLocationIds = userLocs.map(ul => ul.locationId);
    }
    return next();
  }
  
  const tokenUser = await checkTokenAuth(req);
  if (tokenUser) {
    req.tokenUser = tokenUser;
    if (tokenUser.role === "branch_manager") {
      const userLocs = await storage.getUserLocations(tokenUser.id);
      const locationIds = userLocs.map(ul => ul.locationId);
      if (req.session) {
        req.session.managedLocationIds = locationIds;
      }
      (req as any).managedLocationIds = locationIds;
    }
    return next();
  }
  
  return res.status(401).json({ error: "Non autenticato" });
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  let userRole: string | undefined;
  
  if (req.session?.userId) {
    userRole = req.session.userRole;
  } else {
    const tokenUser = await checkTokenAuth(req);
    if (tokenUser) {
      req.tokenUser = tokenUser;
      userRole = tokenUser.role;
    }
  }
  
  if (!userRole) {
    return res.status(401).json({ error: "Non autenticato" });
  }
  
  if (userRole !== "super_admin" && userRole !== "admin" && userRole !== "director" && userRole !== "org_admin") {
    return res.status(403).json({ error: "Accesso non autorizzato" });
  }
  
  next();
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  let userRole: string | undefined;
  
  if (req.session?.userId) {
    userRole = req.session.userRole;
  } else {
    const tokenUser = await checkTokenAuth(req);
    if (tokenUser) {
      req.tokenUser = tokenUser;
      userRole = tokenUser.role;
    }
  }
  
  if (!userRole) {
    return res.status(401).json({ error: "Non autenticato" });
  }
  
  if (userRole !== "super_admin" && userRole !== "admin" && userRole !== "director") {
    return res.status(403).json({ error: "Accesso riservato ai super-admin" });
  }
  
  next();
}

export async function requireOrgAdmin(req: Request, res: Response, next: NextFunction) {
  let userRole: string | undefined;
  let orgId: string | undefined;
  
  if (req.session?.userId) {
    userRole = req.session.userRole;
    orgId = req.session.organizationId;
  } else {
    const tokenUser = await checkTokenAuth(req);
    if (tokenUser) {
      req.tokenUser = tokenUser;
      userRole = tokenUser.role;
      orgId = tokenUser.organizationId;
    }
  }
  
  if (!userRole) {
    return res.status(401).json({ error: "Non autenticato" });
  }
  
  if (userRole === "super_admin" || userRole === "admin" || userRole === "director") {
    return next();
  }
  
  if (userRole !== "org_admin") {
    return res.status(403).json({ error: "Accesso non autorizzato" });
  }
  
  if (!orgId) {
    return res.status(403).json({ error: "Organizzazione non associata" });
  }
  
  next();
}

export function getUserId(req: Request): string | null {
  return req.session?.userId || req.tokenUser?.id || null;
}

export function getUserRole(req: Request): string | null {
  return req.session?.userRole || req.tokenUser?.role || null;
}

export function getOrganizationId(req: Request): string | null {
  return req.session?.organizationId || req.tokenUser?.organizationId || null;
}

export function getEffectiveOrgId(req: Request): string | null {
  const orgFilter = req.query.organizationFilter as string | undefined;
  if (orgFilter && isFullAdmin(req)) {
    return orgFilter;
  }
  return getOrganizationId(req);
}

export function getManagedLocationIds(req: Request): string[] {
  return req.session?.managedLocationIds || (req as any).managedLocationIds || [];
}

export function isFullAdmin(req: Request): boolean {
  const role = getUserRole(req);
  return role === 'super_admin' || role === 'admin' || role === 'director';
}

export function isOrgAdmin(req: Request): boolean {
  return getUserRole(req) === 'org_admin';
}

export function isBranchManager(req: Request): boolean {
  return getUserRole(req) === 'branch_manager';
}

export async function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  let userRole: string | undefined;
  let userId: string | undefined;
  
  if (req.session?.userId) {
    userRole = req.session.userRole;
    userId = req.session.userId;
  } else {
    const tokenUser = await checkTokenAuth(req);
    if (tokenUser) {
      req.tokenUser = tokenUser;
      userRole = tokenUser.role;
      userId = tokenUser.id;
    }
  }
  
  if (!userRole || !userId) {
    return res.status(401).json({ error: "Non autenticato" });
  }
  
  if (userRole !== "super_admin" && userRole !== "admin" && userRole !== "director" && userRole !== "branch_manager" && userRole !== "org_admin") {
    return res.status(403).json({ error: "Accesso non autorizzato" });
  }
  
  if (userRole === "branch_manager" && !req.session?.managedLocationIds) {
    const userLocs = await storage.getUserLocations(userId);
    if (req.session) {
      req.session.managedLocationIds = userLocs.map(ul => ul.locationId);
    }
  }
  
  next();
}

export async function canAccessLocation(req: Request, locationId: string): Promise<boolean> {
  if (isFullAdmin(req)) return true;
  
  if (isBranchManager(req)) {
    const managedIds = getManagedLocationIds(req);
    return managedIds.includes(locationId);
  }
  
  return false;
}

export async function getLocationFilter(req: Request): Promise<string[] | null> {
  if (isFullAdmin(req)) return null;
  if (isOrgAdmin(req)) return null;
  if (isBranchManager(req)) {
    let locationIds = getManagedLocationIds(req);
    
    if (locationIds.length === 0 && req.tokenUser?.id) {
      const userLocs = await storage.getUserLocations(req.tokenUser.id);
      locationIds = userLocs.map(ul => ul.locationId);
      if (req.session) {
        req.session.managedLocationIds = locationIds;
      }
    }
    
    return locationIds;
  }
  return [];
}
