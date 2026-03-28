/**
 * Fleet Routes — Vehicles, Locations, GPS, Structures, Departments,
 * Checklists, Chat, Handoffs, Photos, Fuel, Vehicle Documents, Sanitization, Rescue Sheets
 */

import type { Express } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { storage } from "../storage";
import { db } from "../db";
import {
  insertVehicleSchema,
  vehicles, trips, locations, handoffs, materialRestorations,
  tripGpsPoints, activeTrackingSessions, tripWaypoints,
  fuelCards, fuelEntries, shiftLogs, fuelPrices, checklistPhotos, photoReportMessages,
  vehicleDocuments, sanitizationLogs, rescueSheets,
  structures as structuresTable2, departments as departmentsTable, structureDepartments,
  structureRequests, scheduledServices,
  shiftInstances, shiftAssignments, staffMembers,
  users
} from "@shared/schema";
import { z } from "zod";
import { and, eq, gte, lte, inArray, sql, desc, asc, between, ne, isNotNull } from "drizzle-orm";
import {
  requireAuth, requireAdmin, requireSuperAdmin, requireOrgAdmin,
  getUserId, getOrganizationId, getEffectiveOrgId,
  requireAdminOrManager, getLocationFilter, isFullAdmin, isOrgAdmin,
  isBranchManager, getManagedLocationIds
} from "../auth-middleware";
import { updateVehicleContext } from "../audit-middleware";
import { auditLog } from "../audit";
import { broadcastMessage } from "./index";
import { generateTripPDF } from "../pdf-generator";

const cheerio: typeof import("cheerio") = new Proxy({} as any, {
  get(_target, prop) {
    const mod = require("cheerio");
    return mod[prop];
  }
});

const PDFDocument = new Proxy(function(){} as any, {
  construct(_target, args) {
    const Mod = require("pdfkit");
    return new Mod(...args);
  },
  get(_target, prop) {
    const Mod = require("pdfkit");
    return Mod[prop];
  }
});

// Alias used by some route handlers (matches original routes.ts convention)
const vehiclesTable = vehicles;

