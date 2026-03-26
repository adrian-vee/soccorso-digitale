import type { Express } from "express";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { db } from "../db";
import {
  insertUserSchema,
  users,
  organizations,
  orgCustomRoles,
  orgUserInvitations,
  orgAccessLogs,
} from "@shared/schema";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  requireAuth,
  getUserId,
} from "../auth-middleware";
import { getUserPermissions } from "../permissions";
import { auditLog } from "../audit";
import { isDemoExpired } from "../demo-manager";

export function registerAuthRoutes(app: Express) {
  // ============================================================================
  // AUTH ROUTES - Login, Logout, Session, Register
  // ============================================================================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);

      const passwordValid = user?.password
        ? await bcrypt.compare(password, user.password).catch(() => false)
        : false
      if (!user || !passwordValid) {
        console.log(`[auth] Login failed for ${email}: ${!user ? 'user not found' : 'wrong password'}`);
        await auditLog.login("", email, req.ip || "unknown");
        return res.status(401).json({ error: "Credenziali non valide" });
      }

      // Check if account is active
      if (user.isActive === false) {
        console.log(`[auth] Login rejected for ${email}: account inactive`);
        return res.status(401).json({ error: "Account disattivato" });
      }

      // Check if demo account has expired
      if (user.organizationId) {
        const demoExpired = await isDemoExpired(user.organizationId);
        if (demoExpired) {
          return res.status(401).json({ error: "La demo è scaduta. Contatta info@soccorsodigitale.app per attivare un account completo." });
        }
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.organizationId = user.organizationId ?? undefined;

      // Generate auth token for mobile app
      const token = crypto.randomUUID();
      await storage.updateUserToken(user.id, token);

      // Update last login timestamp
      await storage.updateUserLastLogin(user.id);

      // Auto-confirm pending invitation when user logs in
      if (user.id) {
        db.update(orgUserInvitations)
          .set({ status: "accepted", acceptedAt: new Date() })
          .where(and(
            eq(orgUserInvitations.userId, user.id),
            eq(orgUserInvitations.status, "pending")
          ))
          .catch(() => {});
      }

      await auditLog.login(user.id, (user as any).fullName || (user as any).name || email, req.ip || "unknown");

      if (user.organizationId) {
        db.insert(orgAccessLogs).values({
          organizationId: user.organizationId,
          userId: user.id,
          userName: (user as any).fullName || (user as any).name || email,
          action: "login",
          details: { method: user.accountType === "vehicle" ? "vehicle" : "panel" },
          ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
          userAgent: req.get("User-Agent") || "unknown",
        }).catch(() => {});
      }

      // Get vehicle and location data for vehicle accounts
      let vehicle = null;
      let location = null;

      if (user.vehicleId) {
        vehicle = await storage.getVehicle(user.vehicleId);
        if (vehicle?.locationId) {
          location = await storage.getLocation(vehicle.locationId);
        }
      } else if (user.locationId) {
        location = await storage.getLocation(user.locationId);
      }

      let organization = null;
      if (user.organizationId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId));
        if (org) {
          organization = {
            id: org.id,
            name: org.name,
            enabledModules: org.enabledModules,
            logoUrl: org.logoUrl,
          };
        }
      }

      const { password: _, authToken: __, ...userWithoutPassword } = user;

      let permissions: string[] = [];
      let customRoleName: string | null = null;
      if (user.customRoleId) {
        permissions = await getUserPermissions(user.role, user.customRoleId);
        const [cr] = await db.select().from(orgCustomRoles).where(eq(orgCustomRoles.id, user.customRoleId));
        customRoleName = cr?.name || null;
      }

      res.json({
        user: {
          ...userWithoutPassword,
          vehicle,
          location,
          organization,
          permissions,
          customRoleName,
        },
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // TEMPORARY: one-time super admin password reset endpoint
  // Protected by RESET_SECRET env var — remove after use
  app.post("/api/auth/reset-superadmin", async (req, res) => {
    const secret = process.env.RESET_SECRET;
    if (!secret || req.body.secret !== secret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const newHash = "$2b$12$J07aLS/xMV3QTFgbVgPSwujpEfMxquZ86FaABVLVDsKrKt8w9rNAq";
      const [updated] = await db.update(users)
        .set({ password: newHash, isActive: true })
        .where(eq(users.email, "superadmin@soccorsodigitale.app"))
        .returning({ id: users.id, email: users.email, role: users.role });
      if (!updated) {
        return res.status(404).json({ error: "Super admin not found" });
      }
      console.log("[reset-superadmin] Password reset for", updated.email);
      res.json({ success: true, user: updated });
    } catch (err) {
      console.error("[reset-superadmin] Error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    let userId = req.session?.userId || null;

    const authHeader = req.headers.authorization;
    if (!userId && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const tokenUser = await storage.getUserByToken(token);
      if (tokenUser) {
        userId = tokenUser.id;
        await db.update(users).set({ authToken: null }).where(eq(users.id, tokenUser.id));
      }
    }

    if (userId) {
      await storage.updateUserLastLogout(userId);
    }

    await auditLog.logout(userId || "", req.ip || "unknown");

    if (req.session?.userId) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: "Errore durante il logout" });
        }
        res.clearCookie("croce.sid");
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    if (req.session?.userId) {
      res.json({
        authenticated: true,
        userId: req.session.userId,
        role: req.session.userRole,
        organizationId: req.session.organizationId || null
      });
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const user = await storage.getUserByToken(token);
        if (user) {
          req.session.userId = user.id;
          req.session.userRole = user.role;
          req.session.organizationId = user.organizationId ?? undefined;
          return res.json({
            authenticated: true,
            userId: user.id,
            role: user.role,
            organizationId: user.organizationId
          });
        }
      }
      res.json({ authenticated: false });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);

      if (existingUser) {
        return res.status(400).json({ error: "Email già registrata" });
      }

      const user = await storage.createUser(userData);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // AUTH ME - Get current user profile
  // ============================================================================

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Non autenticato" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Utente non trovato" });
      }

      const { password, ...safeUser } = user;

      // Add managed locations for branch managers
      let managedLocations: any[] = [];
      if (user.role === 'branch_manager') {
        const userLocs = await storage.getUserLocations(userId);
        managedLocations = userLocs.map(ul => ul.location);
      }

      // Get vehicle and location data for vehicle accounts (refresh on every call)
      let vehicle = null;
      let location = null;

      if (user.vehicleId) {
        vehicle = await storage.getVehicle(user.vehicleId);
        if (vehicle?.locationId) {
          location = await storage.getLocation(vehicle.locationId);
        }
      } else if (user.locationId) {
        location = await storage.getLocation(user.locationId);
      }

      let organization = null;
      if (user.organizationId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId));
        if (org) {
          organization = {
            id: org.id,
            name: org.name,
            enabledModules: org.enabledModules,
            logoUrl: org.logoUrl,
            isDemo: org.isDemo || false,
            demoExpiresAt: org.demoExpiresAt || null,
          };
        }
      }

      let permissions: string[] = [];
      let customRoleName: string | null = null;
      if (user.customRoleId) {
        permissions = await getUserPermissions(user.role, user.customRoleId);
        const [cr] = await db.select().from(orgCustomRoles).where(eq(orgCustomRoles.id, user.customRoleId));
        customRoleName = cr?.name || null;
      }

      res.json({
        user: {
          ...safeUser,
          vehicle,
          location,
          managedLocations,
          organization,
          permissions,
          customRoleName,
          isFullAdmin: user.role === 'super_admin' || user.role === 'admin' || user.role === 'director'
        }
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // USER SETTINGS
  // ============================================================================

  app.get("/api/user-settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Non autenticato" });
      }

      let settings = await storage.getUserSettings(userId);
      if (!settings) {
        // Create default settings
        settings = await storage.createUserSettings({
          userId,
          notificationsEnabled: true,
          soundEnabled: true,
          vibrationEnabled: true,
          checklistReminderEnabled: true,
          checklistReminderTime: "07:00",
          expiryAlertsEnabled: true,
          scadenzeReminderEnabled: true,
        });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Update user settings
  app.put("/api/user-settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Non autenticato" });
      }

      const settings = await storage.updateUserSettings(userId, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });
}
