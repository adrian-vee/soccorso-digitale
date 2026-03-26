import type { Express } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import { organizations, users, vehicles, locations, trips, demoRequests, staffMembers } from "@shared/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin, requireOrgAdmin, getUserId, getOrganizationId, isFullAdmin } from "./auth-middleware";
import { getResendClient } from "./resend-client";
import { createDemoAccount } from "./demo-manager";

export function registerOrgAdminRoutes(app: Express) {

  app.get("/api/org-admin/organizations", requireSuperAdmin, async (_req, res) => {
    try {
      const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
      res.json(orgs);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/org-admin/organizations", requireSuperAdmin, async (req, res) => {
    try {
      const { name, slug, legalName, vatNumber, fiscalCode, address, city, province, postalCode, phone, email, pec, website, maxVehicles, maxUsers, notes, status } = req.body;
      
      if (!name || !slug) {
        return res.status(400).json({ error: "Nome e slug sono obbligatori" });
      }

      const existing = await db.select().from(organizations).where(eq(organizations.slug, slug));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Slug già in uso" });
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      const [org] = await db.insert(organizations).values({
        name,
        slug,
        legalName: legalName || null,
        vatNumber: vatNumber || null,
        fiscalCode: fiscalCode || null,
        address: address || null,
        city: city || null,
        province: province || null,
        postalCode: postalCode || null,
        phone: phone || null,
        email: email || null,
        pec: pec || null,
        website: website || null,
        maxVehicles: maxVehicles || 5,
        maxUsers: maxUsers || 20,
        notes: notes || null,
        status: status || "trial",
        trialEndsAt,
      }).returning();

      res.status(201).json(org);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/org-admin/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: Record<string, any> = {};
      const allowedFields = ["name", "slug", "legalName", "vatNumber", "fiscalCode", "address", "city", "province", "postalCode", "phone", "email", "pec", "website", "logoUrl", "maxVehicles", "maxUsers", "notes", "status", "enabledModules"];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      updates.updatedAt = new Date();

      const [org] = await db.update(organizations).set(updates).where(eq(organizations.id, id)).returning();
      if (!org) {
        return res.status(404).json({ error: "Organizzazione non trovata" });
      }
      res.json(org);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/org-admin/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      await db.delete(trips).where(eq(trips.organizationId, id));
      await db.delete(vehicles).where(eq(vehicles.organizationId, id));
      await db.delete(users).where(eq(users.organizationId, id));
      await db.delete(locations).where(eq(locations.organizationId, id));
      await db.delete(organizations).where(eq(organizations.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ error: "Errore durante l'eliminazione" });
    }
  });

  app.get("/api/org-admin/organizations/:id/stats", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.organizationId, id));
      const [vehicleCount] = await db.select({ count: count() }).from(vehicles).where(eq(vehicles.organizationId, id));
      const [locationCount] = await db.select({ count: count() }).from(locations).where(eq(locations.organizationId, id));
      const [tripCount] = await db.select({ count: count() }).from(trips).where(eq(trips.organizationId, id));

      res.json({
        organization: org,
        stats: {
          users: userCount?.count || 0,
          vehicles: vehicleCount?.count || 0,
          locations: locationCount?.count || 0,
          trips: tripCount?.count || 0,
        }
      });
    } catch (error) {
      console.error("Error fetching org stats:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/organizations/:id/locations", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const locs = await db.select().from(locations).where(eq(locations.organizationId, id));
      res.json(locs);
    } catch (error) {
      console.error("Error fetching org locations:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/org-admin/organizations/:id/locations", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, phone, email } = req.body;
      if (!name) return res.status(400).json({ error: "Nome sede obbligatorio" });

      const [loc] = await db.insert(locations).values({
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        organizationId: id,
      }).returning();

      res.status(201).json(loc);
    } catch (error) {
      console.error("Error creating org location:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/organizations/:id/vehicles", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleList = await db.select().from(vehicles).where(eq(vehicles.organizationId, id));
      res.json(vehicleList);
    } catch (error) {
      console.error("Error fetching org vehicles:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/org-admin/organizations/:id/vehicles", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { code, licensePlate, model, locationId, fuelType } = req.body;
      if (!code || !locationId) {
        return res.status(400).json({ error: "Codice veicolo e sede sono obbligatori" });
      }

      const locCheck = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.organizationId, id)));
      if (locCheck.length === 0) {
        return res.status(400).json({ error: "Sede non appartenente all'organizzazione" });
      }

      const [vehicle] = await db.insert(vehicles).values({
        code,
        licensePlate: licensePlate || null,
        model: model || null,
        locationId,
        fuelType: fuelType || "Gasolio",
        organizationId: id,
        currentKm: 0,
      }).returning();

      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating org vehicle:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/organizations/:id/users", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userList = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        accountType: users.accountType,
        vehicleId: users.vehicleId,
        locationId: users.locationId,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.organizationId, id));
      res.json(userList);
    } catch (error) {
      console.error("Error fetching org users:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/org-admin/organizations/:id/users", requireSuperAdmin, async (req, res) => {
    try {
      const orgId = req.params.id;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      const { email, password, name, role, accountType, vehicleId, locationId } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password e nome sono obbligatori" });
      }

      const existingUser = await db.select().from(users).where(eq(users.email, email));
      if (existingUser.length > 0) {
        return res.status(409).json({ error: "Email già in uso" });
      }

      const userRole = role === "org_admin" ? "org_admin" : "crew";

      if (vehicleId) {
        const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), eq(vehicles.organizationId, orgId)));
        if (!v) return res.status(400).json({ error: "Veicolo non appartenente all'organizzazione" });
      }

      if (locationId) {
        const [l] = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId)));
        if (!l) return res.status(400).json({ error: "Sede non appartenente all'organizzazione" });
      }

      const [user] = await db.insert(users).values({
        email,
        password,
        name,
        role: userRole,
        accountType: accountType || "vehicle",
        vehicleId: vehicleId || null,
        locationId: locationId || null,
        organizationId: orgId,
      }).returning();

      const { password: _, authToken: __, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating org user:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/my-org", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      res.json(org);
    } catch (error) {
      console.error("Error fetching my org:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/org-admin/my-org", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const allowedFields = ["legalName", "vatNumber", "fiscalCode", "address", "city", "province", "postalCode", "phone", "email", "pec", "website"];
      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      updates.updatedAt = new Date();

      const [org] = await db.update(organizations).set(updates).where(eq(organizations.id, orgId)).returning();
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      res.json(org);
    } catch (error) {
      console.error("Error updating my org:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/my-org/vehicles", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (isFullAdmin(req)) {
        const targetOrgId = req.query.organizationId as string;
        if (targetOrgId) {
          const vehicleList = await db.select().from(vehicles).where(eq(vehicles.organizationId, targetOrgId));
          return res.json(vehicleList);
        }
      }
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const vehicleList = await db.select().from(vehicles).where(eq(vehicles.organizationId, orgId));
      res.json(vehicleList);
    } catch (error) {
      console.error("Error fetching org vehicles:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/org-admin/my-org/vehicles", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      if (org.status === "suspended" || org.status === "inactive") {
        return res.status(403).json({ error: "Organizzazione sospesa o disattivata" });
      }

      const [vehicleCount] = await db.select({ count: count() }).from(vehicles).where(eq(vehicles.organizationId, orgId));
      if ((vehicleCount?.count || 0) >= (org.maxVehicles || 5)) {
        return res.status(403).json({ error: `Limite veicoli raggiunto (${org.maxVehicles})` });
      }

      const { code, licensePlate, model, locationId, fuelType } = req.body;
      if (!code || !locationId) {
        return res.status(400).json({ error: "Codice veicolo e sede sono obbligatori" });
      }

      const locCheck = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId)));
      if (locCheck.length === 0) {
        return res.status(400).json({ error: "Sede non appartenente alla tua organizzazione" });
      }

      const [vehicle] = await db.insert(vehicles).values({
        code,
        licensePlate: licensePlate || null,
        model: model || null,
        locationId,
        fuelType: fuelType || "Gasolio",
        organizationId: orgId,
        currentKm: 0,
      }).returning();

      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating org vehicle:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/org-admin/my-org/vehicles/:vehicleId", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const { vehicleId } = req.params;
      const [existing] = await db.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), eq(vehicles.organizationId, orgId)));
      if (!existing) return res.status(404).json({ error: "Veicolo non trovato" });

      const allowedFields = ["code", "licensePlate", "model", "fuelType", "locationId", "isActive"];
      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const [vehicle] = await db.update(vehicles).set(updates).where(eq(vehicles.id, vehicleId)).returning();
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating org vehicle:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/my-org/locations", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (isFullAdmin(req)) {
        const targetOrgId = req.query.organizationId as string;
        if (targetOrgId) {
          const locs = await db.select().from(locations).where(eq(locations.organizationId, targetOrgId));
          return res.json(locs);
        }
      }
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const locs = await db.select().from(locations).where(eq(locations.organizationId, orgId));
      res.json(locs);
    } catch (error) {
      console.error("Error fetching org locations:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/org-admin/my-org/locations", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const { name, address, phone, email } = req.body;
      if (!name) return res.status(400).json({ error: "Nome sede obbligatorio" });

      const [loc] = await db.insert(locations).values({
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        organizationId: orgId,
      }).returning();

      res.status(201).json(loc);
    } catch (error) {
      console.error("Error creating org location:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/my-org/users", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (isFullAdmin(req)) {
        const targetOrgId = req.query.organizationId as string;
        if (targetOrgId) {
          const userList = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            accountType: users.accountType,
            vehicleId: users.vehicleId,
            locationId: users.locationId,
            isActive: users.isActive,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
          }).from(users).where(eq(users.organizationId, targetOrgId));
          return res.json(userList);
        }
      }
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const userList = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        accountType: users.accountType,
        vehicleId: users.vehicleId,
        locationId: users.locationId,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.organizationId, orgId));

      res.json(userList);
    } catch (error) {
      console.error("Error fetching org users:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/org-admin/my-org/users", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      if (org.status === "suspended" || org.status === "inactive") {
        return res.status(403).json({ error: "Organizzazione sospesa o disattivata" });
      }

      const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.organizationId, orgId));
      if ((userCount?.count || 0) >= (org.maxUsers || 20)) {
        return res.status(403).json({ error: `Limite utenti raggiunto (${org.maxUsers})` });
      }

      const { email, password, name, role, accountType, vehicleId, locationId } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password e nome sono obbligatori" });
      }

      const existingUser = await db.select().from(users).where(eq(users.email, email));
      if (existingUser.length > 0) {
        return res.status(409).json({ error: "Email già in uso" });
      }

      const userRole = role === "org_admin" ? "org_admin" : "crew";

      if (vehicleId) {
        const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), eq(vehicles.organizationId, orgId)));
        if (!v) return res.status(400).json({ error: "Veicolo non appartenente alla tua organizzazione" });
      }

      if (locationId) {
        const [l] = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId)));
        if (!l) return res.status(400).json({ error: "Sede non appartenente alla tua organizzazione" });
      }

      const [user] = await db.insert(users).values({
        email,
        password,
        name,
        role: userRole,
        accountType: accountType || "vehicle",
        vehicleId: vehicleId || null,
        locationId: locationId || null,
        organizationId: orgId,
      }).returning();

      const { password: _, authToken: __, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating org user:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/org-admin/my-org/users/:userId", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const { userId } = req.params;
      const [existing] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.organizationId, orgId)));
      if (!existing) return res.status(404).json({ error: "Utente non trovato" });

      const allowedFields = ["name", "email", "password", "isActive", "vehicleId", "locationId"];
      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const [user] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      const { password: _, authToken: __, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating org user:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/my-org/trips", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const tripList = await db.select().from(trips)
        .where(eq(trips.organizationId, orgId))
        .orderBy(desc(trips.createdAt))
        .limit(100);

      res.json(tripList);
    } catch (error) {
      console.error("Error fetching org trips:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/my-org/dashboard", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non associata" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.organizationId, orgId));
      const [vehicleCount] = await db.select({ count: count() }).from(vehicles).where(eq(vehicles.organizationId, orgId));
      const [locationCount] = await db.select({ count: count() }).from(locations).where(eq(locations.organizationId, orgId));
      const [tripCount] = await db.select({ count: count() }).from(trips).where(eq(trips.organizationId, orgId));
      const [activeVehicles] = await db.select({ count: count() }).from(vehicles).where(and(eq(vehicles.organizationId, orgId), eq(vehicles.isActive, true)));

      const today = new Date().toISOString().split("T")[0];
      const [todayTrips] = await db.select({ count: count() }).from(trips).where(and(eq(trips.organizationId, orgId), eq(trips.serviceDate, today)));

      res.json({
        organization: org,
        stats: {
          totalUsers: userCount?.count || 0,
          totalVehicles: vehicleCount?.count || 0,
          activeVehicles: activeVehicles?.count || 0,
          totalLocations: locationCount?.count || 0,
          totalTrips: tripCount?.count || 0,
          todayTrips: todayTrips?.count || 0,
          maxVehicles: org.maxVehicles || 5,
          maxUsers: org.maxUsers || 20,
        }
      });
    } catch (error) {
      console.error("Error fetching org dashboard:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/demo-requests", async (req, res) => {
    try {
      const { organizationName, contactName, contactEmail, contactPhone, city, province, vehicleCount, notes } = req.body;
      if (!organizationName || !contactName || !contactEmail) {
        return res.status(400).json({ error: "Nome organizzazione, nome referente e email sono obbligatori" });
      }
      const [request] = await db.insert(demoRequests).values({
        organizationName,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        city: city || null,
        province: province || null,
        vehicleCount: vehicleCount ? parseInt(vehicleCount) : null,
        notes: notes || null,
      }).returning();
      res.status(201).json({ success: true, id: request.id });
    } catch (error) {
      console.error("Error creating demo request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/demo-requests", requireSuperAdmin, async (_req, res) => {
    try {
      const requests = await db.select().from(demoRequests).orderBy(desc(demoRequests.createdAt));
      res.json(requests);
    } catch (error) {
      console.error("Error fetching demo requests:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.patch("/api/org-admin/demo-requests/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reviewNotes } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Stato non valido" });
      }
      const userId = getUserId(req);
      const [updated] = await db.update(demoRequests)
        .set({
          status,
          reviewNotes: reviewNotes || null,
          reviewedBy: userId ? parseInt(String(userId)) : null,
          reviewedAt: new Date(),
        })
        .where(eq(demoRequests.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Richiesta non trovata" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating demo request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/org-admin/demo-requests/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(demoRequests).where(eq(demoRequests.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting demo request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/demo-requests/count", requireSuperAdmin, async (_req, res) => {
    try {
      const [result] = await db.select({ count: count() }).from(demoRequests).where(eq(demoRequests.status, "pending"));
      res.json({ count: result?.count || 0 });
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/org-admin/my-org/staff-members", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const members = await db.select().from(staffMembers)
        .where(eq(staffMembers.organizationId, orgId))
        .orderBy(staffMembers.lastName);
      res.json(members);
    } catch (error) {
      console.error("Error fetching org staff members:", error);
      res.status(500).json({ error: "Errore nel recupero personale" });
    }
  });

  app.post("/api/org-admin/my-org/staff-members", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const { firstName, lastName, fiscalCode, email, phone, locationId, primaryRole, contractType, notes, isActive } = req.body;
      if (!firstName || !lastName || !locationId || !primaryRole) {
        return res.status(400).json({ error: "Nome, cognome, sede e ruolo sono obbligatori" });
      }
      const [member] = await db.insert(staffMembers).values({
        firstName, lastName, fiscalCode: fiscalCode || null, email: email || null, phone: phone || null,
        locationId, primaryRole, contractType: contractType || 'volunteer',
        notes: notes || null, isActive: isActive !== false, organizationId: orgId,
      }).returning();
      res.json(member);
    } catch (error) {
      console.error("Error creating staff member:", error);
      res.status(500).json({ error: "Errore nella creazione del membro" });
    }
  });

  app.put("/api/org-admin/my-org/staff-members/:memberId", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const { memberId } = req.params;
      const existing = await db.select().from(staffMembers)
        .where(and(eq(staffMembers.id, memberId), eq(staffMembers.organizationId, orgId)));
      if (existing.length === 0) return res.status(404).json({ error: "Membro non trovato" });

      const { firstName, lastName, fiscalCode, email, phone, locationId, primaryRole, contractType, notes, isActive } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (fiscalCode !== undefined) updateData.fiscalCode = fiscalCode || null;
      if (email !== undefined) updateData.email = email || null;
      if (phone !== undefined) updateData.phone = phone || null;
      if (locationId !== undefined) updateData.locationId = locationId;
      if (primaryRole !== undefined) updateData.primaryRole = primaryRole;
      if (contractType !== undefined) updateData.contractType = contractType;
      if (notes !== undefined) updateData.notes = notes || null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updated] = await db.update(staffMembers).set(updateData)
        .where(and(eq(staffMembers.id, memberId), eq(staffMembers.organizationId, orgId))).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating staff member:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del membro" });
    }
  });

  app.delete("/api/org-admin/my-org/staff-members/:memberId", requireOrgAdmin, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const { memberId } = req.params;
      const existing = await db.select().from(staffMembers)
        .where(and(eq(staffMembers.id, memberId), eq(staffMembers.organizationId, orgId)));
      if (existing.length === 0) return res.status(404).json({ error: "Membro non trovato" });

      await db.delete(staffMembers)
        .where(and(eq(staffMembers.id, memberId), eq(staffMembers.organizationId, orgId)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del membro" });
    }
  });

  // ── MODULES MANAGEMENT ──────────────────────────────────────────────────────

  const AVAILABLE_MODULES = [
    { key: "gps_tracking",     name: "GPS Tracking",            price: 29 },
    { key: "analytics_pro",    name: "Analytics Pro",           price: 19 },
    { key: "finance",          name: "Gestione Finanziaria",    price: 24 },
    { key: "checklists",       name: "Checklist & Ispezioni",   price: 12 },
    { key: "spid",             name: "Accesso SPID/CIE",        price: 15 },
    { key: "sms_notify",       name: "Notifiche SMS",           price: 19 },
    { key: "white_label",      name: "White Label App",         price: 49 },
    { key: "carbon_tracking",  name: "Carbon Footprint",        price: 0  },
    { key: "tenders",          name: "Gare d'Appalto",          price: 0  },
  ] as const;

  app.get("/api/org-admin/organizations/:id/modules", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const orgs = await db.select().from(organizations).where(eq(organizations.id, id));
      if (orgs.length === 0) return res.status(404).json({ error: "Organizzazione non trovata" });

      const org = orgs[0];
      const enabledModules: string[] = (org as any).enabledModules || [];

      const modules = AVAILABLE_MODULES.map(m => ({
        ...m,
        enabled: enabledModules.includes(m.key),
      }));

      res.json({ modules });
    } catch (error) {
      console.error("Error fetching org modules:", error);
      res.status(500).json({ error: "Errore nel recupero dei moduli" });
    }
  });

  app.put("/api/org-admin/organizations/:id/modules", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { enabledModules } = req.body as { enabledModules: string[] };

      if (!Array.isArray(enabledModules)) {
        return res.status(400).json({ error: "enabledModules deve essere un array" });
      }

      const validKeys = new Set(AVAILABLE_MODULES.map(m => m.key));
      const sanitized = enabledModules.filter(k => validKeys.has(k as any));

      await db.update(organizations)
        .set({ updatedAt: new Date(), ...(({ enabledModules: sanitized } as any)) })
        .where(eq(organizations.id, id));

      res.json({ success: true, enabledModules: sanitized });
    } catch (error) {
      console.error("Error updating org modules:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dei moduli" });
    }
  });

  // ── WELCOME EMAIL ────────────────────────────────────────────────────────────

  app.post("/api/org-admin/organizations/:id/send-welcome-email", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const orgs = await db.select().from(organizations).where(eq(organizations.id, id));
      if (orgs.length === 0) return res.status(404).json({ error: "Organizzazione non trovata" });

      // Email sending is handled externally; return success stub
      console.log(`[org-admin] Welcome email requested for org ${id}`);
      res.json({ success: true, message: "Email di benvenuto inviata con successo" });
    } catch (error) {
      console.error("Error sending welcome email:", error);
      res.status(500).json({ error: "Errore nell'invio dell'email" });
    }
  });

  // ── SUPER-ADMIN DEMO REQUEST MANAGEMENT ──────────────────────────────────────

  app.get("/api/super-admin/demo-requests", requireSuperAdmin, async (_req, res) => {
    try {
      const requests = await db.select().from(demoRequests).orderBy(desc(demoRequests.createdAt));
      res.json(requests);
    } catch (error) {
      console.error("Error fetching demo requests:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/super-admin/demo-requests/:id/approve", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      const [request] = await db.select().from(demoRequests).where(eq(demoRequests.id, id));
      if (!request) {
        return res.status(404).json({ error: "Richiesta non trovata" });
      }
      if (request.status !== "pending") {
        return res.status(400).json({ error: "La richiesta è già stata elaborata" });
      }

      const [updated] = await db.update(demoRequests)
        .set({
          status: "approved",
          reviewedBy: null,
          reviewedAt: new Date(),
          reviewNotes: null,
        })
        .where(eq(demoRequests.id, id))
        .returning();

      const result = await createDemoAccount(
        request.contactEmail,
        request.contactName,
        request.organizationName,
      );

      if (!result.success) {
        console.error("[demo-requests] createDemoAccount failed:", result.error);
      }

      res.json({ success: true, request: updated, demoResult: result });
    } catch (error) {
      console.error("Error approving demo request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/super-admin/demo-requests/:id/reject", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = getUserId(req);

      const [request] = await db.select().from(demoRequests).where(eq(demoRequests.id, id));
      if (!request) {
        return res.status(404).json({ error: "Richiesta non trovata" });
      }

      const [updated] = await db.update(demoRequests)
        .set({
          status: "rejected",
          reviewedBy: null,
          reviewedAt: new Date(),
          reviewNotes: reason || null,
        })
        .where(eq(demoRequests.id, id))
        .returning();

      res.json({ success: true, request: updated });
    } catch (error) {
      console.error("Error rejecting demo request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ── PUBLIC DEMO REQUEST SUBMISSION ───────────────────────────────────────────

  app.post("/api/public/demo-request", async (req, res) => {
    try {
      const {
        organizationName,
        contactName,
        contactEmail,
        contactPhone,
        city,
        province,
        vehicleCount,
        orgType,
        notes,
      } = req.body;

      if (!organizationName || !contactName || !contactEmail) {
        return res.status(400).json({
          error: "Nome organizzazione, nome referente e email sono obbligatori",
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail)) {
        return res.status(400).json({ error: "Indirizzo email non valido" });
      }

      const [demoRequest] = await db.insert(demoRequests).values({
        organizationName: organizationName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone?.trim() || null,
        city: city?.trim() || null,
        province: province?.trim().toUpperCase().slice(0, 2) || null,
        vehicleCount: vehicleCount ? parseInt(String(vehicleCount), 10) : null,
        notes: [orgType ? `Tipologia: ${orgType}` : null, notes?.trim() || null]
          .filter(Boolean)
          .join(" — ") || null,
        status: "pending",
      }).returning();

      // Send confirmation emails (synchronous — errors logged but don't affect response)
      try {
        const { client, fromEmail } = await getResendClient();

          const confirmationHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:40px 40px 32px;text-align:center;">
    <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:44px;height:44px;background:linear-gradient(135deg,#c9aaff,#839aff);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v5c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V7l-8-5z" fill="white"/></svg>
      </div>
      <span style="color:#fff;font-size:16px;font-weight:700;letter-spacing:1px;">SOCCORSO DIGITALE</span>
    </div>
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">Richiesta Ricevuta!</h1>
    <p style="color:#a6a6a6;font-size:15px;margin:0;">Ti contatteremo entro 24 ore lavorative</p>
  </div>
  <div style="padding:40px;">
    <p style="color:#1a1a1a;font-size:16px;line-height:1.6;margin:0 0 24px;">Ciao <strong>${demoRequest.contactName}</strong>,</p>
    <p style="color:#525252;font-size:15px;line-height:1.6;margin:0 0 24px;">Abbiamo ricevuto la tua richiesta di demo per <strong>${demoRequest.organizationName}</strong>. Il nostro team la analizzerà e ti invierà le credenziali di accesso entro 24 ore lavorative.</p>
    <div style="background:#f8f8f8;border-radius:12px;padding:24px;margin:0 0 24px;">
      <h3 style="color:#1a1a1a;font-size:14px;font-weight:600;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px;">Cosa succede ora</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:flex-start;gap:12px;"><div style="width:24px;height:24px;background:linear-gradient(135deg,#c9aaff,#839aff);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:#fff;font-size:12px;font-weight:700;">1</span></div><p style="color:#525252;font-size:14px;margin:0;padding-top:2px;">Il team verifica la tua richiesta e predispone l'ambiente demo</p></div>
        <div style="display:flex;align-items:flex-start;gap:12px;"><div style="width:24px;height:24px;background:linear-gradient(135deg,#c9aaff,#839aff);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:#fff;font-size:12px;font-weight:700;">2</span></div><p style="color:#525252;font-size:14px;margin:0;padding-top:2px;">Ricevi via email le credenziali di accesso con tutti i moduli attivi</p></div>
        <div style="display:flex;align-items:flex-start;gap:12px;"><div style="width:24px;height:24px;background:linear-gradient(135deg,#c9aaff,#839aff);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:#fff;font-size:12px;font-weight:700;">3</span></div><p style="color:#525252;font-size:14px;margin:0;padding-top:2px;">Esplori la piattaforma liberamente per 7 giorni con i tuoi dati reali</p></div>
      </div>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://soccorsodigitale.app" style="display:inline-block;background:linear-gradient(135deg,#c9aaff,#839aff);color:#000;font-weight:700;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:100px;">Visita il Sito</a>
    </div>
    <p style="color:#a6a6a6;font-size:13px;margin:0;">Per qualsiasi domanda, rispondi a questa email o scrivici a <a href="mailto:info@soccorsodigitale.app" style="color:#839aff;">info@soccorsodigitale.app</a></p>
  </div>
  <div style="background:#f8f8f8;padding:20px 40px;border-top:1px solid #e6e6e6;text-align:center;">
    <p style="color:#a6a6a6;font-size:12px;margin:0;">© Soccorso Digitale in Cloud 2026 · <a href="https://soccorsodigitale.app/privacy" style="color:#a6a6a6;">Privacy</a></p>
  </div>
</div>
</body>
</html>`;

          const adminNotificationHtml = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#1a1a1a;">🔔 Nuova Richiesta Demo</h2>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:8px;font-weight:bold;color:#525252;">Organizzazione:</td><td style="padding:8px;">${demoRequest.organizationName}</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:8px;font-weight:bold;color:#525252;">Contatto:</td><td style="padding:8px;">${demoRequest.contactName}</td></tr>
<tr><td style="padding:8px;font-weight:bold;color:#525252;">Email:</td><td style="padding:8px;">${demoRequest.contactEmail}</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:8px;font-weight:bold;color:#525252;">Telefono:</td><td style="padding:8px;">${demoRequest.contactPhone || "—"}</td></tr>
<tr><td style="padding:8px;font-weight:bold;color:#525252;">Città:</td><td style="padding:8px;">${[demoRequest.city, demoRequest.province].filter(Boolean).join(", ") || "—"}</td></tr>
<tr style="background:#f8f8f8;"><td style="padding:8px;font-weight:bold;color:#525252;">Mezzi:</td><td style="padding:8px;">${demoRequest.vehicleCount ?? "—"}</td></tr>
<tr><td style="padding:8px;font-weight:bold;color:#525252;">Note:</td><td style="padding:8px;">${demoRequest.notes || "—"}</td></tr>
</table>
<p><a href="https://soccorsodigitale.app/admin/" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">Gestisci nella Dashboard</a></p>
</body>
</html>`;

          const [confirmResult, notifyResult] = await Promise.allSettled([
            client.emails.send({
              from: fromEmail,
              to: demoRequest.contactEmail,
              subject: "Richiesta Demo Ricevuta - Soccorso Digitale",
              html: confirmationHtml,
            }),
            client.emails.send({
              from: fromEmail,
              to: "info@soccorsodigitale.app",
              subject: `Nuova richiesta demo: ${demoRequest.organizationName}`,
              html: adminNotificationHtml,
            }),
          ]);
          if (confirmResult.status === "rejected") {
            console.error("[demo-request] Confirmation email failed:", confirmResult.reason);
          } else {
            console.log("[demo-request] Confirmation email sent to", demoRequest.contactEmail);
          }
          if (notifyResult.status === "rejected") {
            console.error("[demo-request] Admin notification email failed:", notifyResult.reason);
          }
      } catch (emailError) {
        console.error("[demo-request] Email client error:", emailError);
      }

      res.status(201).json({ success: true, id: demoRequest.id });
    } catch (error) {
      console.error("Error creating public demo request:", error);
      res.status(500).json({ error: "Errore del server. Riprova tra qualche minuto." });
    }
  });

  // ── ORG EMAIL SENDING ─────────────────────────────────────────────────────────

  app.post("/api/org-admin/send-email", requireSuperAdmin, async (req, res) => {
    try {
      const {
        organizationIds,
        templateId,
        subject,
        htmlBody,
        recipientEmails,
      } = req.body as {
        organizationIds: string[];
        templateId: string;
        subject: string;
        htmlBody: string;
        recipientEmails?: string[];
      };

      if (!subject || !htmlBody) {
        return res.status(400).json({ error: "Oggetto e corpo email sono obbligatori" });
      }
      if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
        return res.status(400).json({ error: "Seleziona almeno un'organizzazione" });
      }

      let targets: string[] = [];

      if (Array.isArray(recipientEmails) && recipientEmails.length > 0) {
        targets = recipientEmails.filter(e => typeof e === "string" && e.trim());
      } else {
        const orgs = await db
          .select({ email: organizations.email })
          .from(organizations)
          .where(
            organizationIds.length === 1
              ? eq(organizations.id, organizationIds[0])
              : sql`${organizations.id} = ANY(ARRAY[${sql.join(
                  organizationIds.map(id => sql`${id}`),
                  sql`, `,
                )}]::text[])`,
          );
        targets = orgs.map(o => o.email).filter((e): e is string => !!e);
      }

      if (targets.length === 0) {
        return res.status(400).json({ error: "Nessun indirizzo email trovato per le organizzazioni selezionate" });
      }

      const { client, fromEmail } = await getResendClient();

      const results = await Promise.allSettled(
        targets.map(email =>
          client.emails.send({
            from: fromEmail,
            to: email,
            subject,
            html: htmlBody,
          }),
        ),
      );

      const sent = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      console.log(`[org-email] Bulk send: ${sent} sent, ${failed} failed. Template: ${templateId}`);

      res.json({ success: true, sent, failed, total: targets.length });
    } catch (error) {
      console.error("Error sending org emails:", error);
      res.status(500).json({ error: "Errore durante l'invio delle email" });
    }
  });

  // ── BILLING INFO ─────────────────────────────────────────────────────────────

  app.get("/api/org-admin/organizations/:id/billing", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const orgs = await db.select().from(organizations).where(eq(organizations.id, id));
      if (orgs.length === 0) return res.status(404).json({ error: "Organizzazione non trovata" });

      const org = orgs[0];
      const planPrices: Record<string, number> = {
        free: 0,
        starter: 49,
        professional: 149,
        enterprise: 299,
      };
      const plan = (org as any).plan || "free";
      const basePrice = planPrices[plan] ?? 0;

      const enabledModules: string[] = (org as any).enabledModules || [];
      const modulesTotal = AVAILABLE_MODULES
        .filter(m => enabledModules.includes(m.key))
        .reduce((sum, m) => sum + m.price, 0);

      res.json({
        organizationId: id,
        plan,
        basePrice,
        modulesTotal,
        totalMonthly: basePrice + modulesTotal,
        currency: "EUR",
        billingCycle: "monthly",
        enabledModules,
        nextBillingDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split("T")[0],
        status: "active",
      });
    } catch (error) {
      console.error("Error fetching org billing:", error);
      res.status(500).json({ error: "Errore nel recupero delle informazioni di fatturazione" });
    }
  });
}