export function registerFleetRoutes(app: Express) {
  // Helper: sanitize domicilio addresses for geocoding
  function sanitizeDomicilioAddress(address: string): string {
    return address
      .replace(/,\s*\d+[a-zA-Z]?(?=\s|,|$)/g, "")
      .replace(/\s+\d+[a-zA-Z]?(?=\s|,|$)/g, "")
      .replace(/\s+n\.\s*\d+[a-zA-Z]?/gi, "")
      .replace(/\s+n°\s*\d+[a-zA-Z]?/gi, "")
      .toUpperCase().trim();
  }

  // Helper: geocode an address (Google → Nominatim fallback)
  async function geocodeAddress(address: string, isDomicilio: boolean = false, locationContext?: string, biasCoords?: { lat: number; lon: number }): Promise<{ lat: string; lon: string } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const preciseTypes = ["street_address", "route", "intersection", "premise", "subpremise", "establishment", "point_of_interest", "locality", "sublocality", "neighborhood", "postal_code", "airport", "park", "bus_station", "train_station", "transit_station", "hospital", "church"];
    function isResultPrecise(result: any): boolean {
      const resultTypes = result.types || [];
      if (resultTypes.includes("country")) return false;
      return resultTypes.some((t: string) => preciseTypes.includes(t));
    }
    try {
      const sanitizedAddress = isDomicilio ? sanitizeDomicilioAddress(address) : address;
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (googleApiKey) {
        try {
          const googleSearchAddress = address + ", Italia";
          let boundsParam = "";
          if (biasCoords) {
            const delta = 0.5;
            boundsParam = `&bounds=${biasCoords.lat - delta},${biasCoords.lon - delta}|${biasCoords.lat + delta},${biasCoords.lon + delta}`;
          }
          const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(googleSearchAddress)}&region=it&language=it${boundsParam}&key=${googleApiKey}`;
          const googleResponse = await fetch(googleUrl, { signal: controller.signal });
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            if (googleData.status === "OK" && googleData.results?.length > 0) {
              for (const result of googleData.results) {
                if (isResultPrecise(result)) {
                  const location = result.geometry.location;
                  clearTimeout(timeout);
                  return { lat: location.lat.toString(), lon: location.lng.toString() };
                }
              }
            }
          }
        } catch {}
      }
      const nominatimQueries = [sanitizedAddress];
      if (locationContext) nominatimQueries.unshift(`${sanitizedAddress}, ${locationContext}`);
      for (const query of nominatimQueries) {
        try {
          let nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=it`;
          if (biasCoords) nomUrl += `&viewbox=${biasCoords.lon - 0.5},${biasCoords.lat + 0.5},${biasCoords.lon + 0.5},${biasCoords.lat - 0.5}&bounded=0`;
          const response = await fetch(nomUrl, { headers: { "User-Agent": "SoccorsoDigitaleApp/1.0 (info@soccorsodigitale.app)", "Accept-Language": "it" }, signal: controller.signal });
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) { clearTimeout(timeout); return { lat: data[0].lat, lon: data[0].lon }; }
          }
        } catch {}
      }
      clearTimeout(timeout);
      return null;
    } catch { clearTimeout(timeout); return null; }
  }

  app.get("/api/locations", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const orgLocations = await db.select().from(locations).where(eq(locations.organizationId, orgId)).orderBy(locations.name);
        return res.json(orgLocations);
      }
      const allLocations = await storage.getLocations();
      res.json(allLocations);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/locations/:id", requireAuth, async (req, res) => {
    try {
      const location = await storage.getLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ error: "Sede non trovata" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/locations", requireAdmin, async (req, res) => {
    try {
      const { name, address, phone, email } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Nome obbligatorio" });
      }
      const locationData: any = { name, address, phone, email };
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        locationData.organizationId = orgId;
      }
      const location = await storage.createLocation(locationData);
      res.status(201).json(location);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Una sede con questo nome esiste già" });
      }
      console.error("Error creating location:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/locations/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const existing = await storage.getLocation(req.params.id);
        if (!existing || existing.organizationId !== orgId) {
          return res.status(403).json({ error: "Non autorizzato a modificare questa sede" });
        }
      }
      const { name, address, phone, email } = req.body;
      const location = await storage.updateLocation(req.params.id, { name, address, phone, email });
      if (!location) {
        return res.status(404).json({ error: "Sede non trovata" });
      }
      res.json(location);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Una sede con questo nome esiste già" });
      }
      console.error("Error updating location:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/locations/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const existing = await storage.getLocation(req.params.id);
        if (!existing || existing.organizationId !== orgId) {
          return res.status(403).json({ error: "Non autorizzato a eliminare questa sede" });
        }
      }
      // Check if location has vehicles or users before deleting
      const vehiclesInLocation = await storage.getVehiclesByLocation(req.params.id);
      if (vehiclesInLocation.length > 0) {
        return res.status(400).json({ 
          error: `Impossibile eliminare: ${vehiclesInLocation.length} veicoli associati a questa sede` 
        });
      }
      
      const deleted = await storage.deleteLocation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Sede non trovata" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Vehicles
  app.get("/api/vehicles", requireAuth, async (req, res) => {
    try {
      const { locationId } = req.query;
      let vehicles: any[] = [];
      
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        if (locationId) {
          vehicles = await db.select().from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.locationId, locationId as string), eq(vehiclesTable.isActive, true))).orderBy(vehiclesTable.code);
        } else {
          vehicles = await db.select().from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.isActive, true))).orderBy(vehiclesTable.code);
        }
        return res.json(vehicles);
      }
      
      // Apply location filter for branch managers
      const locationFilter = await getLocationFilter(req);
      
      if (locationId) {
        if (locationFilter !== null && !locationFilter.includes(locationId as string)) {
          return res.status(403).json({ error: "Accesso non autorizzato a questa sede" });
        }
        vehicles = await storage.getVehiclesByLocation(locationId as string);
      } else if (locationFilter !== null && locationFilter.length > 0) {
        const allVehicles = await storage.getVehicles();
        vehicles = allVehicles.filter(v => locationFilter.includes(v.locationId));
      } else if (locationFilter !== null && locationFilter.length === 0) {
        vehicles = [];
      } else {
        vehicles = await storage.getVehicles();
      }
      
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get today's stats for a specific vehicle
  app.get("/api/vehicles/:id/today-stats", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's trips for this vehicle
      const allTrips = await storage.getTripsByVehicle(vehicleId);
      const todayTrips = allTrips.filter(trip => {
        const tripDate = new Date(trip.createdAt);
        tripDate.setHours(0, 0, 0, 0);
        return tripDate.getTime() === today.getTime();
      });
      
      // Calculate km traveled today
      let kmToday = 0;
      todayTrips.forEach(trip => {
        if ((trip as any).kmFinal && (trip as any).kmStart) {
          kmToday += (trip as any).kmFinal - (trip as any).kmStart;
        }
      });
      
      // Get last trip info
      let lastTrip = undefined;
      if (todayTrips.length > 0) {
        const sorted = todayTrips.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const last = sorted[0];
        const tripTime = new Date(last.createdAt);
        lastTrip = {
          serviceNumber: (last as any).serviceNumber || `${sorted.length}`,
          time: tripTime.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        };
      }
      
      res.json({
        count: todayTrips.length,
        kmToday: Math.round(kmToday),
        lastTrip
      });
    } catch (error) {
      console.error("Error fetching today stats:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/vehicles", requireAdmin, async (req, res) => {
    try {
      const vehicleData = insertVehicleSchema.parse(req.body);
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        (vehicleData as any).organizationId = orgId;
      }
      const vehicle = await storage.createVehicle(vehicleData);
      res.status(201).json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/vehicles/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const existing = await storage.getVehicle(req.params.id);
        if (!existing || existing.organizationId !== orgId) {
          return res.status(403).json({ error: "Non autorizzato a modificare questo veicolo" });
        }
      }
      const { 
        code, licensePlate, brand, model, displacement, kw, fuelType, locationId, currentKm,
        assignedContractName, assignedContractLogo, workScheduleStart, workScheduleEnd,
        isAssignedToEvent, eventName, eventDate, defaultCrewType
      } = req.body;
      const vehicle = await storage.updateVehicle(req.params.id, {
        code,
        licensePlate,
        brand,
        model,
        displacement,
        kw,
        fuelType,
        locationId,
        currentKm,
        assignedContractName,
        assignedContractLogo,
        workScheduleStart,
        workScheduleEnd,
        isAssignedToEvent,
        eventName,
        eventDate,
        defaultCrewType,
      } as any);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/vehicles/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const existing = await storage.getVehicle(req.params.id);
        if (!existing || existing.organizationId !== orgId) {
          return res.status(403).json({ error: "Non autorizzato a eliminare questo veicolo" });
        }
      }
      const deleted = await storage.deleteVehicle(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // PATCH for partial vehicle updates (schedule config, etc.)
  app.patch("/api/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const { id: _ignoredId, natoName, scheduleRoles, scheduleColor, scheduleShiftStart, scheduleShiftEnd, scheduleProfiles, ...otherFields } = req.body;
      
      const updateData: any = {};
      if (natoName !== undefined) updateData.natoName = natoName;
      if (scheduleRoles !== undefined) updateData.scheduleRoles = scheduleRoles;
      if (scheduleColor !== undefined) updateData.scheduleColor = scheduleColor;
      if (scheduleShiftStart !== undefined) updateData.scheduleShiftStart = scheduleShiftStart;
      if (scheduleShiftEnd !== undefined) updateData.scheduleShiftEnd = scheduleShiftEnd;
      if (scheduleProfiles !== undefined) updateData.scheduleProfiles = scheduleProfiles;
      
      Object.assign(updateData, otherFields);
      console.log(`[VEHICLE PATCH] id=${req.params.id}, fields:`, Object.keys(updateData).join(','), 'natoName:', natoName, 'scheduleShifts:', otherFields.scheduleShifts ? 'present' : 'null', 'scheduleDays:', otherFields.scheduleDays ? 'present' : 'null');
      
      const vehicle = await storage.updateVehicle(req.params.id, updateData);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Error patching vehicle:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Vehicle GPS location update
  app.patch("/api/vehicles/:id/location", requireAuth, async (req, res) => {
    try {
      const { latitude, longitude, isOnService } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitudine e longitudine richieste" });
      }
      const vehicle = await storage.updateVehicleLocation(
        req.params.id, 
        latitude, 
        longitude, 
        isOnService ?? false
      );
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle location:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get all vehicles with location for map
  app.get("/api/vehicles/locations", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const orgVehicles = await db.select().from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.isActive, true))).orderBy(vehiclesTable.code);
        return res.json(orgVehicles);
      }
      const vehiclesData = await storage.getVehiclesWithLocation();
      res.json(vehiclesData);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get today's crew for a vehicle
  app.get("/api/vehicles/:id/today-crew", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.id;
      const today = new Date().toISOString().split('T')[0];
      
      // Get shift instances for this vehicle today
      const instances = await storage.getShiftInstances({
        vehicleId,
        dateFrom: today,
        dateTo: today
      });
      
      if (instances.length === 0) {
        return res.json({ crew: [], shiftInfo: null });
      }
      
      // Get assignments for these shift instances
      const allCrew: any[] = [];
      let shiftInfo = null;
      
      for (const instance of instances) {
        const assignments = await storage.getShiftAssignments({ shiftInstanceId: instance.id });
        
        if (!shiftInfo && instance.startTime && instance.endTime) {
          shiftInfo = {
            startTime: instance.startTime,
            endTime: instance.endTime,
            status: instance.status
          };
        }
        
        for (const assignment of assignments) {
          // Get staff member details
          const staffMember = await (storage as any).getStaffMemberById(assignment.staffMemberId);
          if (staffMember) {
            allCrew.push({
              id: staffMember.id,
              name: `${(staffMember as any).firstName || ''} ${(staffMember as any).lastName || ''}`.trim(),
              role: assignment.assignedRole,
              status: assignment.status
            });
          }
        }
      }
      
      res.json({ crew: allCrew, shiftInfo });
    } catch (error) {
      console.error("Error fetching today's crew:", error);
      res.status(500).json({ error: "Errore nel recupero equipaggio" });
    }
  });

  // ============================================
  // GPS TRACKING API ENDPOINTS
  // ============================================

  // Start a GPS tracking session for a vehicle
  app.post("/api/gps/tracking/start", requireAuth, async (req, res) => {
    try {
      const { vehicleId, tripId } = req.body;
      const userId = getUserId(req);
      
      if (!vehicleId) {
        return res.status(400).json({ error: "Vehicle ID richiesto" });
      }
      
      // Update vehicle to on service
      await storage.updateVehicleLocation(
        vehicleId,
        req.body.latitude || "0",
        req.body.longitude || "0",
        true
      );
      
      const session = await storage.startTrackingSession(vehicleId, userId!, tripId);
      res.json({ success: true, session });
    } catch (error) {
      console.error("Error starting tracking session:", error);
      res.status(500).json({ error: "Errore nell'avvio del tracking" });
    }
  });

  // End a GPS tracking session
  app.post("/api/gps/tracking/end", requireAuth, async (req, res) => {
    try {
      const { vehicleId } = req.body;
      
      if (!vehicleId) {
        return res.status(400).json({ error: "Vehicle ID richiesto" });
      }
      
      // Update vehicle to off service
      const vehicle = await storage.getVehicle(vehicleId);
      if (vehicle) {
        await storage.updateVehicleLocation(
          vehicleId,
          vehicle.latitude || "0",
          vehicle.longitude || "0",
          false
        );
      }
      
      const session = await storage.endTrackingSession(vehicleId);
      res.json({ success: true, session });
    } catch (error) {
      console.error("Error ending tracking session:", error);
      res.status(500).json({ error: "Errore nel terminare il tracking" });
    }
  });

  // Get current tracking session for a vehicle
  app.get("/api/gps/tracking/session/:vehicleId", requireAuth, async (req, res) => {
    try {
      const session = await storage.getActiveTrackingSession(req.params.vehicleId);
      res.json({ session });
    } catch (error) {
      console.error("Error getting tracking session:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get all active tracking sessions (for admin map view)
  app.get("/api/gps/tracking/active", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getAllActiveTrackingSessions();
      
      // Get vehicle details for each session
      const sessionsWithDetails = await Promise.all(
        sessions.map(async (session) => {
          const vehicle = await storage.getVehicle(session.vehicleId);
          return {
            ...session,
            vehicleCode: vehicle?.code || 'N/D',
            vehicleLicensePlate: vehicle?.licensePlate || 'N/D',
            latitude: vehicle?.latitude,
            longitude: vehicle?.longitude,
            organizationId: vehicle?.organizationId
          };
        })
      );
      
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const filtered = sessionsWithDetails.filter(s => (s as any).organizationId === orgId);
        return res.json(filtered);
      }
      
      res.json(sessionsWithDetails);
    } catch (error) {
      console.error("Error getting active sessions:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Send GPS point(s) during tracking
  app.post("/api/gps/points", requireAuth, async (req, res) => {
    try {
      const { vehicleId, tripId, points, latitude, longitude, accuracy, speed, heading, altitude } = req.body;
      
      if (!vehicleId) {
        return res.status(400).json({ error: "Vehicle ID richiesto" });
      }

      // Check for active session
      const session = await storage.getActiveTrackingSession(vehicleId);
      if (!session) {
        return res.status(400).json({ error: "Nessuna sessione di tracking attiva" });
      }

      const effectiveTripId = tripId || session.tripId || null;

      if (latitude && longitude) {
        await storage.updateVehicleLocation(vehicleId, latitude, longitude, true);
        broadcastMessage({
          type: "gps_location_update",
          vehicleId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          speed: speed ? parseFloat(speed) : null,
          heading: heading ? parseFloat(heading) : null,
          timestamp: new Date().toISOString()
        });
      }

      // Update session points count
      let newPointsCount = 0;

      // Handle batch of points
      if (points && Array.isArray(points) && points.length > 0) {
        if (effectiveTripId) {
          const insertedPoints = await storage.addGpsPointsBatch(
            points.map((p: any) => ({
              tripId: effectiveTripId,
              vehicleId,
              latitude: p.latitude,
              longitude: p.longitude,
              accuracy: p.accuracy,
              speed: p.speed,
              heading: p.heading,
              altitude: p.altitude,
              timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
            }))
          );
          newPointsCount = insertedPoints.length;
        } else {
          newPointsCount = points.length;
        }

        // Update session points count
        await db.update(activeTrackingSessions)
          .set({ pointsCount: sql`${activeTrackingSessions.pointsCount} + ${newPointsCount}`, lastUpdateAt: new Date() })
          .where(eq(activeTrackingSessions.id, session.id));

        res.json({ success: true, pointsCount: newPointsCount, stored: !!effectiveTripId });
      } 
      // Handle single point
      else if (latitude && longitude) {
        if (effectiveTripId) {
          const point = await storage.addGpsPoint({
            tripId: effectiveTripId,
            vehicleId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            altitude
          });
          newPointsCount = 1;
        }

        await db.update(activeTrackingSessions)
          .set({ pointsCount: sql`${activeTrackingSessions.pointsCount} + 1`, lastUpdateAt: new Date() })
          .where(eq(activeTrackingSessions.id, session.id));

        res.json({ success: true, pointsCount: 1, stored: !!effectiveTripId });
      } else {
        return res.status(400).json({ error: "Coordinate GPS richieste" });
      }
    } catch (error) {
      console.error("Error adding GPS points:", error);
      res.status(500).json({ error: "Errore nel salvataggio punti GPS" });
    }
  });

  // Get GPS points for a trip
  app.get("/api/gps/trips/:tripId/points", requireAuth, async (req, res) => {
    try {
      const points = await storage.getGpsPointsForTrip(req.params.tripId);
      res.json(points);
    } catch (error) {
      console.error("Error getting GPS points:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get GPS track summary for a trip (simplified for map display)
  app.get("/api/gps/trips/:tripId/track", requireAuth, async (req, res) => {
    try {
      const points = await storage.getGpsPointsForTrip(req.params.tripId);
      
      if (points.length === 0) {
        return res.json({ 
          hasTrack: false, 
          pointsCount: 0,
          track: [] 
        });
      }

      // Simplify track for display (Douglas-Peucker could be added)
      const simplifiedTrack = points.map(p => ({
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude),
        timestamp: p.timestamp,
        speed: p.speed
      }));

      res.json({
        hasTrack: true,
        pointsCount: points.length,
        startTime: points[0].timestamp,
        endTime: points[points.length - 1].timestamp,
        track: simplifiedTrack
      });
    } catch (error) {
      console.error("Error getting GPS track:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get GPS history for a vehicle (admin view)
  app.get("/api/gps/vehicles/:vehicleId/history", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let start: Date | undefined;
      let end: Date | undefined;
      
      if (startDate && typeof startDate === 'string') {
        start = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        end = new Date(endDate);
      }
      
      const points = await storage.getGpsPointsForVehicle(
        req.params.vehicleId,
        start,
        end
      );
      
      res.json(points);
    } catch (error) {
      console.error("Error getting vehicle GPS history:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Daily summary for GPS history - combines GPS points + trips + sede
  app.get("/api/gps/vehicles/:vehicleId/daily-summary", requireAuth, async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const { date } = req.query;
      
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: "Date parameter required" });
      }
      
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      const location = (await storage.getLocations()).find(l => l.id === vehicle.locationId);
      const locationName = location?.name || 'SAN GIOVANNI LUPATOTO';
      const SEDE_COORDS_MAP: Record<string, { lat: number; lng: number }> = {
        'SAN GIOVANNI LUPATOTO': { lat: 45.3836, lng: 11.0397 },
        'COLOGNA VENETA': { lat: 45.3129, lng: 11.3835 },
        'LEGNAGO': { lat: 45.1863, lng: 11.3151 },
        'MONTECCHIO MAGGIORE': { lat: 45.5003, lng: 11.4213 },
        'NOGARA': { lat: 45.1790, lng: 11.0637 }
      };
      const sedeCoords = SEDE_COORDS_MAP[locationName] || SEDE_COORDS_MAP['SAN GIOVANNI LUPATOTO'];
      
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      const gpsPoints = await storage.getGpsPointsForVehicle(vehicleId, startDate, endDate);
      
      const dayTrips = await db.select().from(trips)
        .where(and(
          eq(trips.vehicleId, vehicleId),
          sql`${trips.serviceDate}::text = ${date}`
        ));
      
      console.log(`[GPS Daily Summary] Vehicle: ${vehicleId}, Date: ${date}, GPS points: ${gpsPoints.length}, Trips found: ${dayTrips.length}`);
      
      let lastTripDate: string | null = null;
      if (dayTrips.length === 0) {
        const recentTrip = await db.select({ serviceDate: trips.serviceDate })
          .from(trips)
          .where(eq(trips.vehicleId, vehicleId))
          .orderBy(desc(trips.serviceDate))
          .limit(1);
        if (recentTrip.length > 0) {
          lastTripDate = recentTrip[0].serviceDate;
        }
      }
      
      const tripsWithDetails = await Promise.all(dayTrips.map(async (trip) => {
        let originLat: number | null = null;
        let originLng: number | null = null;
        let destLat: number | null = null;
        let destLng: number | null = null;
        let originName = trip.originAddress || '';
        let destName = trip.destinationAddress || '';
        
        if (trip.originType === 'sede') {
          if (trip.originStructureId) {
            const sedeLoc = (await storage.getLocations()).find(l => l.id === trip.originStructureId);
            if (sedeLoc) {
              originName = `Sede ${sedeLoc.name}`;
              const sedeC = SEDE_COORDS_MAP[sedeLoc.name];
              if (sedeC) { originLat = sedeC.lat; originLng = sedeC.lng; }
            }
          }
          if (!originName || originName === trip.originAddress) {
            originName = `Sede ${locationName}`;
            originLat = sedeCoords.lat;
            originLng = sedeCoords.lng;
          }
        } else if (trip.originStructureId) {
          const struct = await storage.getStructureById(trip.originStructureId);
          if (struct) {
            originName = struct.name || originName;
            if (struct.latitude && struct.longitude) {
              originLat = parseFloat(struct.latitude);
              originLng = parseFloat(struct.longitude);
            }
          }
        }
        if (trip.destinationType === 'sede') {
          if (trip.destinationStructureId) {
            const sedeLoc = (await storage.getLocations()).find(l => l.id === trip.destinationStructureId);
            if (sedeLoc) {
              destName = `Sede ${sedeLoc.name}`;
              const sedeC = SEDE_COORDS_MAP[sedeLoc.name];
              if (sedeC) { destLat = sedeC.lat; destLng = sedeC.lng; }
            }
          }
          if (!destName || destName === trip.destinationAddress) {
            destName = `Sede ${locationName}`;
            destLat = sedeCoords.lat;
            destLng = sedeCoords.lng;
          }
        } else if (trip.destinationStructureId) {
          const struct = await storage.getStructureById(trip.destinationStructureId);
          if (struct) {
            destName = struct.name || destName;
            if (struct.latitude && struct.longitude) {
              destLat = parseFloat(struct.latitude);
              destLng = parseFloat(struct.longitude);
            }
          }
        }
        
        return {
          id: trip.id,
          departureTime: trip.departureTime,
          returnTime: trip.returnTime,
          kmTraveled: trip.kmTraveled,
          serviceType: trip.serviceType,
          originName,
          originLat,
          originLng,
          destName,
          destLat,
          destLng
        };
      }));
      
      res.json({
        gpsPoints,
        trips: tripsWithDetails,
        sedeLocation: {
          name: locationName,
          ...sedeCoords
        },
        vehicleCode: vehicle.code,
        licensePlate: vehicle.licensePlate,
        lastTripDate
      });
    } catch (error) {
      console.error("Error getting daily summary:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get all vehicle real-time positions (for admin live map)
  // Location sede coordinates
  const SEDE_COORDINATES: Record<string, { lat: number; lng: number }> = {
    'SAN GIOVANNI LUPATOTO': { lat: 45.3836, lng: 11.0397 },
    'COLOGNA VENETA': { lat: 45.3129, lng: 11.3835 },
    'LEGNAGO': { lat: 45.1863, lng: 11.3151 },
    'MONTECCHIO MAGGIORE': { lat: 45.5003, lng: 11.4213 },
    'NOGARA': { lat: 45.1790, lng: 11.0637 }
  };

  app.get("/api/gps/live", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      
      let allVehicles = await storage.getVehicles();
      let allLocations = await storage.getLocations();
      
      if (orgId) {
        allVehicles = allVehicles.filter((v: any) => v.organizationId === orgId);
        allLocations = allLocations.filter((l: any) => l.organizationId === orgId);
      }
      const activeSessions = await storage.getAllActiveTrackingSessions();
      
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const todayStr = now.toISOString().split('T')[0];
      
      const tripsTodayConditions: any[] = [sql`${trips.serviceDate}::text = ${todayStr}`];
      if (orgId) tripsTodayConditions.push(eq(trips.organizationId, orgId));
      const todayTrips = await db.select().from(trips)
        .where(and(...tripsTodayConditions));

      const servicesTodayConditions: any[] = [
        eq(scheduledServices.serviceDate, todayStr),
        sql`${scheduledServices.status} IN ('in_progress', 'waiting_for_visit')`
      ];
      if (orgId) servicesTodayConditions.push(eq(scheduledServices.organizationId, orgId));
      const todayActiveServices = await db.select().from(scheduledServices)
        .where(and(...servicesTodayConditions))
        .orderBy(sql`CASE WHEN status = 'waiting_for_visit' THEN 0 ELSE 1 END, actual_start_time DESC`);

      const activeServiceByVehicle: Record<string, typeof todayActiveServices[0]> = {};
      for (const s of todayActiveServices) {
        if (s.vehicleId && !activeServiceByVehicle[s.vehicleId]) {
          activeServiceByVehicle[s.vehicleId] = s;
        }
      }

      const vehiclePositions = allVehicles.map(v => {
        const session = activeSessions.find(s => s.vehicleId === v.id);
        const location = allLocations.find(l => l.id === v.locationId);
        const locationName = location?.name || '';
        const sedeCoords = SEDE_COORDINATES[locationName] || SEDE_COORDINATES['SAN GIOVANNI LUPATOTO'];

        const hasRealGps = v.latitude && v.longitude &&
          parseFloat(v.latitude) !== 0 && parseFloat(v.longitude) !== 0;
        
        const vehicleTripsToday = todayTrips.filter(t => t.vehicleId === v.id);
        const totalKmToday = vehicleTripsToday.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
        const tripCountToday = vehicleTripsToday.length;
        
        const recentTrip = vehicleTripsToday
          .filter(t => t.createdAt && new Date(t.createdAt) >= twoHoursAgo)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        const hasRecentTrip = !!recentTrip;
        const isOnServiceComputed = v.isOnService || hasRecentTrip;
        
        const lastTrip = vehicleTripsToday
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        const activeService = activeServiceByVehicle[v.id];
        const isWaitingForVisit = activeService?.status === 'waiting_for_visit';
        const activeServiceInfo = activeService ? {
          id: activeService.id,
          status: activeService.status,
          serviceType: activeService.serviceType,
          scheduledTime: activeService.scheduledTime,
          patientName: activeService.patientName || null,
          originName: activeService.originName,
          destinationName: activeService.destinationName,
          actualStartTime: activeService.actualStartTime,
        } : null;
        
        return {
          vehicleId: v.id,
          vehicleCode: v.code,
          licensePlate: v.licensePlate,
          locationId: v.locationId,
          locationName: locationName,
          latitude: hasRealGps ? parseFloat(v.latitude!) : sedeCoords.lat,
          longitude: hasRealGps ? parseFloat(v.longitude!) : sedeCoords.lng,
          hasRealGps: hasRealGps,
          lastUpdate: v.lastLocationAt,
          isOnService: isOnServiceComputed,
          isTracking: !!session,
          tripId: session?.tripId || null,
          sessionPointsCount: session?.pointsCount || 0,
          tripCountToday,
          totalKmToday,
          lastTripTime: lastTrip?.createdAt || null,
          isWaitingForVisit,
          activeService: activeServiceInfo
        };
      });
      
      const totalSessionPoints = activeSessions.reduce((sum, s) => sum + (s.pointsCount || 0), 0);
      const totalGpsPoints = await db.select({ count: sql<number>`count(*)` }).from(tripGpsPoints);
      const totalDbPoints = totalGpsPoints[0]?.count || 0;
      
      res.json({
        vehicles: vehiclePositions,
        totalGpsPoints: totalDbPoints + totalSessionPoints,
        activeSessionsCount: activeSessions.filter(s => s.isActive).length
      });
    } catch (error) {
      console.error("Error getting live GPS positions:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Link tracking session to trip (when trip is created)
  app.patch("/api/gps/tracking/link-trip", requireAuth, async (req, res) => {
    try {
      const { vehicleId, tripId } = req.body;
      
      const session = await storage.getActiveTrackingSession(vehicleId);
      if (!session) {
        return res.status(404).json({ error: "Nessuna sessione di tracking attiva" });
      }
      
      const updatedSession = await storage.updateTrackingSessionTrip(session.id, tripId);
      res.json({ success: true, session: updatedSession });
    } catch (error) {
      console.error("Error linking trip to session:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get GPS points for a specific trip (or calculated route)
  app.get("/api/trips/:id/gps", requireAuth, async (req, res) => {
    try {
      const tripId = req.params.id;
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      
      // First try to get points directly linked to this trip
      let points = await storage.getGpsPointsForTrip(tripId);
      
      // If no direct points, try to find points by time window
      if (points.length === 0 && trip.vehicleId && trip.serviceDate && trip.departureTime && trip.returnTime) {
        const serviceDate = new Date(trip.serviceDate);
        const [depHour, depMin] = trip.departureTime.split(':').map(Number);
        const [retHour, retMin] = trip.returnTime.split(':').map(Number);
        
        const startTime = new Date(serviceDate);
        startTime.setHours(depHour, depMin, 0, 0);
        
        const endTime = new Date(serviceDate);
        endTime.setHours(retHour, retMin, 0, 0);
        
        if (endTime < startTime) {
          endTime.setDate(endTime.getDate() + 1);
        }
        
        points = await storage.getGpsPointsForVehicle(
          trip.vehicleId,
          startTime,
          endTime
        );
      }
      
      // If still no GPS points, calculate route from origin to destination
      if (points.length === 0) {
        try {
          let originCoords: { lat: string; lon: string } | null = null;
          let destCoords: { lat: string; lon: string } | null = null;
          
          async function resolveRouteCoords(structureId: string | null, address: string | null, isDomicilio: boolean): Promise<{ lat: string; lon: string } | null> {
            if (structureId) {
              const structure = await storage.getStructureById(structureId);
              if (structure?.latitude && structure?.longitude) {
                return { lat: structure.latitude, lon: structure.longitude };
              } else if (structure?.address) {
                return await geocodeAddress(structure.address, false);
              }
              const loc = await storage.getLocation(structureId);
              if (loc?.address) {
                return await geocodeAddress(loc.address, false);
              }
            }
            if (address) {
              return await geocodeAddress(address, isDomicilio);
            }
            return null;
          }
          originCoords = await resolveRouteCoords(trip.originStructureId, trip.originAddress, trip.originType === 'domicilio');
          destCoords = await resolveRouteCoords(trip.destinationStructureId, trip.destinationAddress, trip.destinationType === 'domicilio');
          
          // If we have both coordinates, get route from OSRM
          if (originCoords && destCoords) {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson`;
            
            const routeResponse = await fetch(osrmUrl, {
              headers: { "User-Agent": "CroceEuropaTransportApp/1.0" },
              signal: AbortSignal.timeout(10000)
            });
            
            if (routeResponse.ok) {
              const routeData = await routeResponse.json();
              if (routeData.routes && routeData.routes.length > 0 && routeData.routes[0].geometry) {
                const coordinates = routeData.routes[0].geometry.coordinates;
                const distanceKm = Math.round(routeData.routes[0].distance / 1000 * 10) / 10;
                
                return res.json({
                  tripId,
                  vehicleId: trip.vehicleId,
                  points: coordinates.map((coord: [number, number]) => ({
                    latitude: coord[1],
                    longitude: coord[0],
                    timestamp: null,
                    speed: null,
                    accuracy: null
                  })),
                  totalPoints: coordinates.length,
                  routeType: 'calculated',
                  distanceKm,
                  origin: { lat: parseFloat(originCoords.lat), lon: parseFloat(originCoords.lon) },
                  destination: { lat: parseFloat(destCoords.lat), lon: parseFloat(destCoords.lon) }
                });
              }
            }
          }
        } catch (routeError) {
          console.log("Could not calculate route, returning empty points");
        }
      }
      
      res.json({
        tripId,
        vehicleId: trip.vehicleId,
        points: points.map((p: { latitude: string; longitude: string; timestamp: Date; speed: number | null; accuracy: number | null }) => ({
          latitude: parseFloat(p.latitude),
          longitude: parseFloat(p.longitude),
          timestamp: p.timestamp,
          speed: p.speed,
          accuracy: p.accuracy
        })),
        totalPoints: points.length,
        routeType: 'tracked'
      });
    } catch (error) {
      console.error("Error getting trip GPS points:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================
  // END GPS TRACKING API
  // ============================================

  // Vehicle statistics for detail page
  app.get("/api/vehicles/:id/stats", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.id;
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }

      // Get all trips for this vehicle
      const allTrips = await storage.getTripsByVehicle(vehicleId);
      
      // Calculate 30-day stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentTrips = allTrips.filter(t => new Date(t.serviceDate) >= thirtyDaysAgo);
      
      const tripsLast30Days = recentTrips.length;
      const kmLast30Days = recentTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const avgKmPerTrip = allTrips.length > 0 
        ? Math.round(allTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0) / allTrips.length)
        : 0;
      const avgDurationMinutes = allTrips.length > 0
        ? Math.round(allTrips.filter(t => t.durationMinutes).reduce((sum, t) => sum + (t.durationMinutes || 0), 0) / allTrips.filter(t => t.durationMinutes).length)
        : 0;

      // Get recent trips with details
      const structures = await storage.getStructures();
      const locations = await storage.getLocations();
      
      const getLocationName = (locationId: string | null) => {
        if (!locationId) return null;
        const loc = locations.find(l => l.id === locationId);
        return loc?.name || null;
      };
      
      const getStructureName = (id: string | null) => {
        if (!id) return null;
        const s = structures.find(s => s.id === id);
        return s?.name || null;
      };
      
      const getOriginName = (trip: typeof allTrips[0]) => {
        if (trip.originType === "domicilio") return "Domicilio";
        if (trip.originType === "sede") {
          const locName = getLocationName(vehicle?.locationId || null);
          return locName ? `Sede ${locName}` : "Sede";
        }
        const structName = getStructureName(trip.originStructureId);
        if (structName) return structName;
        if (trip.originAddress) {
          const addr = trip.originAddress.split(",")[0];
          return addr || trip.originAddress;
        }
        return "N/D";
      };
      
      const getDestinationName = (trip: typeof allTrips[0]) => {
        if (trip.destinationType === "domicilio") return "Domicilio";
        if (trip.destinationType === "sede") {
          const locName = getLocationName(vehicle?.locationId || null);
          return locName ? `Sede ${locName}` : "Sede";
        }
        const structName = getStructureName(trip.destinationStructureId);
        if (structName) return structName;
        if (trip.destinationAddress) {
          const addr = trip.destinationAddress.split(",")[0];
          return addr || trip.destinationAddress;
        }
        return "N/D";
      };

      const recentTripsFormatted = allTrips.slice(0, 10).map(trip => ({
        id: trip.id,
        serviceDate: trip.serviceDate,
        originName: getOriginName(trip),
        destinationName: getDestinationName(trip),
        kmTraveled: trip.kmTraveled,
        departureTime: trip.departureTime,
        returnTime: trip.returnTime,
        progressiveNumber: trip.progressiveNumber,
      }));

      res.json({
        totalTrips: allTrips.length,
        tripsLast30Days,
        kmLast30Days,
        avgKmPerTrip,
        avgDurationMinutes: isNaN(avgDurationMinutes) ? 0 : avgDurationMinutes,
        recentTrips: recentTripsFormatted,
      });
    } catch (error) {
      console.error("Error getting vehicle stats:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Update vehicle maintenance info
  app.patch("/api/vehicles/:id/maintenance", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.id;
      const { nextRevisionDate, nextServiceDate, revisionKm, maintenanceStatus, lastMaintenanceDate, lastMaintenanceKm } = req.body;
      
      const vehicle = await storage.updateVehicle(vehicleId, {
        nextRevisionDate,
        nextServiceDate,
        revisionKm,
        maintenanceStatus,
        lastMaintenanceDate,
        lastMaintenanceKm,
      } as any);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating maintenance:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Generate vehicle PDF report
  app.get("/api/vehicles/:id/report-pdf", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.id;
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }

      const location = await storage.getLocation(vehicle.locationId);
      const allTrips = await storage.getTripsByVehicle(vehicleId);
      const structures = await storage.getStructures();
      
      // Calculate statistics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentTrips = allTrips.filter(t => new Date(t.serviceDate) >= thirtyDaysAgo);
      
      const totalKm = allTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const kmLast30Days = recentTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=report_${vehicle.code.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
      
      doc.pipe(res);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").text("SOCCORSO DIGITALE", { align: "center" });
      doc.fontSize(12).font("Helvetica").text("Impresa Sociale", { align: "center" });
      doc.moveDown();
      doc.fontSize(18).font("Helvetica-Bold").text(`Report Veicolo ${vehicle.code}`, { align: "center" });
      doc.fontSize(10).font("Helvetica").text(`Generato il ${new Date().toLocaleDateString("it-IT")}`, { align: "center" });
      doc.moveDown(2);

      // Vehicle Info Box
      doc.rect(50, doc.y, 495, 80).stroke();
      const infoY = doc.y + 10;
      doc.fontSize(12).font("Helvetica-Bold").text("Dati Veicolo", 60, infoY);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Codice: ${vehicle.code}`, 60, infoY + 20);
      doc.text(`Targa: ${vehicle.licensePlate || "N/D"}`, 60, infoY + 35);
      doc.text(`Modello: ${vehicle.model || "N/D"}`, 60, infoY + 50);
      doc.text(`Sede: ${location?.name || "N/D"}`, 300, infoY + 20);
      doc.text(`Alimentazione: ${vehicle.fuelType || "Gasolio"}`, 300, infoY + 35);
      doc.text(`Km Attuali: ${vehicle.currentKm?.toLocaleString("it-IT") || 0}`, 300, infoY + 50);
      doc.y = infoY + 80;
      doc.moveDown();

      // Statistics
      doc.fontSize(14).font("Helvetica-Bold").text("Statistiche", 50);
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Servizi Totali: ${allTrips.length}`);
      doc.text(`Servizi Ultimi 30 Giorni: ${recentTrips.length}`);
      doc.text(`Km Totali Percorsi: ${totalKm.toLocaleString("it-IT")}`);
      doc.text(`Km Ultimi 30 Giorni: ${kmLast30Days.toLocaleString("it-IT")}`);
      doc.text(`Media Km per Servizio: ${allTrips.length > 0 ? Math.round(totalKm / allTrips.length) : 0}`);
      doc.moveDown();

      // Maintenance Status
      doc.fontSize(14).font("Helvetica-Bold").text("Stato Manutenzione", 50);
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      const maintenanceStatus = (vehicle as any).maintenanceStatus || "ok";
      const statusText = maintenanceStatus === "ok" ? "OK" : maintenanceStatus === "warning" ? "Attenzione" : "Critico";
      doc.text(`Stato: ${statusText}`);
      doc.text(`Prossima Revisione: ${(vehicle as any).nextRevisionDate || "Non impostata"}`);
      doc.text(`Km alla Revisione: ${(vehicle as any).revisionKm?.toLocaleString("it-IT") || "N/D"}`);
      doc.text(`Ultimo Tagliando: ${(vehicle as any).lastMaintenanceDate || "Non registrato"}`);
      doc.moveDown();

      // Recent trips table
      if (allTrips.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Ultimi Servizi", 50);
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        const tableHeaders = ["Data", "Origine", "Destinazione", "Km"];
        const colWidths = [70, 180, 180, 50];
        
        doc.fontSize(9).font("Helvetica-Bold");
        let xPos = 50;
        tableHeaders.forEach((header, i) => {
          doc.text(header, xPos, tableTop, { width: colWidths[i] });
          xPos += colWidths[i];
        });
        
        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
        
        doc.font("Helvetica").fontSize(8);
        let yPos = tableTop + 20;
        
        const getStructureName = (id: string | null) => {
          if (!id) return "N/D";
          const s = structures.find(s => s.id === id);
          return s?.name || "N/D";
        };

        allTrips.slice(0, 15).forEach(trip => {
          if (yPos > 750) return;
          xPos = 50;
          const date = new Date(trip.serviceDate).toLocaleDateString("it-IT");
          const origin = trip.originType === "domicilio" ? "Domicilio" : getStructureName(trip.originStructureId);
          const dest = trip.destinationType === "domicilio" ? "Domicilio" : getStructureName(trip.destinationStructureId);
          
          doc.text(date, xPos, yPos, { width: colWidths[0] });
          doc.text(origin.substring(0, 35), xPos + colWidths[0], yPos, { width: colWidths[1] });
          doc.text(dest.substring(0, 35), xPos + colWidths[0] + colWidths[1], yPos, { width: colWidths[2] });
          doc.text(`${trip.kmTraveled}`, xPos + colWidths[0] + colWidths[1] + colWidths[2], yPos, { width: colWidths[3] });
          yPos += 12;
        });
      }

      // Footer
      doc.fontSize(8).font("Helvetica").fillColor("#666666");
      doc.text("Report generato automaticamente da SOCCORSO DIGITALE", 50, 780, { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating vehicle PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF" });
    }
  });

  // Structures
  app.get("/api/structures", requireAuth, async (req, res) => {
    try {
      const { type } = req.query;
      const structures = type
        ? await storage.getStructuresByType(type as string)
        : await storage.getStructures();
      res.json(structures);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/structures", requireAuth, async (req, res) => {
    try {
      const { name, address, type } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Nome obbligatorio" });
      }
      if (!address) {
        return res.status(400).json({ error: "Indirizzo obbligatorio" });
      }
      // Validate address format: should be "Street, City (XX)" pattern
      const addressPattern = /^.+,\s*[A-Za-zÀ-ÿ\s]+\s*\([A-Z]{2}\)\s*$/;
      if (!addressPattern.test(address)) {
        return res.status(400).json({ error: "L'indirizzo deve essere nel formato: Via/Piazza, Città (XX)" });
      }
      const provinceMatch = address.match(/\(([A-Z]{2})\)\s*$/);
      if (!provinceMatch) {
        return res.status(400).json({ error: "L'indirizzo deve terminare con la sigla della provincia, es. Verona (VR)" });
      }
      const structure = await storage.createStructure({
        name,
        address: address,
        type: type || "ospedale"
      });
      
      // Create audit log for manual structure creation (crew adding from mobile app)
      const reqUserId = getUserId(req);
      const user = reqUserId ? await storage.getUser(reqUserId) : null;
      const vehicle = user?.vehicleId ? await storage.getVehicle(user.vehicleId) : null;
      await storage.createAuditLog({
        action: "create",
        entityType: "structure",
        entityId: structure.id,
        userId: user?.id || null,
        userName: user?.name || "Equipaggio",
        changes: JSON.stringify({ 
          newValue: structure,
          source: "mobile_app",
          message: `Nuova struttura aggiunta: ${name}`
        }),
      });
      
      // Create structure request for admin review
      try {
        await db.insert(structureRequests).values({
          organizationId: user?.organizationId || '',
          type: 'structure',
          name: name.toUpperCase(),
          address: address || null,
          structureType: type || 'ospedale',
          submittedByUserId: reqUserId || null,
          submittedByName: user?.name || 'Equipaggio',
          vehicleCode: vehicle?.code || null,
          status: 'pending',
          resolvedStructureId: structure.id,
        });
      } catch (e) {
        console.log('Structure request creation skipped:', e);
      }
      
      res.status(201).json(structure);
    } catch (error) {
      console.error("Error creating structure:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/structures/:id", requireAdmin, async (req, res) => {
    try {
      const { name, address, type } = req.body;
      const structure = await storage.updateStructure(req.params.id, {
        name,
        address,
        type
      });
      if (!structure) {
        return res.status(404).json({ error: "Struttura non trovata" });
      }
      res.json(structure);
    } catch (error) {
      console.error("Error updating structure:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/structures/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteStructure(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Struttura non trovata" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting structure:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Departments
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/departments", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Nome obbligatorio" });
      }
      // Check if department already exists
      const existingDepts = await storage.getDepartments();
      const exists = existingDepts.some(d => d.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        return res.status(400).json({ error: "Reparto già esistente" });
      }
      const department = await storage.createDepartment({ name });
      
      // Create audit log for manual department creation (crew adding from mobile app)
      const reqUserId = getUserId(req);
      const user = reqUserId ? await storage.getUser(reqUserId) : null;
      const vehicle2 = user?.vehicleId ? await storage.getVehicle(user.vehicleId) : null;
      await storage.createAuditLog({
        action: "create",
        entityType: "department",
        entityId: department.id,
        userId: user?.id || null,
        userName: user?.name || "Equipaggio",
        changes: JSON.stringify({ 
          newValue: department,
          source: "mobile_app",
          message: `Nuovo reparto aggiunto: ${name}`
        }),
      });
      
      // Create structure request for admin review
      try {
        await db.insert(structureRequests).values({
          organizationId: user?.organizationId || '',
          type: 'department',
          name: name.toUpperCase(),
          submittedByUserId: reqUserId || null,
          submittedByName: user?.name || 'Equipaggio',
          vehicleCode: vehicle2?.code || null,
          status: 'pending',
          resolvedStructureId: department.id,
        });
      } catch (e) {
        console.log('Department request creation skipped:', e);
      }
      
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Structure-Department management (many-to-many)
  app.get("/api/structures/:id/departments", requireAuth, async (req, res) => {
    try {
      const departments = await storage.getStructureDepartments(req.params.id);
      res.json(departments);
    } catch (error) {
      console.error("Error getting structure departments:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/structures/:id/departments", requireAdmin, async (req, res) => {
    try {
      const { departmentId } = req.body;
      if (!departmentId) {
        return res.status(400).json({ error: "ID reparto obbligatorio" });
      }
      const mapping = await storage.addDepartmentToStructure(req.params.id, departmentId);
      res.status(201).json(mapping);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Reparto già associato a questa struttura" });
      }
      console.error("Error adding department to structure:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/structures/:id/departments/:departmentId", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.removeDepartmentFromStructure(
        req.params.id,
        req.params.departmentId
      );
      if (!deleted) {
        return res.status(404).json({ error: "Associazione non trovata" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing department from structure:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Bulk add departments to structure
  app.post("/api/structures/:id/departments/bulk", requireAdmin, async (req, res) => {
    try {
      const { departmentIds } = req.body;
      if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
        return res.status(400).json({ error: "Array di ID reparti obbligatorio" });
      }
      
      const results = { added: 0, skipped: 0, errors: [] as string[] };
      
      for (const departmentId of departmentIds) {
        try {
          await storage.addDepartmentToStructure(req.params.id, departmentId);
          results.added++;
        } catch (error: any) {
          if (error.code === '23505') {
            results.skipped++;
          } else {
            results.errors.push(departmentId);
          }
        }
      }
      
      res.status(201).json({
        success: true,
        added: results.added,
        skipped: results.skipped,
        errors: results.errors.length
      });
    } catch (error) {
      console.error("Error bulk adding departments to structure:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================
  // CHECKLIST TEMPLATES & VEHICLE CHECKLISTS
  // ============================================

  app.get("/api/checklist-templates", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const items = await storage.getChecklistTemplateItems(orgId || undefined);
      res.json(items);
    } catch (error) {
      console.error("Error fetching checklist templates:", error);
      res.status(500).json({ error: "Errore nel recupero dei template checklist" });
    }
  });

  // Get active checklist template items (for mobile app)
  app.get("/api/checklist-templates/active", requireAuth, async (req, res) => {
    try {
      const orgId = getOrganizationId(req);
      const items = await storage.getActiveChecklistTemplateItems(orgId || undefined);
      res.json(items);
    } catch (error) {
      console.error("Error fetching active checklist templates:", error);
      res.status(500).json({ error: "Errore nel recupero dei template checklist" });
    }
  });

  // Get all checklist submissions for org (admin panel)
  app.get("/api/checklist-submissions", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      if (!orgId) {
        return res.status(400).json({ error: "Organizzazione non trovata" });
      }
      const submissions = await storage.getVehicleChecklistsForOrg(orgId, limit);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching checklist submissions:", error);
      res.status(500).json({ error: "Errore nel recupero delle compilazioni" });
    }
  });

  // Create checklist template item (admin only)
  app.post("/api/checklist-templates", requireAdmin, async (req, res) => {
    try {
      const { label, category, description, isRequired, sortOrder } = req.body;
      const orgId = getOrganizationId(req);
      if (!label || !category) {
        return res.status(400).json({ error: "Etichetta e categoria sono obbligatorie" });
      }
      const item = await storage.createChecklistTemplateItem({
        label,
        category,
        description: description || null,
        isRequired: isRequired !== false,
        sortOrder: sortOrder || 0,
        isActive: true,
        organizationId: orgId || 'croce-europa-default',
      });
      res.json(item);
    } catch (error) {
      console.error("Error creating checklist template:", error);
      res.status(500).json({ error: "Errore nella creazione del template" });
    }
  });

  // Update checklist template item (admin only)
  app.put("/api/checklist-templates/:id", requireAdmin, async (req, res) => {
    try {
      const { label, category, description, isRequired, sortOrder, isActive, expiryDate, expiryAlertDays } = req.body;
      const item = await storage.updateChecklistTemplateItem(req.params.id, {
        label,
        category,
        description,
        isRequired,
        sortOrder,
        isActive,
        expiryDate: expiryDate ? new Date(expiryDate) as any : null,
        expiryAlertDays,
      });
      if (!item) {
        return res.status(404).json({ error: "Template non trovato" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating checklist template:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del template" });
    }
  });

  // Update checklist template item expiry date (admin only) - PATCH
  app.patch("/api/checklist-templates/:id", requireAdmin, async (req, res) => {
    try {
      const { expiryDate, expiryAlertDays } = req.body;
      const item = await storage.updateChecklistTemplateItem(req.params.id, {
        expiryDate: expiryDate ? new Date(expiryDate) as any : null,
        expiryAlertDays: expiryAlertDays || 30,
      });
      if (!item) {
        return res.status(404).json({ error: "Template non trovato" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating checklist template expiry:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento della scadenza" });
    }
  });

  // Update checklist template item expiry date (crew accessible) - for mobile app
  app.post("/api/checklist-templates/:id/update-expiry", requireAuth, async (req, res) => {
    try {
      const { expiryDate, updatedBy, notes, vehicleId, vehicleCode } = req.body;
      
      if (!expiryDate) {
        return res.status(400).json({ error: "Data di scadenza obbligatoria" });
      }
      
      // Get item first to capture old expiry date
      const existingItem = await storage.getChecklistTemplateItem(req.params.id);
      const oldExpiryDate = existingItem?.expiryDate;
      
      // Parse the date (accepts DD/MM/YYYY or YYYY-MM-DD format)
      let parsedDate: Date;
      if (expiryDate.includes('/')) {
        const [day, month, year] = expiryDate.split('/');
        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        parsedDate = new Date(expiryDate);
      }
      
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "Formato data non valido" });
      }
      
      const item = await storage.updateChecklistTemplateItem(req.params.id, {
        expiryDate: parsedDate as any,
        expiryAlertDays: 30,
      });
      
      if (!item) {
        return res.status(404).json({ error: "Articolo non trovato" });
      }
      
      // Save restoration history
      if (vehicleId && vehicleCode) {
        try {
          await db.insert(materialRestorations).values({
            itemId: req.params.id,
            itemLabel: item.label,
            vehicleId,
            vehicleCode,
            oldExpiryDate: oldExpiryDate ? String(oldExpiryDate).split('T')[0] : null,
            newExpiryDate: parsedDate.toISOString().split('T')[0],
            restoredById: req.session.userId || null,
            restoredByName: updatedBy || 'Equipaggio',
            notes: notes || 'Materiale ripristinato',
          });
        } catch (historyError) {
          console.error("Error saving restoration history:", historyError);
        }
      }
      
      console.log(`Expiry date updated for item ${req.params.id} to ${parsedDate.toISOString()} by ${updatedBy || 'crew'}`);
      res.json({ success: true, item });
    } catch (error) {
      console.error("Error updating checklist expiry:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento della scadenza" });
    }
  });
  
  // Get material restorations for a vehicle
  app.get("/api/vehicles/:id/material-restorations", requireAuth, async (req, res) => {
    try {
      const restorations = await db.select()
        .from(materialRestorations)
        .where(eq(materialRestorations.vehicleId, req.params.id))
        .orderBy(desc(materialRestorations.createdAt))
        .limit(20);
      
      res.json(restorations);
    } catch (error) {
      console.error("Error fetching material restorations:", error);
      res.status(500).json({ error: "Errore nel caricamento dei ripristini" });
    }
  });

  // Delete checklist template item (admin only)
  app.delete("/api/checklist-templates/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteChecklistTemplateItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting checklist template:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del template" });
    }
  });

  // Get vehicle checklists history
  app.get("/api/vehicle-checklists/:vehicleId", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const checklists = await storage.getVehicleChecklists(req.params.vehicleId, limit);
      res.json(checklists);
    } catch (error) {
      console.error("Error fetching vehicle checklists:", error);
      res.status(500).json({ error: "Errore nel recupero delle checklist" });
    }
  });

  // Get today's checklist for a vehicle
  app.get("/api/vehicle-checklists/:vehicleId/today", requireAuth, async (req, res) => {
    try {
      const checklist = await storage.getTodayChecklistForVehicle(req.params.vehicleId);
      res.json(checklist || null);
    } catch (error) {
      console.error("Error fetching today's checklist:", error);
      res.status(500).json({ error: "Errore nel recupero della checklist odierna" });
    }
  });

  // Get yesterday's usage for smart reintegration suggestions
  app.get("/api/vehicles/:vehicleId/yesterday-usage", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.vehicleId;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Get yesterday's checklist to find items that were marked as needing restock
      const checklists = await storage.getVehicleChecklistsByDateRange(
        vehicleId,
        yesterdayStr,
        yesterdayStr
      );
      
      const usedItems: string[] = [];
      
      if (checklists && checklists.length > 0) {
        const lastChecklist = checklists[0];
        const items = lastChecklist.items as Array<{ itemId: string; checked: boolean; notes?: string }>;
        
        // Items that were NOT checked in yesterday's checklist might need restock
        // Also items with notes might indicate usage
        items?.forEach(item => {
          if (!item.checked || (item.notes && item.notes.toLowerCase().includes('usato'))) {
            usedItems.push(item.itemId);
          }
        });
      }
      
      // Also check inventory usage logs if available
      const usageLogs = await (storage as any).getInventoryUsageForVehicle?.(vehicleId, yesterdayStr);
      if (usageLogs && Array.isArray(usageLogs)) {
        usageLogs.forEach((log: any) => {
          if (log.itemId && !usedItems.includes(log.itemId)) {
            usedItems.push(log.itemId);
          }
        });
      }
      
      res.json({ usedItems });
    } catch (error) {
      console.error("Error fetching yesterday's usage:", error);
      res.json({ usedItems: [] }); // Return empty array on error, don't fail
    }
  });

  // Submit a vehicle checklist
  app.post("/api/vehicle-checklists", requireAuth, async (req, res) => {
    try {
      const { vehicleId, locationId, items, hasAnomalies, anomalyDescription, generalNotes, submittedByName } = req.body;
      
      if (!vehicleId || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Dati checklist non validi" });
      }

      // Get the user from the request
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Utente non trovato" });
      }

      const orgId = user.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';

      // Check if a checklist already exists for today
      const existingChecklist = await storage.getTodayChecklistForVehicle(vehicleId);
      if (existingChecklist) {
        return res.status(400).json({ error: "Checklist già compilata per oggi" });
      }

      const today = new Date().toISOString().split('T')[0];
      
      const checklist = await storage.createVehicleChecklist({
        vehicleId,
        locationId: locationId || null,
        submittedById: userId,
        submittedByName: submittedByName?.trim() || user.name,
        shiftDate: today,
        items,
        hasAnomalies: hasAnomalies || false,
        anomalyDescription: anomalyDescription || null,
        generalNotes: generalNotes || null,
        completedAt: new Date(),
        organizationId: orgId,
      });

      res.json(checklist);
    } catch (error) {
      console.error("Error submitting checklist:", error);
      res.status(500).json({ error: "Errore nell'invio della checklist" });
    }
  });

  // Update a vehicle checklist (within 12 hours)
  app.put("/api/vehicle-checklists/:checklistId", requireAuth, async (req, res) => {
    try {
      const { checklistId } = req.params;
      const { items, hasAnomalies, anomalyDescription, generalNotes } = req.body;
      
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Dati checklist non validi" });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }

      // Get the existing checklist
      const existingChecklist = await storage.getVehicleChecklistById(checklistId);
      if (!existingChecklist) {
        return res.status(404).json({ error: "Checklist non trovata" });
      }

      // Check if within 12 hours of completion
      const completedAt = existingChecklist.completedAt ? new Date(existingChecklist.completedAt) : null;
      if (!completedAt) {
        return res.status(400).json({ error: "Checklist non valida per la modifica" });
      }

      const now = new Date();
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      if ((now.getTime() - completedAt.getTime()) > twelveHoursMs) {
        return res.status(400).json({ error: "Tempo limite per la modifica scaduto (12 ore)" });
      }

      // Update the checklist
      const updatedChecklist = await storage.updateVehicleChecklist(checklistId, {
        items,
        hasAnomalies: hasAnomalies || false,
        anomalyDescription: anomalyDescription || null,
        generalNotes: generalNotes || null,
        updatedAt: new Date(),
      });

      res.json(updatedChecklist);
    } catch (error) {
      console.error("Error updating checklist:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento della checklist" });
    }
  });

  // Get checklists for monthly report (admin only)
  app.get("/api/vehicle-checklists/report/:year/:month", requireAdmin, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: "Anno o mese non validi" });
      }

      const orgId = getEffectiveOrgId(req);
      const checklists = await storage.getVehicleChecklistsForMonth(year, month, orgId || undefined);
      let filteredChecklists = checklists;
      if (isOrgAdmin(req) && orgId) {
        filteredChecklists = checklists.filter((c: any) => c.organizationId === orgId);
      }
      res.json(filteredChecklists);
    } catch (error) {
      console.error("Error fetching monthly checklists:", error);
      res.status(500).json({ error: "Errore nel recupero delle checklist mensili" });
    }
  });

  // Generate monthly checklist PDF report (admin only)
  app.get("/api/vehicle-checklists/report/:year/:month/pdf", requireAdmin, async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const locationId = req.query.locationId as string | undefined;
      const orgId = getEffectiveOrgId(req);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: "Anno o mese non validi" });
      }

      const checklists = await storage.getVehicleChecklistsForMonth(year, month);
      let orgFilteredChecklists = checklists;
      if (isOrgAdmin(req) && orgId) {
        orgFilteredChecklists = checklists.filter((c: any) => c.organizationId === orgId);
      }
      const allVehicles = await storage.getVehicles();
      const vehicles = orgId && isOrgAdmin(req) ? allVehicles.filter((v: any) => v.organizationId === orgId) : allVehicles;
      const allLocations = await storage.getLocations();
      const locationsList = orgId && isOrgAdmin(req) ? allLocations.filter((l: any) => l.organizationId === orgId) : allLocations;

      // Filter by location if specified
      let filteredChecklists = orgFilteredChecklists;
      let locationName = "Tutte le Sedi";
      if (locationId) {
        filteredChecklists = orgFilteredChecklists.filter(c => c.locationId === locationId);
        const loc = locationsList.find(l => l.id === locationId);
        if (loc) locationName = loc.name;
      }

      // Map checklists to PDF data format
      const submissions = filteredChecklists.map(c => {
        const vehicle = vehicles.find(v => v.id === c.vehicleId);
        return {
          shiftDate: c.shiftDate,
          submittedByName: c.submittedByName,
          vehicleCode: vehicle?.code || "N/A",
          hasAnomalies: c.hasAnomalies || false,
          anomalyDescription: c.anomalyDescription,
          generalNotes: c.generalNotes,
          items: (c.items as any[]) || [],
        };
      });

      const { generateChecklistMonthlyPDF } = await import("../pdf-generator");
      const doc = generateChecklistMonthlyPDF({
        year,
        month,
        locationName,
        submissions,
      });

      const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
      const monthLabel = monthNames[month - 1] || `Mese_${month}`;
      const filename = `Checklist_${monthLabel}_${year}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error("Error generating checklist PDF report:", error);
      res.status(500).json({ error: "Errore nella generazione del report PDF" });
    }
  });

  // Download single checklist as PDF
  app.get("/api/vehicle-checklists/:checklistId/pdf", requireAuth, async (req, res) => {
    try {
      const checklistId = req.params.checklistId;
      const checklist = await storage.getVehicleChecklistById(checklistId);
      
      if (!checklist) {
        return res.status(404).json({ error: "Checklist non trovata" });
      }
      
      const vehicle = await storage.getVehicle(checklist.vehicleId);
      const location = checklist.locationId ? await storage.getLocation(checklist.locationId) : null;
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      // Set response headers
      const dateStr = checklist.shiftDate?.toString() || new Date(checklist.completedAt).toISOString().split('T')[0];
      const vehicleCode = vehicle?.code || 'N-A';
      const filename = `Checklist_${vehicleCode}_${dateStr}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      doc.pipe(res);
      
      // Header with branding
      doc.rect(0, 0, doc.page.width, 80).fill('#1a365d');
      doc.fillColor('white').fontSize(20).text('SOCCORSO DIGITALE', 50, 25, { align: 'left' });
      doc.fontSize(12).text('CHECKLIST PRE-PARTENZA', 50, 50, { align: 'left' });
      
      // Vehicle info box
      doc.fillColor('#1a365d').rect(50, 100, doc.page.width - 100, 70).stroke();
      doc.fillColor('#333').fontSize(11);
      doc.text(`Veicolo: ${vehicle?.code || 'N/D'} - ${vehicle?.licensePlate || 'N/D'}`, 60, 110);
      doc.text(`Sede: ${location?.name || 'N/D'}`, 60, 128);
      doc.text(`Data Turno: ${dateStr}`, 60, 146);
      doc.text(`Compilata da: ${checklist.submittedByName}`, 300, 110);
      doc.text(`Completata: ${new Date(checklist.completedAt).toLocaleString('it-IT')}`, 300, 128);
      
      // Status badge
      const hasAnomalies = checklist.hasAnomalies;
      const statusColor = hasAnomalies ? '#e53e3e' : '#38a169';
      const statusText = hasAnomalies ? 'ANOMALIE RILEVATE' : 'CONFORME';
      doc.fillColor(statusColor).fontSize(10).text(statusText, 300, 146);
      
      // Checklist items
      doc.fillColor('#1a365d').fontSize(14).text('Voci Checklist', 50, 190);
      doc.moveTo(50, 210).lineTo(doc.page.width - 50, 210).stroke('#ddd');
      
      let yPos = 225;
      const items = (checklist.items as any[]) || [];
      
      items.forEach((item, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        const checkIcon = item.checked ? '✓' : '✗';
        const checkColor = item.checked ? '#38a169' : '#e53e3e';
        
        doc.fillColor(checkColor).fontSize(12).text(checkIcon, 55, yPos);
        doc.fillColor('#333').fontSize(10).text(item.label || item.itemLabel || `Item ${index + 1}`, 80, yPos);
        
        if (item.category) {
          doc.fillColor('#666').fontSize(8).text(`[${item.category}]`, 400, yPos);
        }
        
        if (item.notes) {
          yPos += 15;
          doc.fillColor('#666').fontSize(8).text(`Note: ${item.notes}`, 80, yPos);
        }
        
        yPos += 20;
      });
      
      // Anomaly description
      if (hasAnomalies && checklist.anomalyDescription) {
        yPos += 20;
        doc.fillColor('#e53e3e').fontSize(12).text('Descrizione Anomalie:', 50, yPos);
        yPos += 18;
        doc.fillColor('#333').fontSize(10).text(checklist.anomalyDescription, 50, yPos, { width: doc.page.width - 100 });
      }
      
      // General notes
      if (checklist.generalNotes) {
        yPos += 40;
        doc.fillColor('#1a365d').fontSize(12).text('Note Generali:', 50, yPos);
        yPos += 18;
        doc.fillColor('#333').fontSize(10).text(checklist.generalNotes, 50, yPos, { width: doc.page.width - 100 });
      }
      
      // Footer
      doc.fontSize(8).fillColor('#999').text(
        `Documento generato automaticamente - ${new Date().toLocaleString('it-IT')}`,
        50,
        doc.page.height - 50,
        { align: 'center', width: doc.page.width - 100 }
      );
      
      doc.end();
    } catch (error) {
      console.error("Error generating checklist PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF" });
    }
  });

  // ========== CHAT INTERNA ==========
  
  // Get chat messages
  app.get("/api/chat/messages", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const before = req.query.before as string | undefined;
      const messages = await storage.getChatMessages(limit, before);
      // Return in chronological order (oldest first) for display
      res.json(messages.reverse());
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ error: "Errore nel recupero dei messaggi" });
    }
  });
  
  // Send a chat message
  app.post("/api/chat/messages", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Utente non trovato" });
      }
      
      const { message, vehicleId, isPriority } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Messaggio vuoto" });
      }
      
      // Get vehicle and location info if available
      let senderVehicleCode: string | undefined;
      let senderLocationId: string | undefined;
      let senderLocationName: string | undefined;
      
      if (vehicleId) {
        const vehicle = await storage.getVehicle(vehicleId);
        if (vehicle) {
          senderVehicleCode = vehicle.code;
          senderLocationId = vehicle.locationId;
          const location = await storage.getLocation(vehicle.locationId);
          if (location) {
            senderLocationName = location.name;
          }
        }
      } else if (user.locationId) {
        senderLocationId = user.locationId;
        const location = await storage.getLocation(user.locationId);
        if (location) {
          senderLocationName = location.name;
        }
      }
      
      const newMessage = await storage.createChatMessage({
        senderId: userId,
        senderName: user.name,
        senderVehicleId: vehicleId || null,
        senderVehicleCode: senderVehicleCode || null,
        senderLocationId: senderLocationId || null,
        senderLocationName: senderLocationName || null,
        message: message.trim(),
        messageType: "text",
        isPriority: isPriority || false,
      });
      
      // Broadcast to all connected WebSocket clients
      broadcastMessage({ type: "new_message", message: newMessage });
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ error: "Errore nell'invio del messaggio" });
    }
  });
  
  // Delete a chat message (admin only)
  app.delete("/api/chat/messages/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteChatMessage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat message:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del messaggio" });
    }
  });
  
  // Get unread count for current user
  app.get("/api/chat/unread", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      const count = await storage.getUnreadCountForUser(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Errore nel recupero messaggi non letti" });
    }
  });
  
  // Mark messages as read
  app.post("/api/chat/read", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      const { messageIds } = req.body;
      if (Array.isArray(messageIds)) {
        await storage.markMessagesAsRead(userId, messageIds);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Errore nel segnare i messaggi come letti" });
    }
  });
  
  // Get readers for a specific message
  app.get("/api/chat/messages/:id/readers", requireAuth, async (req, res) => {
    try {
      const readers = await storage.getMessageReaders(req.params.id);
      res.json(readers);
    } catch (error) {
      console.error("Error fetching message readers:", error);
      res.status(500).json({ error: "Errore nel recupero lettori del messaggio" });
    }
  });

  // ========== HANDOFF CONSEGNE ==========
  
  // Get pending handoff for vehicle
  app.get("/api/handoffs/pending/:vehicleId", requireAuth, async (req, res) => {
    try {
      const handoff = await storage.getPendingHandoffForVehicle(req.params.vehicleId);
      res.json(handoff || null);
    } catch (error) {
      console.error("Error fetching pending handoff:", error);
      res.status(500).json({ error: "Errore nel recupero consegna" });
    }
  });
  
  // Get handoff history for vehicle
  app.get("/api/handoffs/vehicle/:vehicleId", requireAuth, async (req, res) => {
    try {
      const handoffs = await storage.getHandoffsForVehicle(req.params.vehicleId);
      res.json(handoffs);
    } catch (error) {
      console.error("Error fetching handoff history:", error);
      res.status(500).json({ error: "Errore nel recupero storico consegne" });
    }
  });
  
  // Create a new handoff
  app.post("/api/handoffs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Utente non trovato" });
      }

      const orgId = user.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';
      
      const { vehicleId, message, priority, category, kmFine, createdByName: submitterName } = req.body;
      
      if (!vehicleId || !message || message.trim().length === 0) {
        return res.status(400).json({ error: "Veicolo e messaggio obbligatori" });
      }

      if (!submitterName || submitterName.trim().length === 0) {
        return res.status(400).json({ error: "Nome e cognome obbligatorio" });
      }
      
      // Get vehicle code
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      
      const handoff = await storage.createHandoff({
        vehicleId,
        vehicleCode: vehicle.code,
        createdByUserId: userId,
        createdByName: submitterName.trim(),
        message: message.trim(),
        priority: priority || "normal",
        category: category || "general",
        kmAtHandoff: kmFine || null,
        organizationId: orgId,
        locationId: user.locationId || vehicle.locationId || null,
      });
      
      res.status(201).json(handoff);
    } catch (error) {
      console.error("Error creating handoff:", error);
      res.status(500).json({ error: "Errore nella creazione consegna" });
    }
  });
  
  // Mark handoff as read
  app.post("/api/handoffs/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Utente non trovato" });
      }

      const { readerName } = req.body || {};
      if (!readerName || !readerName.trim()) {
        return res.status(400).json({ error: "Nome e cognome obbligatorio per confermare la lettura" });
      }
      
      const handoff = await storage.markHandoffAsRead(
        req.params.id, 
        userId, 
        readerName.trim()
      );
      
      res.json(handoff);
    } catch (error) {
      console.error("Error marking handoff as read:", error);
      res.status(500).json({ error: "Errore nella conferma lettura" });
    }
  });
  
  // Archive handoff
  app.post("/api/handoffs/:id/archive", requireAuth, async (req, res) => {
    try {
      await storage.archiveHandoff(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving handoff:", error);
      res.status(500).json({ error: "Errore nell'archiviazione consegna" });
    }
  });

  // Get all handoffs for admin panel with filters
  app.get("/api/admin/handoffs", requireAdmin, async (req, res) => {
    try {
      const { vehicleId, locationId, status, startDate, endDate } = req.query;
      
      const orgId = getEffectiveOrgId(req);
      const isOrg = isOrgAdmin(req) && orgId;
      
      // Get all handoffs from database (filtered by org if org_admin)
      const handoffConditions: any[] = [];
      if (isOrg) {
        handoffConditions.push(eq(handoffs.organizationId, orgId!));
      }
      const allHandoffs = await db.select({
        id: handoffs.id,
        vehicleId: handoffs.vehicleId,
        vehicleCode: handoffs.vehicleCode,
        locationId: handoffs.locationId,
        createdByUserId: handoffs.createdByUserId,
        createdByName: handoffs.createdByName,
        message: handoffs.message,
        priority: handoffs.priority,
        category: handoffs.category,
        kmAtHandoff: handoffs.kmAtHandoff,
        status: handoffs.status,
        readByUserId: handoffs.readByUserId,
        readByName: handoffs.readByName,
        readAt: handoffs.readAt,
        createdAt: handoffs.createdAt,
        expiresAt: handoffs.expiresAt,
      })
      .from(handoffs)
      .where(handoffConditions.length > 0 ? and(...handoffConditions) : undefined)
      .orderBy(desc(handoffs.createdAt));
      
      // Get vehicle location mapping (filtered by org if org_admin)
      const vehiclesList = isOrg
        ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId!))
        : await storage.getVehicles();
      const vehicleLocationMap: Record<string, string> = {};
      const vehicleLocationNameMap: Record<string, string> = {};
      const orgVehicleIds = new Set(vehiclesList.map(v => v.id));
      for (const v of vehiclesList) {
        vehicleLocationMap[v.id] = v.locationId;
      }
      
      // Get locations for names
      const locationsList = isOrg
        ? await db.select().from(locations).where(eq(locations.organizationId, orgId!))
        : await storage.getLocations();
      const locationNameMap: Record<string, string> = {};
      for (const loc of locationsList) {
        locationNameMap[loc.id] = loc.name;
      }
      
      // Map vehicle to location name
      for (const v of vehiclesList) {
        vehicleLocationNameMap[v.id] = locationNameMap[v.locationId] || "";
      }
      
      // Apply filters
      let filtered = allHandoffs
        .map(h => ({
          ...h,
          locationId: h.locationId || vehicleLocationMap[h.vehicleId] || "",
          locationName: vehicleLocationNameMap[h.vehicleId] || "",
        }));
      
      if (vehicleId && typeof vehicleId === "string") {
        filtered = filtered.filter(h => h.vehicleId === vehicleId);
      }
      
      if (locationId && typeof locationId === "string") {
        filtered = filtered.filter(h => h.locationId === locationId);
      }
      
      if (status && typeof status === "string") {
        filtered = filtered.filter(h => h.status === status);
      }
      
      if (startDate && typeof startDate === "string") {
        const start = new Date(startDate);
        filtered = filtered.filter(h => new Date(h.createdAt) >= start);
      }
      
      if (endDate && typeof endDate === "string") {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(h => new Date(h.createdAt) <= end);
      }
      
      res.json(filtered);
    } catch (error) {
      console.error("Error getting admin handoffs:", error);
      res.status(500).json({ error: "Errore nel caricamento consegne" });
    }
  });

  // ============================================
  // CHECKLIST PHOTO REPORTS
  // ============================================

  app.post("/api/checklist-photos", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ error: "Utente non trovato" });
      
      const { description, photoBase64, checklistId, submitterName } = req.body;
      
      if (!photoBase64 || typeof photoBase64 !== "string") {
        return res.status(400).json({ error: "Foto mancante" });
      }

      if (photoBase64.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Foto troppo grande (max 10MB)" });
      }

      if (!submitterName || typeof submitterName !== "string" || submitterName.trim().length < 2) {
        return res.status(400).json({ error: "Inserisci il tuo nome e cognome" });
      }
      
      const vehicleId = user.vehicleId;
      const vehicle = vehicleId ? await storage.getVehicle(vehicleId) : null;
      
      const orgId = user.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';

      const [photo] = await db.insert(checklistPhotos).values({
        vehicleId: vehicleId || "unknown",
        vehicleCode: vehicle?.code || "N/A",
        locationId: user.locationId || null,
        checklistId: checklistId || null,
        submittedById: userId,
        submittedByName: submitterName.trim(),
        description: description?.trim() || null,
        photoData: photoBase64,
        photoMimeType: "image/jpeg",
        organizationId: orgId,
      }).returning();
      
      console.log(`[Checklist Photo] New report from ${submitterName.trim()} (${vehicle?.code || "N/A"}): ${description || "no description"}`);
      
      res.json({ id: photo.id, message: "Foto inviata con successo" });
    } catch (error) {
      console.error("Error uploading checklist photo:", error);
      res.status(500).json({ error: "Errore nell'invio della foto" });
    }
  });

  app.get("/api/checklist-photos/image/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [photo] = await db.select({
        photoData: checklistPhotos.photoData,
        photoMimeType: checklistPhotos.photoMimeType,
      }).from(checklistPhotos).where(eq(checklistPhotos.id, id)).limit(1);
      
      if (!photo) return res.status(404).json({ error: "Foto non trovata" });
      
      const buffer = Buffer.from(photo.photoData, "base64");
      res.setHeader("Content-Type", photo.photoMimeType || "image/jpeg");
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);
    } catch (error) {
      console.error("Error serving checklist photo:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/admin/checklist-photos", requireAdmin, async (req, res) => {
    try {
      const photoFields = {
        id: checklistPhotos.id,
        vehicleId: checklistPhotos.vehicleId,
        vehicleCode: checklistPhotos.vehicleCode,
        submittedByName: checklistPhotos.submittedByName,
        submittedById: checklistPhotos.submittedById,
        description: checklistPhotos.description,
        isRead: checklistPhotos.isRead,
        readByName: checklistPhotos.readByName,
        readAt: checklistPhotos.readAt,
        isResolved: checklistPhotos.isResolved,
        resolvedByName: checklistPhotos.resolvedByName,
        resolvedAt: checklistPhotos.resolvedAt,
        resolvedNotes: checklistPhotos.resolvedNotes,
        createdAt: checklistPhotos.createdAt,
      };
      
      // Org filtering: restrict to org's vehicles
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const orgVehicles = await db.select({ id: vehiclesTable.id }).from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId));
        const orgVehicleIds = orgVehicles.map(v => v.id);
        if (orgVehicleIds.length === 0) return res.json([]);
        
        const photos = await db.select(photoFields).from(checklistPhotos)
          .where(sql`${checklistPhotos.vehicleId} IN (${sql.join(orgVehicleIds.map(id => sql`${id}`), sql`, `)})`)
          .orderBy(desc(checklistPhotos.createdAt))
          .limit(200);
        return res.json(photos);
      }
      
      const photos = await db.select(photoFields).from(checklistPhotos)
        .orderBy(desc(checklistPhotos.createdAt))
        .limit(200);
      
      res.json(photos);
    } catch (error) {
      console.error("Error fetching checklist photos:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/admin/checklist-photos/unread-count", requireAdmin, async (req, res) => {
    try {
      // Org filtering
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const orgVehicles = await db.select({ id: vehiclesTable.id }).from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId));
        const orgVehicleIds = orgVehicles.map(v => v.id);
        if (orgVehicleIds.length === 0) return res.json({ count: 0 });
        
        const [result] = await db.select({
          count: sql<number>`COUNT(*)::int`,
        }).from(checklistPhotos)
          .where(and(
            eq(checklistPhotos.isRead, false),
            sql`${checklistPhotos.vehicleId} IN (${sql.join(orgVehicleIds.map(id => sql`${id}`), sql`, `)})`
          ));
        return res.json({ count: result?.count || 0 });
      }
      
      const [result] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(checklistPhotos)
        .where(eq(checklistPhotos.isRead, false));
      
      res.json({ count: result?.count || 0 });
    } catch (error) {
      res.json({ count: 0 });
    }
  });

  app.patch("/api/admin/checklist-photos/:id/read", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      await db.update(checklistPhotos)
        .set({ 
          isRead: true,
          readByName: user?.name || "Admin",
          readAt: new Date(),
        })
        .where(eq(checklistPhotos.id, req.params.id));
      res.json({ success: true, readByName: user?.name || "Admin" });
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.patch("/api/admin/checklist-photos/:id/resolve", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const { notes } = req.body;
      
      await db.update(checklistPhotos)
        .set({
          isResolved: true,
          isRead: true,
          resolvedByName: user?.name || "Admin",
          resolvedAt: new Date(),
          resolvedNotes: notes || null,
        })
        .where(eq(checklistPhotos.id, req.params.id));
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.patch("/api/admin/checklist-photos/:id/status", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const { status, notes } = req.body;
      
      if (!status || !["nuova", "presa_visione", "risolta"].includes(status)) {
        return res.status(400).json({ error: "Stato non valido" });
      }

      const updateData: any = {};
      
      if (status === "nuova") {
        updateData.isRead = false;
        updateData.isResolved = false;
        updateData.resolvedByName = null;
        updateData.resolvedAt = null;
        updateData.resolvedNotes = null;
        updateData.readByName = null;
        updateData.readAt = null;
      } else if (status === "presa_visione") {
        updateData.isRead = true;
        updateData.readByName = user?.name || "Admin";
        updateData.readAt = new Date();
        updateData.isResolved = false;
        updateData.resolvedByName = null;
        updateData.resolvedAt = null;
        updateData.resolvedNotes = notes || null;
      } else if (status === "risolta") {
        updateData.isRead = true;
        updateData.isResolved = true;
        updateData.readByName = updateData.readByName || user?.name || "Admin";
        updateData.readAt = updateData.readAt || new Date();
        updateData.resolvedByName = user?.name || "Admin";
        updateData.resolvedAt = new Date();
        updateData.resolvedNotes = notes || null;
      }

      await db.update(checklistPhotos)
        .set(updateData)
        .where(eq(checklistPhotos.id, req.params.id));
      
      console.log(`[Photo Report] Status changed to ${status} by ${user?.name || "Admin"} for report ${req.params.id}`);
      res.json({ success: true, status, isRead: updateData.isRead ?? false, isResolved: updateData.isResolved ?? false, resolvedByName: updateData.resolvedByName || null });
    } catch (error) {
      console.error("Error updating report status:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dello stato" });
    }
  });

  // --- Photo Report Messages (two-way messaging) ---

  app.get("/api/checklist-photos/:id/messages", requireAuth, async (req, res) => {
    try {
      const messages = await db.select()
        .from(photoReportMessages)
        .where(eq(photoReportMessages.photoReportId, req.params.id))
        .orderBy(photoReportMessages.createdAt);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.post("/api/admin/checklist-photos/:id/message", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const { message } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Messaggio vuoto" });
      }
      const [msg] = await db.insert(photoReportMessages).values({
        photoReportId: req.params.id,
        senderType: "admin",
        senderName: user?.name || "Admin",
        senderId: userId || "admin",
        message: message.trim(),
        isReadByAdmin: true,
        isReadByCrew: false,
      }).returning();
      console.log(`[Photo Report] Admin ${user?.name} sent message on report ${req.params.id}`);
      res.json(msg);
    } catch (error) {
      console.error("Error sending photo report message:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.post("/api/checklist-photos/:id/message", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const { message, senderName } = req.body;
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Messaggio vuoto" });
      }
      const [msg] = await db.insert(photoReportMessages).values({
        photoReportId: req.params.id,
        senderType: "crew",
        senderName: senderName?.trim() || user?.name || "Equipaggio",
        senderId: userId || "unknown",
        message: message.trim(),
        isReadByCrew: true,
        isReadByAdmin: false,
      }).returning();
      res.json(msg);
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.post("/api/checklist-photos/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const reportId = req.params.id;
      console.log(`[MarkRead POST] Marking messages as read for report: ${reportId}`);
      await db.update(photoReportMessages)
        .set({ isReadByCrew: true })
        .where(and(
          eq(photoReportMessages.photoReportId, reportId),
          eq(photoReportMessages.senderType, "admin"),
        ));
      res.json({ success: true });
    } catch (error) {
      console.error("[MarkRead POST] Error:", error);
      res.status(500).json({ error: "Errore interno" });
    }
  });

  app.get("/api/checklist-photos/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const reportId = req.params.id;
      console.log(`[MarkRead GET] Marking messages as read for report: ${reportId}`);
      await db.update(photoReportMessages)
        .set({ isReadByCrew: true })
        .where(and(
          eq(photoReportMessages.photoReportId, reportId),
          eq(photoReportMessages.senderType, "admin"),
        ));
      res.json({ success: true, markedRead: reportId });
    } catch (error) {
      console.error("[MarkRead GET] Error:", error);
      res.status(500).json({ error: "Errore interno" });
    }
  });

  app.get("/api/checklist-photos/my-reports", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ error: "Utente non trovato" });

      const vehicleId = user.vehicleId;
      if (!vehicleId) return res.json([]);

      const markReadId = req.query.markRead as string | undefined;
      if (markReadId) {
        console.log(`[MarkRead] Marking messages as read for report: ${markReadId}`);
        const markResult = await db.update(photoReportMessages)
          .set({ isReadByCrew: true })
          .where(and(
            eq(photoReportMessages.photoReportId, markReadId),
            eq(photoReportMessages.senderType, "admin"),
          ));
        console.log(`[MarkRead] Update result:`, markResult);
      }

      const reports = await db.select({
        id: checklistPhotos.id,
        vehicleCode: checklistPhotos.vehicleCode,
        submittedByName: checklistPhotos.submittedByName,
        description: checklistPhotos.description,
        isRead: checklistPhotos.isRead,
        readByName: checklistPhotos.readByName,
        readAt: checklistPhotos.readAt,
        isResolved: checklistPhotos.isResolved,
        resolvedByName: checklistPhotos.resolvedByName,
        resolvedAt: checklistPhotos.resolvedAt,
        resolvedNotes: checklistPhotos.resolvedNotes,
        createdAt: checklistPhotos.createdAt,
      }).from(checklistPhotos)
        .where(eq(checklistPhotos.vehicleId, vehicleId))
        .orderBy(desc(checklistPhotos.createdAt))
        .limit(50);

      const reportsWithMessages = await Promise.all(reports.map(async (report) => {
        const messages = await db.select()
          .from(photoReportMessages)
          .where(eq(photoReportMessages.photoReportId, report.id))
          .orderBy(photoReportMessages.createdAt);
        const unreadCount = messages.filter(m => m.senderType === "admin" && !m.isReadByCrew).length;
        return { ...report, messages, unreadAdminMessages: unreadCount };
      }));

      res.json(reportsWithMessages);
    } catch (error) {
      console.error("Error fetching my reports:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.patch("/api/checklist-photos/:id/messages/mark-read", requireAuth, async (req, res) => {
    try {
      const result = await db.update(photoReportMessages)
        .set({ isReadByCrew: true })
        .where(and(
          eq(photoReportMessages.photoReportId, req.params.id),
          eq(photoReportMessages.senderType, "admin"),
        )).returning();
      console.log(`[Photo Report] Marked ${result.length} admin messages as read for report ${req.params.id}`);
      res.json({ success: true, marked: result.length });
    } catch (error) {
      console.error("[Photo Report] Error marking messages read:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/admin/checklist-photos/:id/messages", requireAdmin, async (req, res) => {
    try {
      const messages = await db.select()
        .from(photoReportMessages)
        .where(eq(photoReportMessages.photoReportId, req.params.id))
        .orderBy(photoReportMessages.createdAt);
      await db.update(photoReportMessages)
        .set({ isReadByAdmin: true })
        .where(and(
          eq(photoReportMessages.photoReportId, req.params.id),
          eq(photoReportMessages.senderType, "crew"),
        ));
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  // ============================================
  // FUEL, VEHICLE DOCS, SANITIZATION, RESCUE SHEETS
  // ============================================

  app.get("/api/fuel-analytics", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.query.vehicleId as string;
      if (!vehicleId) return res.status(400).json({ error: "vehicleId richiesto" });

      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
      if (!vehicle) return res.status(404).json({ error: "Veicolo non trovato" });

      const consumptionRate = vehicle.fuelConsumptionPer100km || 18;

      const allTrips = await db.select({
        id: trips.id,
        serviceDate: trips.serviceDate,
        kmTraveled: trips.kmTraveled,
        kmInitial: trips.kmInitial,
        kmFinal: trips.kmFinal,
        durationMinutes: trips.durationMinutes,
      }).from(trips).where(eq(trips.vehicleId, vehicleId)).orderBy(desc(trips.serviceDate));

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const totalKmAllTime = allTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0);

      const thisMonthTrips = allTrips.filter(t => {
        const d = new Date(t.serviceDate);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
      const thisMonthKm = thisMonthTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0);

      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      const lastMonthTrips = allTrips.filter(t => {
        const d = new Date(t.serviceDate);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      });
      const lastMonthKm = lastMonthTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0);

      const thisYearTrips = allTrips.filter(t => {
        const d = new Date(t.serviceDate);
        return d.getFullYear() === thisYear;
      });
      const thisYearKm = thisYearTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0);

      const estimatedLitersThisMonth = (thisMonthKm / 100) * consumptionRate;
      const estimatedLitersLastMonth = (lastMonthKm / 100) * consumptionRate;
      const estimatedLitersThisYear = (thisYearKm / 100) * consumptionRate;
      const estimatedLitersAllTime = (totalKmAllTime / 100) * consumptionRate;

      let avgFuelPrice = 1.589;
      try {
        const prices = await db.select().from(fuelPrices)
          .where(eq(fuelPrices.province, "VR"))
          .orderBy(desc(fuelPrices.date))
          .limit(10);
        if (prices.length > 0) {
          const validPrices = prices.filter(p => p.selfServicePrice && p.selfServicePrice > 0);
          if (validPrices.length > 0) {
            avgFuelPrice = validPrices.reduce((s, p) => s + (p.selfServicePrice || 0), 0) / validPrices.length;
          }
        }
      } catch(e) { /* use fallback */ }

      const monthlyBreakdown = [];
      for (let i = 5; i >= 0; i--) {
        const m = new Date(thisYear, thisMonth - i, 1);
        const monthNum = m.getMonth();
        const yearNum = m.getFullYear();
        const monthTrips = allTrips.filter(t => {
          const d = new Date(t.serviceDate);
          return d.getMonth() === monthNum && d.getFullYear() === yearNum;
        });
        const km = monthTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0);
        const liters = (km / 100) * consumptionRate;
        const cost = liters * avgFuelPrice;
        monthlyBreakdown.push({
          month: m.toLocaleDateString("it-IT", { month: "short" }).toUpperCase(),
          year: yearNum,
          trips: monthTrips.length,
          km: Math.round(km),
          estimatedLiters: Math.round(liters * 10) / 10,
          estimatedCost: Math.round(cost * 100) / 100,
        });
      }

      const co2PerLiter = 2.68;
      const co2ThisMonth = estimatedLitersThisMonth * co2PerLiter;
      const co2ThisYear = estimatedLitersThisYear * co2PerLiter;

      res.json({
        vehicle: {
          code: vehicle.code,
          model: vehicle.model || "N/D",
          fuelType: vehicle.fuelType || "Gasolio",
          currentKm: vehicle.currentKm || 0,
          consumptionRate,
        },
        thisMonth: {
          km: Math.round(thisMonthKm),
          trips: thisMonthTrips.length,
          estimatedLiters: Math.round(estimatedLitersThisMonth * 10) / 10,
          estimatedCost: Math.round(estimatedLitersThisMonth * avgFuelPrice * 100) / 100,
        },
        lastMonth: {
          km: Math.round(lastMonthKm),
          trips: lastMonthTrips.length,
          estimatedLiters: Math.round(estimatedLitersLastMonth * 10) / 10,
          estimatedCost: Math.round(estimatedLitersLastMonth * avgFuelPrice * 100) / 100,
        },
        thisYear: {
          km: Math.round(thisYearKm),
          trips: thisYearTrips.length,
          estimatedLiters: Math.round(estimatedLitersThisYear * 10) / 10,
          estimatedCost: Math.round(estimatedLitersThisYear * avgFuelPrice * 100) / 100,
        },
        allTime: {
          km: Math.round(totalKmAllTime),
          trips: allTrips.length,
          estimatedLiters: Math.round(estimatedLitersAllTime * 10) / 10,
          estimatedCost: Math.round(estimatedLitersAllTime * avgFuelPrice * 100) / 100,
        },
        monthlyBreakdown,
        fuelPrice: Math.round(avgFuelPrice * 1000) / 1000,
        co2: {
          thisMonth: Math.round(co2ThisMonth * 10) / 10,
          thisYear: Math.round(co2ThisYear * 10) / 10,
        },
        kmPerTrip: allTrips.length > 0 ? Math.round(totalKmAllTime / allTrips.length * 10) / 10 : 0,
      });
    } catch (error) {
      console.error("Error computing fuel analytics:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================
  // FUEL CARDS - Tessere Carburante
  // ============================================================
  
  app.get("/api/fuel-cards", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.query.vehicleId as string;
      const orgId = getEffectiveOrgId(req);
      let conditions: any[] = [];
      if (orgId) conditions.push(eq(fuelCards.organizationId, orgId));
      if (vehicleId) conditions.push(eq(fuelCards.vehicleId, vehicleId));
      
      const cards = conditions.length > 0
        ? await db.select().from(fuelCards).where(and(...conditions))
        : await db.select().from(fuelCards);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching fuel cards:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/fuel-cards", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const orgId = user?.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';
      const [card] = await db.insert(fuelCards).values({ ...req.body, organizationId: orgId }).returning();
      res.json(card);
    } catch (error) {
      console.error("Error creating fuel card:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/fuel-cards/:id", requireAdmin, async (req, res) => {
    try {
      const [card] = await db.update(fuelCards).set(req.body).where(eq(fuelCards.id, req.params.id)).returning();
      res.json(card);
    } catch (error) {
      console.error("Error updating fuel card:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================
  // FUEL ENTRIES - Rifornimenti
  // ============================================================
  
  app.get("/api/fuel-entries", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.query.vehicleId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const conditions: any[] = [eq(fuelEntries.organizationId, orgId)];
        if (vehicleId) conditions.push(eq(fuelEntries.vehicleId, vehicleId));
        const entries = await db.select().from(fuelEntries).where(and(...conditions)).orderBy(desc(fuelEntries.date)).limit(limit);
        return res.json(entries);
      }
      let query: any = db.select().from(fuelEntries).orderBy(desc(fuelEntries.date)).limit(limit);
      if (vehicleId) {
        query = db.select().from(fuelEntries).where(eq(fuelEntries.vehicleId, vehicleId)).orderBy(desc(fuelEntries.date)).limit(limit);
      }
      const entries = await query;
      res.json(entries);
    } catch (error) {
      console.error("Error fetching fuel entries:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/fuel-entries/stats", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.query.vehicleId as string;
      if (!vehicleId) return res.status(400).json({ error: "vehicleId richiesto" });
      
      const entries = await db.select().from(fuelEntries)
        .where(eq(fuelEntries.vehicleId, vehicleId))
        .orderBy(desc(fuelEntries.date));
      
      const totalLiters = entries.reduce((s, e) => s + (e.liters || 0), 0);
      const totalCost = entries.reduce((s, e) => s + (e.totalCost || 0), 0);
      const totalEntries = entries.length;
      
      let avgConsumption = 0;
      if (entries.length >= 2) {
        const sorted = entries.filter(e => e.kmAtRefuel).sort((a, b) => (a.kmAtRefuel || 0) - (b.kmAtRefuel || 0));
        if (sorted.length >= 2) {
          const kmDiff = (sorted[sorted.length - 1].kmAtRefuel || 0) - (sorted[0].kmAtRefuel || 0);
          const litersUsed = sorted.slice(1).reduce((s, e) => s + (e.liters || 0), 0);
          if (kmDiff > 0) avgConsumption = (litersUsed / kmDiff) * 100;
        }
      }
      
      const avgPricePerLiter = entries.length > 0 
        ? entries.reduce((s, e) => s + (e.pricePerLiter || 0), 0) / entries.filter(e => e.pricePerLiter).length 
        : 0;
      
      const last30Days = entries.filter(e => {
        const d = new Date(e.date);
        const now = new Date();
        return (now.getTime() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
      });
      
      res.json({
        totalEntries,
        totalLiters: Math.round(totalLiters * 10) / 10,
        totalCost: Math.round(totalCost * 100) / 100,
        avgConsumption: Math.round(avgConsumption * 10) / 10,
        avgPricePerLiter: Math.round(avgPricePerLiter * 1000) / 1000,
        last30Days: {
          entries: last30Days.length,
          liters: Math.round(last30Days.reduce((s, e) => s + (e.liters || 0), 0) * 10) / 10,
          cost: Math.round(last30Days.reduce((s, e) => s + (e.totalCost || 0), 0) * 100) / 100,
        },
      });
    } catch (error) {
      console.error("Error fetching fuel stats:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/fuel-entries", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entryData = { ...req.body, createdBy: userId };
      if (entryData.liters && entryData.pricePerLiter && !entryData.totalCost) {
        entryData.totalCost = Math.round(entryData.liters * entryData.pricePerLiter * 100) / 100;
      }
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        entryData.organizationId = orgId;
      }
      const [entry] = await db.insert(fuelEntries).values(entryData).returning();
      res.json(entry);
    } catch (error) {
      console.error("Error creating fuel entry:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/fuel-entries/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(fuelEntries).where(eq(fuelEntries.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting fuel entry:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================
  // SHIFT LOGS - Diario di Bordo
  // ============================================================
  
  app.get("/api/shift-logs", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.query.vehicleId as string;
      const date = req.query.date as string;
      
      if (!vehicleId) return res.status(400).json({ error: "vehicleId richiesto" });
      
      let conditions = [eq(shiftLogs.vehicleId, vehicleId)];
      if (date) {
        conditions.push(sql`${shiftLogs.shiftDate}::text = ${date}`);
      }
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        conditions.push(eq(shiftLogs.organizationId, orgId));
      }
      
      const logs = await db.select().from(shiftLogs)
        .where(and(...conditions))
        .orderBy(desc(shiftLogs.shiftDate), desc(shiftLogs.eventTime));
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching shift logs:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/shift-logs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const orgId = user?.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';
      const logData = { ...req.body, userId, organizationId: orgId };
      const [log] = await db.insert(shiftLogs).values(logData).returning();
      res.json(log);
    } catch (error) {
      console.error("Error creating shift log:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/shift-logs/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(shiftLogs).where(eq(shiftLogs.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting shift log:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================
  // FUEL PRICES - Prezzi Carburante (Auto-fetch from MIMIT)
  // ============================================================
  
  app.get("/api/fuel-prices", requireAuth, async (req, res) => {
    try {
      const province = (req.query.province as string) || "VR";
      const todayStr = new Date().toISOString().split('T')[0];
      
      let prices = await db.select().from(fuelPrices)
        .where(and(
          eq(fuelPrices.province, province),
          sql`${fuelPrices.date}::text = ${todayStr}`
        ))
        .orderBy(fuelPrices.selfServicePrice);
      
      if (prices.length === 0) {
        await fetchAndStoreFuelPrices(province);
        prices = await db.select().from(fuelPrices)
          .where(and(
            eq(fuelPrices.province, province),
            sql`${fuelPrices.date}::text = ${todayStr}`
          ))
          .orderBy(fuelPrices.selfServicePrice);
      }
      
      const loroStations = prices.filter(p => p.brandName?.toLowerCase().includes('loro'));
      const avgSelf = prices.filter(p => p.selfServicePrice).reduce((s, p) => s + (p.selfServicePrice || 0), 0) / (prices.filter(p => p.selfServicePrice).length || 1);
      const avgFull = prices.filter(p => p.fullServicePrice).reduce((s, p) => s + (p.fullServicePrice || 0), 0) / (prices.filter(p => p.fullServicePrice).length || 1);
      
      res.json({
        date: todayStr,
        province,
        stationsCount: prices.length,
        averages: {
          selfService: Math.round(avgSelf * 1000) / 1000,
          fullService: Math.round(avgFull * 1000) / 1000,
        },
        loroStations,
        allStations: prices.slice(0, 20),
      });
    } catch (error) {
      console.error("Error fetching fuel prices:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });
  
  async function fetchAndStoreFuelPrices(province: string) {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const provincePages: Record<string, string> = {
        "VR": "veneto/verona",
        "VI": "veneto/vicenza",
        "PD": "veneto/padova",
        "VE": "veneto/venezia",
        "TV": "veneto/treviso",
        "MN": "lombardia/mantova",
      };
      const pagePath = provincePages[province] || "veneto/verona";
      const url = `https://www.alvolante.it/prezzo-gasolio/${pagePath}`;
      
      console.log(`[Fuel Prices] Fetching from alVolante: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'it-IT,it;q=0.9',
          },
          signal: AbortSignal.timeout(15000),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const inserts: any[] = [];
        
        $('table tbody tr').each((_i, row) => {
          const cells = $(row).find('td');
          if (cells.length < 6) return;
          
          const imgSrc = $(cells[0]).find('img').attr('src') || '';
          const stationName = $(cells[1]).find('a').first().text().trim();
          const address = $(cells[2]).text().trim();
          const comune = $(cells[3]).text().trim();
          const gasolioText = $(cells[5]).text().trim();
          
          const gasolioPrice = parseFloat(gasolioText.replace(',', '.'));
          if (isNaN(gasolioPrice) || gasolioPrice <= 0) return;
          
          let brandName = "Altro";
          const imgLower = imgSrc.toLowerCase();
          const nameLower = stationName.toLowerCase();
          const detectBrand = (src: string, name: string) => {
            if (src.includes('loro') || name.includes('loro')) return "LORO";
            if (src.includes('agip') || src.includes('eni') || name.includes('eni')) return "ENI";
            if (src.includes('q8') || name.includes('q8')) return "Q8";
            if (src.includes('shell') || name.includes('shell')) return "Shell";
            if (src.includes('esso') || name.includes('esso')) return "Esso";
            if (src.includes('tamoil') || name.includes('tamoil')) return "Tamoil";
            if (src.includes('ip.') || name.startsWith('ip ')) return "IP";
            if (src.includes('pompe-bianche')) return "Pompe Bianche";
            if (src.includes('costantin') || name.includes('costantin')) return "Costantin";
            if (src.includes('total') || name.includes('totalenergies')) return "TotalEnergies";
            return "Altro";
          };
          brandName = detectBrand(imgLower, nameLower);
          
          inserts.push({
            province,
            fuelType: "Gasolio",
            selfServicePrice: gasolioPrice,
            fullServicePrice: null,
            brandName,
            stationName: stationName || "Sconosciuto",
            stationAddress: `${address} - ${comune}`.trim(),
            date: todayStr,
            source: "alvolante",
          });
        });
        
        if (inserts.length > 0) {
          await db.insert(fuelPrices).values(inserts);
          console.log(`[Fuel Prices] Saved ${inserts.length} stations from alVolante (${inserts.filter(i => i.brandName === "LORO").length} LORO)`);
          return;
        }
        
        console.log("[Fuel Prices] No stations parsed from alVolante page");
      } catch (scrapeErr: any) {
        console.log(`[Fuel Prices] alVolante scrape failed: ${scrapeErr.message}`);
      }
      
      console.log("[Fuel Prices] Using fallback prices");
      const fallbackPrices: Record<string, number> = {
        "VR": 1.689, "VI": 1.695, "PD": 1.692,
        "VE": 1.698, "MN": 1.685,
      };
      const fp = fallbackPrices[province] || 1.690;
      
      await db.insert(fuelPrices).values([
        {
          province,
          fuelType: "Gasolio",
          selfServicePrice: fp,
          fullServicePrice: null,
          brandName: "LORO",
          stationName: `LORO - Media`,
          stationAddress: province,
          date: todayStr,
          source: "fallback",
        },
        {
          province,
          fuelType: "Gasolio",
          selfServicePrice: fp + 0.01,
          fullServicePrice: null,
          brandName: "Media Provinciale",
          stationName: `Media Provinciale`,
          stationAddress: province,
          date: todayStr,
          source: "fallback",
        },
      ]);
      
    } catch (error) {
      console.error("[Fuel Prices] Error fetching prices:", error);
    }
  }

  // ============================================================
  // VEHICLE DOCUMENTS - ADMIN ENDPOINTS
  // ============================================================

  app.get("/api/admin/vehicle-documents", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (orgId && !isFullAdmin(req)) {
        const docs = await db.select().from(vehicleDocuments)
          .where(and(
            eq(vehicleDocuments.isActive, true),
            eq(vehicleDocuments.organizationId, orgId)
          ))
          .orderBy(desc(vehicleDocuments.createdAt));
        return res.json(docs);
      }

      const docs = await db.select().from(vehicleDocuments)
        .where(eq(vehicleDocuments.isActive, true))
        .orderBy(desc(vehicleDocuments.createdAt));
      res.json(docs);
    } catch (error) {
      console.error("Error fetching all vehicle documents:", error);
      res.status(500).json({ error: "Errore nel recupero documenti" });
    }
  });

  app.get("/api/admin/sanitization-logs", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (orgId && !isFullAdmin(req)) {
        const logs = await db.select().from(sanitizationLogs)
          .where(eq(sanitizationLogs.organizationId, orgId))
          .orderBy(desc(sanitizationLogs.completedAt))
          .limit(200);
        return res.json(logs);
      }

      const logs = await db.select().from(sanitizationLogs)
        .orderBy(desc(sanitizationLogs.completedAt))
        .limit(200);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching all sanitization logs:", error);
      res.status(500).json({ error: "Errore nel recupero registro sanificazioni" });
    }
  });

  app.post("/api/admin/vehicle-documents", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const orgId = user?.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';
      const { vehicleId, vehicleCode, documentType, documentLabel, expiryDate, issueDate, documentNumber, notes } = req.body;
      if (!vehicleId || !documentType || !documentLabel) {
        return res.status(400).json({ error: "Campi obbligatori mancanti" });
      }
      const [doc] = await db.insert(vehicleDocuments).values({
        vehicleId,
        vehicleCode: vehicleCode || "",
        documentType,
        documentLabel: documentLabel.trim(),
        expiryDate: expiryDate || null,
        issueDate: issueDate || null,
        documentNumber: documentNumber || null,
        notes: notes || null,
        photoBase64: null,
        uploadedByName: user?.name || "Admin",
        uploadedByUserId: userId || "admin",
        organizationId: orgId,
      }).returning();
      res.status(201).json(doc);
    } catch (error) {
      console.error("Error creating vehicle document from admin:", error);
      res.status(500).json({ error: "Errore nella creazione documento" });
    }
  });

  app.put("/api/admin/vehicle-documents/:id", requireAdmin, async (req, res) => {
    try {
      const { documentLabel, documentType, expiryDate, issueDate, documentNumber, notes } = req.body;
      const [updated] = await db.update(vehicleDocuments)
        .set({
          documentType: documentType || undefined,
          documentLabel: documentLabel?.trim(),
          expiryDate: expiryDate || null,
          issueDate: issueDate || null,
          documentNumber: documentNumber || null,
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(eq(vehicleDocuments.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating vehicle document:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento" });
    }
  });

  app.delete("/api/admin/vehicle-documents/:id", requireAdmin, async (req, res) => {
    try {
      await db.update(vehicleDocuments)
        .set({ isActive: false })
        .where(eq(vehicleDocuments.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vehicle document:", error);
      res.status(500).json({ error: "Errore nella rimozione" });
    }
  });

  // ============================================================
  // VEHICLE DOCUMENTS (Documenti Veicolo)
  // ============================================================

  app.get("/api/vehicle-documents/:vehicleId", requireAuth, async (req, res) => {
    try {
      const docs = await db.select().from(vehicleDocuments)
        .where(and(
          eq(vehicleDocuments.vehicleId, req.params.vehicleId),
          eq(vehicleDocuments.isActive, true)
        ))
        .orderBy(vehicleDocuments.expiryDate);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching vehicle documents:", error);
      res.status(500).json({ error: "Errore nel recupero documenti" });
    }
  });

  app.post("/api/vehicle-documents", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ error: "Utente non trovato" });
      const orgId = user.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';

      const { vehicleId, vehicleCode, documentType, documentLabel, expiryDate, issueDate, documentNumber, notes, photoBase64, uploadedByName } = req.body;
      if (!vehicleId || !documentType || !documentLabel) {
        return res.status(400).json({ error: "Campi obbligatori mancanti" });
      }
      if (!uploadedByName || uploadedByName.trim().length === 0) {
        return res.status(400).json({ error: "Nome operatore obbligatorio" });
      }

      const [doc] = await db.insert(vehicleDocuments).values({
        vehicleId,
        vehicleCode: vehicleCode || "",
        documentType,
        documentLabel: documentLabel.trim(),
        expiryDate: expiryDate || null,
        issueDate: issueDate || null,
        documentNumber: documentNumber || null,
        notes: notes || null,
        photoBase64: photoBase64 || null,
        uploadedByName: uploadedByName.trim(),
        uploadedByUserId: userId,
        organizationId: orgId,
      }).returning();

      res.status(201).json(doc);
    } catch (error) {
      console.error("Error creating vehicle document:", error);
      res.status(500).json({ error: "Errore nella creazione documento" });
    }
  });

  app.put("/api/vehicle-documents/:id", requireAuth, async (req, res) => {
    try {
      const { documentLabel, expiryDate, issueDate, documentNumber, notes, photoBase64 } = req.body;
      const [updated] = await db.update(vehicleDocuments)
        .set({
          documentLabel: documentLabel?.trim(),
          expiryDate: expiryDate || null,
          issueDate: issueDate || null,
          documentNumber: documentNumber || null,
          notes: notes || null,
          photoBase64: photoBase64 !== undefined ? photoBase64 : undefined,
          updatedAt: new Date(),
        })
        .where(eq(vehicleDocuments.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating vehicle document:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento documento" });
    }
  });

  app.delete("/api/vehicle-documents/:id", requireAuth, async (req, res) => {
    try {
      await db.update(vehicleDocuments)
        .set({ isActive: false })
        .where(eq(vehicleDocuments.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vehicle document:", error);
      res.status(500).json({ error: "Errore nella rimozione documento" });
    }
  });

  // ============================================================
  // SANITIZATION LOGS (Registro Sanificazioni)
  // ============================================================

  app.get("/api/sanitization-logs/:vehicleId", requireAuth, async (req, res) => {
    try {
      const logs = await db.select().from(sanitizationLogs)
        .where(eq(sanitizationLogs.vehicleId, req.params.vehicleId))
        .orderBy(desc(sanitizationLogs.completedAt))
        .limit(50);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching sanitization logs:", error);
      res.status(500).json({ error: "Errore nel recupero registro sanificazioni" });
    }
  });

  app.post("/api/sanitization-logs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const user = await storage.getUser(userId);
      const orgId = user?.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';

      const { vehicleId, vehicleCode, sanitizationType, operatorName, notes, productsUsed, tripId, completedAt } = req.body;
      if (!vehicleId || !sanitizationType || !operatorName?.trim()) {
        return res.status(400).json({ error: "Campi obbligatori mancanti" });
      }

      const [log] = await db.insert(sanitizationLogs).values({
        vehicleId,
        vehicleCode: vehicleCode || "",
        sanitizationType,
        operatorName: operatorName.trim(),
        operatorUserId: userId,
        notes: notes || null,
        productsUsed: productsUsed || null,
        tripId: tripId || null,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
        organizationId: orgId,
      }).returning();

      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating sanitization log:", error);
      res.status(500).json({ error: "Errore nella registrazione sanificazione" });
    }
  });

  app.get("/api/sanitization-logs/:vehicleId/stats", requireAuth, async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const logs = await db.select().from(sanitizationLogs)
        .where(and(
          eq(sanitizationLogs.vehicleId, req.params.vehicleId),
          gte(sanitizationLogs.completedAt, thirtyDaysAgo)
        ));

      const total = logs.length;
      const straordinaria = logs.filter(l => l.sanitizationType === "straordinaria").length;
      const infettivo = logs.filter(l => l.sanitizationType === "infettivo").length;
      const lastLog = logs.length > 0 ? logs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0] : null;

      res.json({ total, straordinaria, infettivo, lastLog });
    } catch (error) {
      console.error("Error fetching sanitization stats:", error);
      res.status(500).json({ error: "Errore nelle statistiche sanificazioni" });
    }
  });

  // ============================================================================
  // SCHEDA DI SOCCORSO - Digital Emergency Care Sheet API
  // ============================================================================

  app.get("/api/rescue-sheets/:vehicleId", requireAuth, async (req, res) => {
    try {
      const sheets = await db.select().from(rescueSheets)
        .where(eq(rescueSheets.vehicleId, req.params.vehicleId))
        .orderBy(desc(rescueSheets.createdAt));
      res.json(sheets);
    } catch (error) {
      console.error("Error fetching rescue sheets:", error);
      res.status(500).json({ error: "Errore nel recupero schede di soccorso" });
    }
  });

  app.get("/api/rescue-sheets/detail/:id", requireAuth, async (req, res) => {
    try {
      const [sheet] = await db.select().from(rescueSheets)
        .where(eq(rescueSheets.id, req.params.id));
      if (!sheet) return res.status(404).json({ error: "Scheda non trovata" });
      res.json(sheet);
    } catch (error) {
      console.error("Error fetching rescue sheet:", error);
      res.status(500).json({ error: "Errore nel recupero scheda di soccorso" });
    }
  });

  app.post("/api/rescue-sheets", requireAuth, async (req, res) => {
    try {
      const data = req.body;
      const progressiveNumber = await storage.getNextProgressiveNumber(data.vehicleId);
      
      const insertData: any = {
        ...data,
        progressiveNumber,
        userId: req.session.userId!,
        status: data.status || "draft",
        completedAt: data.status === "completed" ? new Date() : null,
      };
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        insertData.organizationId = orgId;
      }
      const [sheet] = await db.insert(rescueSheets).values(insertData).returning();
      
      res.json(sheet);
    } catch (error) {
      console.error("Error creating rescue sheet:", error);
      res.status(500).json({ error: "Errore nella creazione della scheda di soccorso" });
    }
  });

  app.put("/api/rescue-sheets/:id", requireAuth, async (req, res) => {
    try {
      const data = req.body;
      const [sheet] = await db.update(rescueSheets)
        .set({
          ...data,
          updatedAt: new Date(),
          completedAt: data.status === "completed" ? new Date() : undefined,
        })
        .where(eq(rescueSheets.id, req.params.id))
        .returning();
      
      if (!sheet) return res.status(404).json({ error: "Scheda non trovata" });
      res.json(sheet);
    } catch (error) {
      console.error("Error updating rescue sheet:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento della scheda di soccorso" });
    }
  });

  app.delete("/api/rescue-sheets/:id", requireAuth, async (req, res) => {
    try {
      const [sheet] = await db.delete(rescueSheets)
        .where(eq(rescueSheets.id, req.params.id))
        .returning();
      if (!sheet) return res.status(404).json({ error: "Scheda non trovata" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rescue sheet:", error);
      res.status(500).json({ error: "Errore nell'eliminazione della scheda di soccorso" });
    }
  });

  app.get("/api/admin/rescue-sheets", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const orgSheets = await db.select().from(rescueSheets)
          .where(eq(rescueSheets.organizationId, orgId))
          .orderBy(desc(rescueSheets.createdAt));
        return res.json(orgSheets);
      }
      const allSheets = await db.select().from(rescueSheets)
        .orderBy(desc(rescueSheets.createdAt));
      res.json(allSheets);
    } catch (error) {
      console.error("Error fetching admin rescue sheets:", error);
      res.status(500).json({ error: "Errore nel recupero schede di soccorso" });
    }
  });

  app.get("/api/admin/rescue-sheets/:id/pdf", requireAdmin, async (req, res) => {
    try {
      const [sheet] = await db.select().from(rescueSheets)
        .where(eq(rescueSheets.id, req.params.id));
      if (!sheet) return res.status(404).json({ error: "Scheda non trovata" });

      const doc = new PDFDocument({ size: "A4", margin: 20 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=scheda_soccorso_${sheet.progressiveNumber}_${sheet.sheetDate}.pdf`);
      doc.pipe(res);

      const pageW = doc.page.width - 40;
      const leftM = 20;
      let y = 20;

      const drawBox = (x: number, yPos: number, w: number, h: number, label?: string, value?: string) => {
        doc.rect(x, yPos, w, h).stroke();
        if (label) {
          doc.fontSize(6).fillColor("#666666").text(label, x + 2, yPos + 1, { width: w - 4 });
        }
        if (value) {
          doc.fontSize(9).fillColor("#000000").text(value, x + 2, yPos + (label ? 10 : 3), { width: w - 4 });
        }
      };

      const drawCheckbox = (x: number, yPos: number, checked: boolean, label: string) => {
        doc.rect(x, yPos, 8, 8).stroke();
        if (checked) {
          doc.fontSize(8).text("X", x + 1, yPos - 1);
        }
        doc.fontSize(7).fillColor("#000000").text(label, x + 11, yPos + 1);
      };

      doc.rect(leftM, y, pageW, 30).fill("#0066CC");
      doc.fontSize(16).fillColor("#FFFFFF").text("SCHEDA DI SOCCORSO", leftM + 10, y + 7, { align: "center", width: pageW - 20 });
      y += 35;

      const col1W = pageW * 0.35;
      const col2W = pageW * 0.3;
      const col3W = pageW * 0.35;

      drawBox(leftM, y, col1W, 20, "DATA", sheet.sheetDate || "");
      drawBox(leftM + col1W, y, col2W, 20, "SIGLA MEZZO", sheet.vehicleCode || "");
      drawBox(leftM + col1W + col2W, y, col3W, 20, "PROGRESSIVO", sheet.progressiveNumber || "");
      y += 22;

      const dispatchColors: Record<string, string> = { C: "#FFFFFF", B: "#00A651", V: "#FFC107", G: "#FF8C00", R: "#DC3545" };
      const codiceLabel = sheet.dispatchCode || "-";
      doc.fontSize(7).fillColor("#333333").text("CODICE INVIO:", leftM, y + 2);
      const codeX = leftM + 70;
      ["C", "B", "V", "G", "R"].forEach((code, i) => {
        const bx = codeX + i * 30;
        doc.rect(bx, y, 25, 16).fill(dispatchColors[code] || "#FFFFFF").stroke();
        doc.fontSize(9).fillColor(code === "C" ? "#000" : "#FFF").text(code, bx + 8, y + 3);
        if (sheet.dispatchCode === code) {
          doc.rect(bx, y, 25, 16).lineWidth(2).stroke("#000");
        }
      });
      y += 20;

      doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
      doc.fontSize(8).fillColor("#0066CC").text("ORARI", leftM + 5, y + 3, { width: pageW });
      y += 16;

      const timeFields = [
        ["ORA ATTIVAZIONE", sheet.oraAttivazione],
        ["INIZIO MISSIONE", sheet.inizioMissione],
        ["ARRIVO POSTO", sheet.arrivoPosto],
        ["PARTENZA POSTO", sheet.partenzaPosto],
        ["ARRIVO RV", sheet.arrivoRv],
        ["PARTENZA DA RV", sheet.partenzaDaRv],
        ["ARRIVO IN H", sheet.arrivoInH],
        ["OPERATIVO/FINE 1", sheet.operativoFine1],
        ["IN BASE/FINE 2", sheet.inBaseFine2],
      ];
      const tw = pageW / 3;
      timeFields.forEach((tf, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        drawBox(leftM + col * tw, y + row * 16, tw, 16, tf[0] as string, (tf[1] as string) || "");
      });
      y += Math.ceil(timeFields.length / 3) * 16 + 4;

      doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
      doc.fontSize(8).fillColor("#0066CC").text("LUOGO EVENTO", leftM + 5, y + 3);
      y += 16;
      drawBox(leftM, y, pageW * 0.5, 16, "COMUNE", sheet.luogoComune || "");
      drawBox(leftM + pageW * 0.5, y, pageW * 0.35, 16, "VIA", sheet.luogoVia || "");
      drawBox(leftM + pageW * 0.85, y, pageW * 0.15, 16, "PROV.", sheet.luogoProv || "");
      y += 18;

      doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
      doc.fontSize(8).fillColor("#0066CC").text("PAZIENTE", leftM + 5, y + 3);
      y += 16;
      drawBox(leftM, y, pageW * 0.4, 16, "COGNOME", sheet.pazienteCognome || "");
      drawBox(leftM + pageW * 0.4, y, pageW * 0.35, 16, "NOME", sheet.pazienteNome || "");
      drawBox(leftM + pageW * 0.75, y, pageW * 0.1, 16, "SESSO", sheet.pazienteSesso || "");
      drawBox(leftM + pageW * 0.85, y, pageW * 0.15, 16, "ETA'", `${sheet.pazienteEtaAnni || ""}${sheet.pazienteEtaMesi ? " m" + sheet.pazienteEtaMesi : ""}`);
      y += 18;
      drawBox(leftM, y, pageW * 0.3, 16, "NATO/A IL", sheet.pazienteNatoIl || "");
      drawBox(leftM + pageW * 0.3, y, pageW * 0.45, 16, "C.F.", sheet.pazienteCf || "");
      y += 20;

      doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
      doc.fontSize(8).fillColor("#0066CC").text("VALUTAZIONE ABCDE", leftM + 5, y + 3);
      y += 16;

      const valA = (sheet.valutazioneA || {}) as Record<string, boolean>;
      const valALabels = ["INCOSCIENTE", "OSTRUZIONE VIE AEREE", "ARRESTO RESPIRATORIO", "RESPIRO DIFFICOLTOSO", "RUMORI RESPIRATORI", "OTORRAGIA", "EPISTASSI"];
      doc.fontSize(7).fillColor("#DC3545").text("A - AIRWAY", leftM + 2, y);
      y += 10;
      valALabels.forEach((label, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        drawCheckbox(leftM + 5 + col * (pageW / 3), y + row * 12, !!valA[label.toLowerCase().replace(/ /g, "_")], label);
      });
      y += Math.ceil(valALabels.length / 3) * 12 + 5;

      const params = (sheet.parametriVitali || []) as Array<Record<string, string>>;
      if (params.length > 0) {
        doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
        doc.fontSize(8).fillColor("#0066CC").text("PARAMETRI VITALI", leftM + 5, y + 3);
        y += 16;
        const paramNames = ["AVPU", "FR", "SpO2", "FC", "PA", "Temp", "Glicemia", "Dolore"];
        const paramColW = pageW / (params.length + 1);
        doc.fontSize(6).fillColor("#666");
        paramNames.forEach((name, i) => {
          doc.text(name, leftM + 2, y + i * 12 + 2);
        });
        params.forEach((p, pi) => {
          const px = leftM + paramColW * (pi + 1);
          doc.rect(px, y - 2, paramColW, 10).fill("#F0F0F0");
          doc.fontSize(6).fillColor("#666").text(p.ora || `Riv. ${pi + 1}`, px + 2, y);
          paramNames.forEach((name, i) => {
            const key = name.toLowerCase().replace(/ /g, "_");
            drawBox(px, y + (i + 1) * 12 - 10, paramColW, 12, "", p[key] || "");
          });
        });
        y += paramNames.length * 12 + 8;
      }

      const prestaz = (sheet.prestazioni || {}) as Record<string, boolean | string>;
      const presidList = (sheet.presidi || {}) as Record<string, boolean>;
      if (Object.keys(prestaz).length > 0 || Object.keys(presidList).length > 0) {
        doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
        doc.fontSize(8).fillColor("#0066CC").text("PRESTAZIONI E PRESIDI", leftM + 5, y + 3);
        y += 16;
        
        const prestLabels = ["OSSIGENO", "ASPIRAZIONE", "CANNULA ORO FARINGEA", "VENTILAZIONE MANUALE", "RIMOZIONE CASCO/CINTURA", "ESTRICAZIONE", "ABBATTIMENTO SU SPINALE", "EMOSTASI", "MEDICAZIONE", "IMMOBILIZZAZIONE ARTI", "IMMOBILIZZAZIONE COLONNA", "PROTEZIONE TERMICA"];
        prestLabels.forEach((label, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const key = label.toLowerCase().replace(/[ /]/g, "_");
          drawCheckbox(leftM + 5 + col * (pageW / 3), y + row * 12, !!prestaz[key], label);
        });
        y += Math.ceil(prestLabels.length / 3) * 12 + 5;
      }

      if (sheet.note) {
        doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
        doc.fontSize(8).fillColor("#0066CC").text("NOTE", leftM + 5, y + 3);
        y += 16;
        doc.fontSize(8).fillColor("#000").text(sheet.note, leftM + 5, y, { width: pageW - 10 });
        y += 30;
      }

      const equip = (sheet.equipaggio || {}) as Record<string, string>;
      doc.rect(leftM, y, pageW, 14).fill("#E8F0FE");
      doc.fontSize(8).fillColor("#0066CC").text("EQUIPAGGIO", leftM + 5, y + 3);
      y += 16;
      drawBox(leftM, y, pageW * 0.5, 16, "AUTISTA SOCCORRITORE", equip.autista || "");
      drawBox(leftM + pageW * 0.5, y, pageW * 0.5, 16, "SOCCORRITORE", equip.soccorritore || "");
      y += 18;
      drawBox(leftM, y, pageW * 0.5, 16, "ALTRO SOCCORRITORE", equip.altroSoccorritore || "");
      drawBox(leftM + pageW * 0.5, y, pageW * 0.5, 16, "SOCCORRITORE", equip.soccorritore2 || "");
      y += 20;

      drawBox(leftM, y, pageW * 0.5, 20, "FIRMA COMPILATORE", sheet.firmaCompilatore || "");
      y += 25;

      doc.fontSize(5).fillColor("#999999").text(
        "I dati personali e sensibili saranno trattati nel rispetto delle normative vigenti e in ottemperanza del D. Lgs. nr. 196/2003",
        leftM, doc.page.height - 30, { width: pageW, align: "center" }
      );

      doc.end();
    } catch (error) {
      console.error("Error generating rescue sheet PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF" });
    }
  });
}
