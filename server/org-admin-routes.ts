import type { Express } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import { organizations, users, vehicles, locations, trips, demoRequests, staffMembers } from "@shared/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin, requireOrgAdmin, getUserId, getOrganizationId, isFullAdmin } from "./auth-middleware";

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
}
