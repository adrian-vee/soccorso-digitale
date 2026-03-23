/**
 * Trip Routes — Dashboard, Trips CRUD, Address Autocomplete, Directions,
 * Distance, PDF Reports, Documents, Integrity, Soccorso Live, SLA
 */

import type { Express } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { storage } from "../storage";
import { db } from "../db";
import {
  insertTripSchema,
  trips, vehicles, locations, users, organizations,
  tripWaypoints, soccorsoLiveReports, tripGpsPoints,
  tripCarbonFootprint, carbonEmissionFactors,
  structures as structuresTable2, departments as departmentsTable,
  shiftInstances, shiftAssignments, staffMembers
} from "@shared/schema";
import { z } from "zod";
import { and, eq, gte, lte, inArray, sql, desc, asc, between, ne, isNotNull } from "drizzle-orm";
import {
  requireAuth, requireAdmin, requireSuperAdmin, requireOrgAdmin,
  getUserId, getOrganizationId, getEffectiveOrgId,
  requireAdminOrManager, getLocationFilter, isFullAdmin, isOrgAdmin,
  isBranchManager, getManagedLocationIds
} from "../auth-middleware";
import { auditLog } from "../audit";
import { signTrip, verifyTripIntegrity, checkAndInvalidateIntegrity, getIntegrityStats } from "../trip-integrity";
import { calculateTripFinancials } from "../cost-calculator";
import { generateTripPDF, generateDeviceAuthorizationPDF } from "../pdf-generator";
import { broadcastMessage } from "./index";

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

// Helper function to automatically calculate carbon footprint for a trip
async function calculateCarbonFootprintForTrip(tripId: string, vehicleId: string, kmTraveled: number) {
  try {
    const vehicle = await db.select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);

    const fuelType = vehicle[0]?.fuelType || "Gasolio";
    const normalizedFuelType = fuelType.toLowerCase().includes("diesel") ? "Gasolio" :
                               fuelType.toLowerCase().includes("benzina") ? "Benzina" :
                               fuelType.toLowerCase().includes("gpl") ? "GPL" :
                               fuelType.toLowerCase().includes("metano") ? "Metano" :
                               fuelType.toLowerCase().includes("elettric") ? "Elettrico" : "Gasolio";

    const factor = await db.select()
      .from(carbonEmissionFactors)
      .where(and(
        eq(carbonEmissionFactors.fuelType, normalizedFuelType),
        eq(carbonEmissionFactors.isActive, true)
      ))
      .limit(1);

    const gCo2PerKm = factor[0]?.gCo2PerKm || 171;
    const privateCarGCo2PerKm = factor[0]?.privateCarGCo2PerKm || 120;
    const co2EmittedKg = (kmTraveled * gCo2PerKm) / 1000;
    const co2IfPrivateCar = (kmTraveled * privateCarGCo2PerKm) / 1000;
    const co2SavedKg = Math.max(0, co2IfPrivateCar * 2 - co2EmittedKg);

    const existing = await db.select()
      .from(tripCarbonFootprint)
      .where(eq(tripCarbonFootprint.tripId, tripId));

    if (existing.length > 0) {
      await db.update(tripCarbonFootprint)
        .set({ kmTraveled, fuelType: normalizedFuelType, co2EmittedKg, co2PerKm: gCo2PerKm, co2IfPrivateCar, co2SavedKg })
        .where(eq(tripCarbonFootprint.tripId, tripId));
    } else {
      await db.insert(tripCarbonFootprint).values({
        tripId, vehicleId, kmTraveled, fuelType: normalizedFuelType,
        co2EmittedKg, co2PerKm: gCo2PerKm, co2IfPrivateCar, co2SavedKg,
      });
    }
    return true;
  } catch (error) {
    console.error("Error calculating carbon footprint for trip:", error);
    return false;
  }
}

export function registerTripRoutes(app: Express) {
  // Helper to strip civic number from address for privacy
  const stripCivicNumber = (address: string | null): string | null => {
    if (!address) return null;
    // Remove numbers at the end of address (civic number)
    return address.replace(/,?\s*\d+[a-zA-Z]?\s*$/g, '').trim();
  };

  // Anomaly detection thresholds
  const ANOMALY_THRESHOLDS = {
    MAX_KM_SINGLE_TRIP: 200,
    MAX_DURATION_MINUTES: 480, // 8 hours
    // Speed check: only flag if trip >= 10km AND >= 10min AND speed > 160 km/h
    // Soglia alzata a 160 km/h perché ambulanze possono legalmente superare limiti durante emergenze
    MIN_KM_FOR_SPEED_CHECK: 10,
    MIN_DURATION_FOR_SPEED_CHECK: 10,
    MAX_SPEED_KMH: 160,
  };

  // Helper to detect anomalies in a trip
  const detectAnomalies = (trip: any): { hasAnomaly: boolean; anomalyTypes: string[] } => {
    const anomalyTypes: string[] = [];
    
    // Check km anomaly (very long trips)
    if (trip.kmTraveled && trip.kmTraveled > ANOMALY_THRESHOLDS.MAX_KM_SINGLE_TRIP) {
      anomalyTypes.push("km_elevati");
    }
    
    // Check duration anomaly (very long trips only)
    if (trip.durationMinutes !== null && trip.durationMinutes !== undefined) {
      if (trip.durationMinutes > ANOMALY_THRESHOLDS.MAX_DURATION_MINUTES) {
        anomalyTypes.push("durata_lunga");
      }
    }
    
    // Check implausible speed (only for trips >= 10km AND >= 10min)
    if (trip.kmTraveled >= ANOMALY_THRESHOLDS.MIN_KM_FOR_SPEED_CHECK &&
        trip.durationMinutes >= ANOMALY_THRESHOLDS.MIN_DURATION_FOR_SPEED_CHECK) {
      const hours = trip.durationMinutes / 60;
      const speedKmh = trip.kmTraveled / hours;
      if (speedKmh > ANOMALY_THRESHOLDS.MAX_SPEED_KMH) {
        anomalyTypes.push("velocita_implausibile");
      }
    }
    
    return {
      hasAnomaly: anomalyTypes.length > 0,
      anomalyTypes,
    };
  };

  // Helper to enrich trips with structure/department names and anomaly detection
  const enrichTrips = async (tripsData: any[]) => {
    if (tripsData.length === 0) return [];
    
    const [allStructures, allDepartments, allLocations, allVehicles] = await Promise.all([
      storage.getStructures(),
      storage.getDepartments(),
      storage.getLocations(),
      storage.getVehicles(),
    ]);
    
    const structureMap = new Map(allStructures.map(s => [s.id, s]));
    const departmentMap = new Map(allDepartments.map(d => [d.id, d]));
    const locationMap = new Map(allLocations.map(l => [l.id, l]));
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
    
    const tripIds = tripsData.map(t => t.id);
    const batchSize = 500;
    let allWaypoints: any[] = [];
    for (let i = 0; i < tripIds.length; i += batchSize) {
      const batch = tripIds.slice(i, i + batchSize);
      const wps = await db.select().from(tripWaypoints).where(inArray(tripWaypoints.tripId, batch));
      allWaypoints = allWaypoints.concat(wps);
    }
    
    const waypointsByTrip = new Map<string, any[]>();
    for (const w of allWaypoints) {
      if (!waypointsByTrip.has(w.tripId)) waypointsByTrip.set(w.tripId, []);
      waypointsByTrip.get(w.tripId)!.push(w);
    }
    
    return tripsData.map(trip => {
      const tripWaypointsList = (waypointsByTrip.get(trip.id) || [])
        .sort((a, b) => a.waypointOrder - b.waypointOrder)
        .map(w => {
          const structure = w.structureId ? structureMap.get(w.structureId) : null;
          const department = w.departmentId ? departmentMap.get(w.departmentId) : null;
          return {
            ...w,
            structureName: structure?.name || null,
            structureAddress: structure ? stripCivicNumber(structure.address) : null,
            departmentName: department?.name || null,
          };
        });
      const vehicle = trip.vehicleId ? vehicleMap.get(trip.vehicleId) : null;
      const location = vehicle?.locationId ? locationMap.get(vehicle.locationId) : null;
      const originStructure = trip.originStructureId ? structureMap.get(trip.originStructureId) : null;
      const destStructure = trip.destinationStructureId ? structureMap.get(trip.destinationStructureId) : null;
      const originDept = trip.originDepartmentId ? departmentMap.get(trip.originDepartmentId) : null;
      const destDept = trip.destinationDepartmentId ? departmentMap.get(trip.destinationDepartmentId) : null;
      
      const { hasAnomaly, anomalyTypes } = detectAnomalies(trip);
      
      let resolvedOriginName = originStructure?.name || trip.originAddress || null;
      if (trip.originType === 'sede') {
        if (trip.originStructureId) {
          const sedeLoc = locationMap.get(trip.originStructureId);
          if (sedeLoc) resolvedOriginName = `Sede ${sedeLoc.name}`;
        }
        if (!resolvedOriginName || resolvedOriginName === trip.originAddress) {
          const vehLoc = vehicle?.locationId ? locationMap.get(vehicle.locationId) : null;
          resolvedOriginName = vehLoc ? `Sede ${vehLoc.name}` : 'Sede';
        }
      }
      
      let resolvedDestName = destStructure?.name || trip.destinationAddress || null;
      if (trip.destinationType === 'sede') {
        if (trip.destinationStructureId) {
          const sedeLoc = locationMap.get(trip.destinationStructureId);
          if (sedeLoc) resolvedDestName = `Sede ${sedeLoc.name}`;
        }
        if (!resolvedDestName || resolvedDestName === trip.destinationAddress) {
          const vehLoc = vehicle?.locationId ? locationMap.get(vehicle.locationId) : null;
          resolvedDestName = vehLoc ? `Sede ${vehLoc.name}` : 'Sede';
        }
      }
      
      return {
        ...trip,
        originName: resolvedOriginName,
        destinationName: resolvedDestName,
        originStructureName: originStructure?.name || null,
        originStructureAddress: originStructure ? stripCivicNumber(originStructure.address) : null,
        originDepartmentName: originDept?.name || null,
        destinationStructureName: destStructure?.name || null,
        destinationStructureAddress: destStructure ? stripCivicNumber(destStructure.address) : null,
        destinationDepartmentName: destDept?.name || null,
        hasAnomaly,
        anomalyTypes,
        isEmergencyService: trip.isEmergencyService || false,
        locationName: location?.name || null,
        vehicleCode: vehicle?.code || null,
        waypoints: tripWaypointsList,
      };
    });
  };

  // Dashboard Metrics API - aggregated data for new dashboard
  app.get("/api/dashboard/metrics", requireAuth, async (req, res) => {
    try {
      const { days = "7", locationId, dateFrom, dateTo } = req.query;
      
      let periodStart: Date;
      let periodEnd: Date;
      let periodDays: number;
      
      // Use custom date range if provided
      if (dateFrom && dateTo) {
        periodStart = new Date(dateFrom as string);
        periodEnd = new Date(dateTo as string);
        periodEnd.setHours(23, 59, 59, 999); // Include full day
        periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        periodDays = parseInt(days as string) || 7;
        periodEnd = new Date();
        periodStart = new Date(periodEnd);
        periodStart.setDate(periodStart.getDate() - periodDays);
      }
      
      const prevPeriodEnd = new Date(periodStart);
      const prevPeriodStart = new Date(prevPeriodEnd);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);
      
      const orgId = getEffectiveOrgId(req);
      const prevDateStr = prevPeriodStart.toISOString().split('T')[0];
      const endDateStr = periodEnd.toISOString().split('T')[0];
      const startDateStr = periodStart.toISOString().split('T')[0];
      
      // Build trip query conditions - only fetch trips in the relevant date range
      const tripConditions = [
        gte(trips.serviceDate, prevDateStr),
        lte(trips.serviceDate, endDateStr)
      ];
      if (orgId) tripConditions.push(eq(trips.organizationId, orgId));
      
      const [periodTrips, allVehicles, allLocations, allUsers] = await Promise.all([
        db.select().from(trips).where(and(...tripConditions)).orderBy(desc(trips.createdAt)),
        orgId ? db.select().from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.isActive, true))).orderBy(vehiclesTable.code) : storage.getVehicles(),
        orgId ? db.select().from(locations).where(eq(locations.organizationId, orgId)).orderBy(locations.name) : storage.getLocations(),
        orgId ? db.select().from(users).where(eq(users.organizationId, orgId)).orderBy(users.name) : storage.getUsers()
      ]);
      
      // Split into current and previous period
      let currentTrips = periodTrips.filter(t => t.serviceDate >= startDateStr);
      let prevTrips = periodTrips.filter(t => t.serviceDate < startDateStr);
      
      // Filter by location if specified
      if (locationId) {
        const locationVehicles = allVehicles.filter(v => v.locationId === locationId).map(v => v.id);
        currentTrips = currentTrips.filter(t => t.vehicleId && locationVehicles.includes(t.vehicleId));
        prevTrips = prevTrips.filter(t => t.vehicleId && locationVehicles.includes(t.vehicleId));
      }
      
      // Calculate KPIs
      const totalServices = currentTrips.length;
      const prevServices = prevTrips.length;
      const servicesChange = prevServices > 0 ? ((totalServices - prevServices) / prevServices * 100).toFixed(0) : 0;
      
      const totalKm = currentTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const prevKm = prevTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const kmChange = prevKm > 0 ? ((totalKm - prevKm) / prevKm * 100).toFixed(0) : 0;
      
      const totalDuration = currentTrips.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
      const avgDuration = totalServices > 0 ? Math.round(totalDuration / totalServices) : 0;
      const prevAvgDuration = prevServices > 0 ? Math.round(prevTrips.reduce((s, t) => s + (t.durationMinutes || 0), 0) / prevServices) : 0;
      const durationChange = prevAvgDuration > 0 ? ((avgDuration - prevAvgDuration) / prevAvgDuration * 100).toFixed(0) : 0;
      
      const avgKmPerService = totalServices > 0 ? (totalKm / totalServices).toFixed(1) : 0;
      const prevAvgKmPerService = prevServices > 0 ? prevTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0) / prevServices : 0;
      const avgKmChange = prevAvgKmPerService > 0 ? ((parseFloat(avgKmPerService as string) - prevAvgKmPerService) / prevAvgKmPerService * 100).toFixed(0) : 0;
      
      // Active vehicles (with trips in current period)
      const activeVehicleIds = new Set(currentTrips.filter(t => t.vehicleId).map(t => t.vehicleId));
      const activeVehicles = activeVehicleIds.size;
      
      // Active crews (unique users who logged trips)
      const activeCrewIds = new Set(currentTrips.filter(t => (t as any).registeredBy).map(t => (t as any).registeredBy));
      const activeCrews = activeCrewIds.size;
      
      // Daily trend data
      const dailyData: { date: string; services: number; km: number }[] = [];
      for (let i = periodDays - 1; i >= 0; i--) {
        const date = new Date(periodEnd);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayTrips = currentTrips.filter(t => t.serviceDate === dateStr);
        dailyData.push({
          date: dateStr,
          services: dayTrips.length,
          km: dayTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0)
        });
      }
      
      // Hourly activity heatmap (day of week x hour)
      const hourlyHeatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      currentTrips.forEach(trip => {
        if (trip.departureTime) {
          const tripDate = new Date(trip.serviceDate);
          const dayOfWeek = tripDate.getDay(); // 0=Sunday
          const hour = parseInt(trip.departureTime.split(':')[0]) || 0;
          // Convert to Monday=0 format
          const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          if (adjustedDay >= 0 && adjustedDay < 7 && hour >= 0 && hour < 24) {
            hourlyHeatmap[adjustedDay][hour]++;
          }
        }
      });
      
      // Fleet status - top vehicles by usage
      const vehicleStats = allVehicles.map(vehicle => {
        const vehicleTrips = currentTrips.filter(t => t.vehicleId === vehicle.id);
        const location = allLocations.find(l => l.id === vehicle.locationId);
        return {
          id: vehicle.id,
          code: vehicle.code,
          name: (vehicle as any).name,
          location: location?.name || 'N/A',
          services: vehicleTrips.length,
          km: vehicleTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0),
          usage: 0 // Will calculate
        };
      }).filter(v => v.services > 0)
        .sort((a, b) => b.services - a.services)
        .slice(0, 5);
      
      // Calculate usage percentage (relative to max)
      const maxServices = Math.max(...vehicleStats.map(v => v.services), 1);
      vehicleStats.forEach(v => {
        v.usage = Math.round((v.services / maxServices) * 100);
      });
      
      // Location performance
      const locationStats = allLocations.map(location => {
        const locationVehicles = allVehicles.filter(v => v.locationId === location.id).map(v => v.id);
        const locationTrips = currentTrips.filter(t => t.vehicleId && locationVehicles.includes(t.vehicleId));
        const prevLocationTrips = prevTrips.filter(t => t.vehicleId && locationVehicles.includes(t.vehicleId));
        const change = prevLocationTrips.length > 0 
          ? ((locationTrips.length - prevLocationTrips.length) / prevLocationTrips.length * 100).toFixed(0)
          : 0;
        return {
          id: location.id,
          name: location.name,
          services: locationTrips.length,
          change: parseFloat(change as string)
        };
      }).filter(l => l.services > 0)
        .sort((a, b) => b.services - a.services);
      
      // Data quality metrics - calculated inline from already-loaded data (no extra DB calls)
      const completeTrips = currentTrips.filter(t => 
        t.departureTime && t.returnTime && t.originType && t.destinationType &&
        t.vehicleId && t.serviceDate && t.kmInitial != null && t.kmFinal != null
      ).length;
      const completionRate = totalServices > 0 ? Math.round((completeTrips / totalServices) * 100) : 100;
      const missingRate = 100 - completionRate;
      
      let avgEntryTime = '--:--';
      const entryDelays: number[] = [];
      currentTrips.forEach(trip => {
        if (trip.createdAt && trip.serviceDate && trip.departureTime) {
          const serviceDateTime = new Date(`${trip.serviceDate}T${trip.departureTime}`);
          const createdAt = new Date(trip.createdAt);
          const delayMinutes = Math.abs((createdAt.getTime() - serviceDateTime.getTime()) / 60000);
          if (delayMinutes < 1440) {
            entryDelays.push(delayMinutes);
          }
        }
      });
      if (entryDelays.length > 0) {
        const avgDelayMinutes = Math.round(entryDelays.reduce((a, b) => a + b, 0) / entryDelays.length);
        const hours = Math.floor(avgDelayMinutes / 60);
        const mins = avgDelayMinutes % 60;
        avgEntryTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
      
      // Inline km anomaly detection from current trips (avoids loading all trips again)
      let kmAnomalies = 0;
      currentTrips.forEach(t => {
        if (t.kmTraveled != null && t.kmTraveled < 0) kmAnomalies++;
        if (t.kmFinal != null && t.kmInitial != null && t.kmFinal < t.kmInitial) kmAnomalies++;
      });
      
      const coherenceScore = totalServices > 0 ? Math.round(100 - (kmAnomalies / totalServices * 100)) : 100;
      const overallScore = Math.round((completionRate + coherenceScore) / 2);
      
      const qualityMetrics = {
        completionRate,
        missingRate,
        anomalyCount: kmAnomalies,
        avgEntryTime,
        overallScore,
        coherenceScore
      };
      
      res.json({
        kpis: {
          totalServices,
          servicesChange: parseInt(servicesChange as string),
          totalKm: Math.round(totalKm),
          kmChange: parseInt(kmChange as string),
          avgDuration,
          durationChange: parseInt(durationChange as string),
          avgKmPerService: parseFloat(avgKmPerService as string),
          avgKmChange: parseInt(avgKmChange as string),
          activeVehicles,
          activeCrews
        },
        dailyTrend: dailyData,
        hourlyHeatmap,
        fleetStatus: vehicleStats,
        locationPerformance: locationStats,
        dataQuality: qualityMetrics,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      res.status(500).json({ error: "Errore nel caricamento metriche dashboard" });
    }
  });

  // Trips
  app.get("/api/trips", requireAuth, async (req, res) => {
    try {
      const { vehicleId, userId, locationId: locId, startDate } = req.query;
      let tripsResult;
      
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const conditions = [eq(trips.organizationId, orgId)];
        if (vehicleId) conditions.push(eq(trips.vehicleId, vehicleId as string));
        if (userId) conditions.push(eq(trips.userId, userId as string));
        if (startDate) conditions.push(gte(trips.serviceDate, startDate as string));
        if (locId) {
          const locVehicles = await db.select({ id: vehiclesTable.id }).from(vehiclesTable)
            .where(and(eq(vehiclesTable.locationId, locId as string), eq(vehiclesTable.organizationId, orgId)));
          const locVehicleIds = locVehicles.map(v => v.id);
          if (locVehicleIds.length > 0) {
            conditions.push(inArray(trips.vehicleId, locVehicleIds));
          } else {
            return res.json([]);
          }
        }
        tripsResult = await db.select().from(trips).where(and(...conditions)).orderBy(desc(trips.createdAt)).limit(500);
      } else if (vehicleId) {
        tripsResult = await storage.getTripsByVehicle(vehicleId as string);
      } else if (userId) {
        tripsResult = await storage.getTripsByUser(userId as string);
      } else {
        tripsResult = await storage.getTrips();
      }
      
      const enrichedTrips = await enrichTrips(tripsResult);
      res.json(enrichedTrips);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/trips/:id", requireAuth, async (req, res) => {
    try {
      const trip = await storage.getTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      const enrichedTrips = await enrichTrips([trip]);
      res.json(enrichedTrips[0]);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get device authorization for a trip
  app.get("/api/trips/:id/authorization", requireAuth, async (req, res) => {
    try {
      const authorization = await storage.getDeviceAuthorizationByTrip(req.params.id);
      if (!authorization) {
        return res.status(404).json({ error: "Autorizzazione non trovata" });
      }
      res.json(authorization);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get list of trip IDs that have device authorization
  app.get("/api/trips-with-device-auth", requireAdmin, async (req, res) => {
    try {
      let tripIds = await storage.getTripsWithDeviceAuth();
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const orgTrips = await db.select({ id: trips.id }).from(trips).where(eq(trips.organizationId, orgId));
        const orgTripIds = new Set(orgTrips.map(t => t.id));
        tripIds = tripIds.filter(id => orgTripIds.has(id));
      }
      res.json({ tripIds });
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Download device authorization PDF for a trip
  app.get("/api/trips/:id/authorization/pdf", requireAuth, async (req, res) => {
    try {
      const tripId = req.params.id;
      
      // Get trip and authorization
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      
      const authorization = await storage.getDeviceAuthorizationByTrip(tripId);
      if (!authorization) {
        return res.status(404).json({ error: "Autorizzazione dispositivi non trovata per questo servizio" });
      }
      
      // Get vehicle and location
      const vehicle = await storage.getVehicle(trip.vehicleId);
      let location = null;
      if (vehicle?.locationId) {
        location = await storage.getLocation(vehicle.locationId);
      }
      
      // Enrich trip with structure names for origin/destination
      const enrichedTrips = await enrichTrips([trip]);
      const enrichedTrip = enrichedTrips[0];
      
      // Generate PDF
      const doc = generateDeviceAuthorizationPDF({
        authorization,
        trip: enrichedTrip,
        vehicle,
        location,
      });
      
      // Set response headers for PDF download
      const filename = `autorizzazione_emergenza_${trip.progressiveNumber || trip.id.substring(0, 8)}_${trip.serviceDate || 'report'}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      
      // Handle PDF generation errors
      doc.on('error', (err) => {
        console.error("PDF generation stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Errore nella generazione del PDF" });
        } else {
          res.end();
        }
      });
      
      // Pipe the PDF to response
      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error("Error generating authorization PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF autorizzazione" });
    }
  });

  app.get("/api/vehicles/:vehicleId/last-trip", requireAuth, async (req, res) => {
    try {
      const trip = await storage.getLastTripByVehicle(req.params.vehicleId);
      if (!trip) {
        return res.json(null);
      }
      const enrichedTrips = await enrichTrips([trip]);
      res.json(enrichedTrips[0]);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/trips", requireAuth, async (req, res) => {
    try {
      const { deviceAuthorization, waypoints, ...tripPayload } = req.body;
      const userOrgId = getOrganizationId(req);
      if (userOrgId) {
        tripPayload.organizationId = userOrgId;
      }
      const tripData = insertTripSchema.parse(tripPayload);
      const trip = await storage.createTrip(tripData);
      
      // Create waypoints for emergency services with multi-stop routes
      if (waypoints && Array.isArray(waypoints) && waypoints.length > 0) {
        for (const waypoint of waypoints) {
          await db.insert(tripWaypoints).values({
            tripId: trip.id,
            waypointOrder: waypoint.waypointOrder,
            waypointType: waypoint.waypointType,
            locationType: waypoint.locationType,
            structureId: waypoint.structureId || null,
            departmentId: waypoint.departmentId || null,
            address: waypoint.address || null,
            latitude: waypoint.latitude || null,
            longitude: waypoint.longitude || null,
            kmFromPrevious: waypoint.kmFromPrevious || null,
          });
        }
      }
      
      // Create device authorization if provided
      if (deviceAuthorization) {
        await storage.createDeviceAuthorization({
          tripId: trip.id,
          authorizerType: deviceAuthorization.authorizerType,
          authorizerName: deviceAuthorization.authorizerName || null,
          signatureData: deviceAuthorization.signatureData || null,
          notes: deviceAuthorization.notes || null,
        });
      }
      
      // Update vehicle km
      await storage.updateVehicleKm(tripData.vehicleId, tripData.kmFinal);
      
      // Create audit log for trip creation - support both session and token auth
      const reqUserId = getUserId(req);
      const user = reqUserId ? await storage.getUser(reqUserId) : null;
      await storage.createAuditLog({
        action: "create",
        entityType: "trip",
        entityId: trip.id,
        userId: user?.id || null,
        userName: user?.name || "Sistema",
        changes: JSON.stringify({ newValue: trip, hasDeviceAuth: !!deviceAuthorization }),
      });
      
      // New tamper-proof audit log with hash chain
      await auditLog.create("trip", trip.id, `Viaggio #${trip.progressiveNumber || trip.id}`, trip as unknown as Record<string, unknown>);
      
      // Sign the trip if it's complete (has returnTime)
      if (tripData.returnTime) {
        try {
          await signTrip(trip.id);
        } catch (signError) {
          console.error("Error signing trip:", signError);
          // Don't fail the request, just log the error
        }
      }
      
      // Automatically calculate carbon footprint for ESG dashboard and Carbon Tracker
      await calculateCarbonFootprintForTrip(trip.id, tripData.vehicleId, tripData.kmTraveled);
      
      // Auto-detect SLA violations with org-specific thresholds
      if (tripData.scheduledDepartureTime && tripData.departureTime) {
        try {
          let thresholdMinor = 30;
          let thresholdMajor = 60;
          if (trip.organizationId) {
            const [orgRow] = await db.select({ slaThresholdMinor: organizations.slaThresholdMinor, slaThresholdMajor: organizations.slaThresholdMajor }).from(organizations).where(eq(organizations.id, trip.organizationId));
            if (orgRow) {
              thresholdMinor = orgRow.slaThresholdMinor || 30;
              thresholdMajor = orgRow.slaThresholdMajor || 60;
            }
          }
          const scheduled = tripData.scheduledDepartureTime.split(":").map(Number);
          const actual = tripData.departureTime.split(":").map(Number);
          let delayMinutes = (actual[0] * 60 + (actual[1] || 0)) - (scheduled[0] * 60 + (scheduled[1] || 0));
          if (delayMinutes < -720) delayMinutes += 1440;
          if (delayMinutes >= thresholdMinor) {
            await storage.updateTrip(trip.id, {
              slaViolation: true,
              slaViolationMinutes: delayMinutes,
              slaViolationType: delayMinutes >= thresholdMajor ? "delay_60min" : "late_30min",
            });
          } else {
            await storage.updateTrip(trip.id, {
              slaViolation: false,
              slaViolationMinutes: null,
              slaViolationType: null,
            });
          }
        } catch (slaErr) {
          console.error("SLA check error on create:", slaErr);
        }
      }
      
      res.status(201).json(trip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/trips/:id", requireAuth, async (req, res) => {
    try {
      // Get old trip for comparison
      const oldTrip = await storage.getTrip(req.params.id);
      if (!oldTrip) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      
      // Check if trip was signed and if signed fields are being modified
      const modifiedFields = Object.keys(req.body);
      if (oldTrip.integrityStatus === "VALID") {
        await checkAndInvalidateIntegrity(req.params.id, modifiedFields);
      }
      
      const trip = await storage.updateTrip(req.params.id, req.body);
      
      // Only log if update succeeded
      if (!trip) {
        return res.status(500).json({ error: "Aggiornamento fallito" });
      }
      
      // Create audit log for trip update - support both session and token auth
      const reqUserId = getUserId(req);
      const user = reqUserId ? await storage.getUser(reqUserId) : null;
      await storage.createAuditLog({
        action: "update",
        entityType: "trip",
        entityId: req.params.id,
        userId: user?.id || null,
        userName: user?.name || "Sistema",
        changes: JSON.stringify({ oldValue: oldTrip, newValue: trip }),
      });
      
      // Sign the trip if it just became complete (returnTime was added)
      if (req.body.returnTime && !oldTrip.returnTime && trip.integrityStatus !== "BROKEN") {
        try {
          await signTrip(trip.id);
        } catch (signError) {
          console.error("Error signing trip on update:", signError);
        }
      }
      
      // Update carbon footprint if km changed
      if (req.body.kmTraveled !== undefined || req.body.vehicleId !== undefined) {
        await calculateCarbonFootprintForTrip(
          trip.id, 
          trip.vehicleId, 
          trip.kmTraveled
        );
      }
      
      // Auto-detect SLA violations on update with org-specific thresholds
      const finalTrip = await storage.getTrip(trip.id);
      if (finalTrip && finalTrip.scheduledDepartureTime && finalTrip.departureTime) {
        try {
          let thresholdMinor = 30;
          let thresholdMajor = 60;
          if (finalTrip.organizationId) {
            const [orgRow] = await db.select({ slaThresholdMinor: organizations.slaThresholdMinor, slaThresholdMajor: organizations.slaThresholdMajor }).from(organizations).where(eq(organizations.id, finalTrip.organizationId));
            if (orgRow) {
              thresholdMinor = orgRow.slaThresholdMinor || 30;
              thresholdMajor = orgRow.slaThresholdMajor || 60;
            }
          }
          const scheduled = finalTrip.scheduledDepartureTime.split(":").map(Number);
          const actual = finalTrip.departureTime.split(":").map(Number);
          let delayMinutes = (actual[0] * 60 + (actual[1] || 0)) - (scheduled[0] * 60 + (scheduled[1] || 0));
          if (delayMinutes < -720) delayMinutes += 1440;
          if (delayMinutes >= thresholdMinor) {
            await storage.updateTrip(trip.id, {
              slaViolation: true,
              slaViolationMinutes: delayMinutes,
              slaViolationType: delayMinutes >= thresholdMajor ? "delay_60min" : "late_30min",
            });
          } else {
            await storage.updateTrip(trip.id, {
              slaViolation: false,
              slaViolationMinutes: null,
              slaViolationType: null,
            });
          }
        } catch (slaErr) {
          console.error("SLA check error on update:", slaErr);
        }
      }
      
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Bulk delete trips
  app.post("/api/trips/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const { tripIds } = req.body;
      
      if (!tripIds || !Array.isArray(tripIds) || tripIds.length === 0) {
        return res.status(400).json({ error: "Nessun viaggio selezionato" });
      }
      
      // Limit bulk delete to prevent abuse
      if (tripIds.length > 100) {
        return res.status(400).json({ error: "Massimo 100 viaggi per eliminazione" });
      }
      
      const reqUserId = getUserId(req);
      const user = reqUserId ? await storage.getUser(reqUserId) : null;
      const orgId = getEffectiveOrgId(req);
      const isOrg = isOrgAdmin(req) && orgId;
      
      let deletedCount = 0;
      const errors: string[] = [];
      
      for (const tripId of tripIds) {
        try {
          const tripToDelete = await storage.getTrip(tripId);
          if (!tripToDelete) {
            errors.push(`Viaggio ${tripId} non trovato`);
            continue;
          }
          
          if (isOrg && tripToDelete.organizationId !== orgId) {
            errors.push(`Non autorizzato a eliminare viaggio ${tripId}`);
            continue;
          }
          
          const deleted = await storage.deleteTrip(tripId);
          if (deleted) {
            deletedCount++;
            
            // Create audit log for each deletion
            await storage.createAuditLog({
              action: "delete",
              entityType: "trip",
              entityId: tripId,
              userId: user?.id || null,
              userName: user?.name || "Sistema",
              changes: JSON.stringify({ oldValue: tripToDelete, bulkDelete: true }),
            });
          } else {
            errors.push(`Eliminazione viaggio ${tripId} fallita`);
          }
        } catch (err) {
          errors.push(`Errore eliminazione viaggio ${tripId}`);
        }
      }
      
      res.json({ 
        success: deletedCount > 0, 
        deletedCount, 
        requestedCount: tripIds.length,
        errors: errors.length > 0 ? errors : undefined 
      });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/trips/:id", requireAuth, async (req, res) => {
    try {
      // Get trip before deletion for audit log
      const tripToDelete = await storage.getTrip(req.params.id);
      if (!tripToDelete) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      
      const deleted = await storage.deleteTrip(req.params.id);
      
      // Only log if deletion succeeded
      if (!deleted) {
        return res.status(500).json({ error: "Eliminazione fallita" });
      }
      
      // Create audit log for trip deletion - support both session and token auth
      const reqUserId = getUserId(req);
      const user = reqUserId ? await storage.getUser(reqUserId) : null;
      await storage.createAuditLog({
        action: "delete",
        entityType: "trip",
        entityId: req.params.id,
        userId: user?.id || null,
        userName: user?.name || "Sistema",
        changes: JSON.stringify({ oldValue: tripToDelete }),
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/vehicles/:vehicleId/next-progressive", requireAuth, async (req, res) => {
    try {
      const progressiveNumber = await storage.getNextProgressiveNumber(req.params.vehicleId);
      res.json({ progressiveNumber });
    } catch (error) {
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // In-memory cache for address autocomplete (expires after 10 minutes)
  const addressCache = new Map<string, { data: any[]; timestamp: number }>();
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  const MAX_CACHE_SIZE = 200;

  app.get("/api/address-autocomplete", async (req, res) => {
    try {
      const { q, lat, lon } = req.query;
      if (!q || typeof q !== "string" || q.length < 3) {
        return res.json([]);
      }

      // Normalize query for cache key (include location for location-biased caching)
      const locationKey = lat && lon ? `@${lat},${lon}` : "";
      const cacheKey = q.toUpperCase().trim() + locationKey;
      
      // Check cache first
      const cached = addressCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      // Use Google Places API if available
      if (googleApiKey) {
        try {
          // Google Places Autocomplete API with location bias
          let googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=address&components=country:it&language=it&key=${googleApiKey}`;
          
          // Add location bias if coordinates provided (30km radius)
          if (lat && lon && typeof lat === "string" && typeof lon === "string") {
            googleUrl += `&location=${lat},${lon}&radius=30000`;
          }
          
          const googleController = new AbortController();
          const googleTimeout = setTimeout(() => googleController.abort(), 3000);
          
          const response = await fetch(googleUrl, { signal: googleController.signal });
          clearTimeout(googleTimeout);
          const data = await response.json();
          
          if (data.status === "OK" && data.predictions) {
            const suggestions = data.predictions.slice(0, 6).map((prediction: any) => {
              const mainText = prediction.structured_formatting?.main_text || "";
              const secondaryText = prediction.structured_formatting?.secondary_text || "";
              const parts = secondaryText.split(", ");
              
              return {
                displayName: prediction.description,
                address: {
                  road: mainText.replace(/,?\s*\d+\s*$/, ""),
                  house_number: mainText.match(/\d+$/)?.[0] || "",
                  city: parts[0] || "",
                  municipality: parts[1] || "",
                  county: parts[1] || "",
                  state: parts[2] || "",
                  postcode: "",
                },
                lat: "",
                lon: "",
                placeId: prediction.place_id,
              };
            });
            
            if (addressCache.size >= MAX_CACHE_SIZE) {
              const oldestKey = addressCache.keys().next().value;
              if (oldestKey) addressCache.delete(oldestKey);
            }
            addressCache.set(cacheKey, { data: suggestions, timestamp: Date.now() });
            
            return res.json(suggestions);
          } else if (data.status === "ZERO_RESULTS") {
            return res.json([]);
          }
          console.log("Google Places API status:", data.status, data.error_message || "");
        } catch (googleError: any) {
          if (googleError?.name !== "AbortError") {
            console.log("Google Places API error, falling back to Nominatim");
          }
        }
      }

      // Fallback to Nominatim API (OpenStreetMap)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const searchQuery = q.includes(",") ? q : `${q}, Veneto, Italia`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=8&countrycodes=it`;
        const response = await fetch(
          url,
          {
            headers: {
              "User-Agent": "CroceEuropaTransportApp/1.0 (contact@croceeuropa.it)",
              "Accept": "application/json",
              "Accept-Language": "it",
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          console.log("Nominatim API error:", response.status);
          return res.json([]);
        }

        const data = await response.json();
        
        // Priority provinces for SOCCORSO DIGITALE operations
        const priorityProvinces = ["verona", "vicenza", "padova"];
        
        function getPriorityScore(addr: any): number {
          const county = (addr.county || "").toLowerCase();
          const stateDistrict = (addr.state_district || "").toLowerCase();
          const displayName = (addr.display_name || "").toLowerCase();
          
          if (priorityProvinces.includes(county)) return 100;
          if (priorityProvinces.some(p => stateDistrict.includes(p))) return 90;
          if (priorityProvinces.some(p => displayName.includes(p))) return 80;
          if ((addr.state || "").toLowerCase() === "veneto") return 50;
          return 0;
        }
        
        const suggestions = data
          .map((item: any) => {
            const addr = item.address || {};
            const priority = getPriorityScore({ ...addr, display_name: item.display_name });
            
            return {
              displayName: item.display_name || "",
              address: {
                road: addr.road || addr.pedestrian || addr.footway || item.name || "",
                house_number: addr.house_number || "",
                city: addr.city || addr.town || addr.village || addr.municipality || "",
                municipality: addr.municipality || addr.county || "",
                county: addr.county || addr.state || "",
                state: addr.state || "Veneto",
                postcode: addr.postcode || "",
              },
              lat: item.lat || "",
              lon: item.lon || "",
              priority,
            };
          })
          .sort((a: any, b: any) => b.priority - a.priority)
          .slice(0, 5)
          .map(({ priority, ...rest }: any) => rest);

        if (addressCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = addressCache.keys().next().value;
          if (oldestKey) addressCache.delete(oldestKey);
        }
        addressCache.set(cacheKey, { data: suggestions, timestamp: Date.now() });

        res.json(suggestions);
      } catch (fetchError: any) {
        if (fetchError.name === "AbortError") {
          console.log("Address autocomplete timeout for:", q);
          return res.json([]);
        }
        throw fetchError;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error("Address autocomplete error:", error);
      res.json([]);
    }
  });

  // Get place details (coordinates) for a selected address
  app.get("/api/place-details", async (req, res) => {
    try {
      const { placeId } = req.query;
      if (!placeId || typeof placeId !== "string") {
        return res.json({ lat: null, lon: null });
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!googleApiKey) {
        return res.json({ lat: null, lon: null });
      }

      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${googleApiKey}`;
      const response = await fetch(detailsUrl);
      const data = await response.json();
      
      if (data.status === "OK" && data.result?.geometry?.location) {
        return res.json({
          lat: data.result.geometry.location.lat.toString(),
          lon: data.result.geometry.location.lng.toString(),
        });
      }
      
      res.json({ lat: null, lon: null });
    } catch (error) {
      console.error("Place details error:", error);
      res.json({ lat: null, lon: null });
    }
  });

  // Places autocomplete for navigator
  app.get("/api/places/autocomplete", async (req, res) => {
    try {
      const { query, country } = req.query;
      if (!query || typeof query !== "string" || query.length < 3) {
        return res.json({ predictions: [] });
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!googleApiKey) {
        return res.json({ predictions: [] });
      }

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:${country || "it"}&language=it&key=${googleApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK") {
        return res.json({ predictions: data.predictions });
      }
      
      res.json({ predictions: [] });
    } catch (error) {
      console.error("Places autocomplete error:", error);
      res.json({ predictions: [] });
    }
  });

  // Place details with location
  app.get("/api/places/details", async (req, res) => {
    try {
      const { place_id } = req.query;
      if (!place_id || typeof place_id !== "string") {
        return res.status(400).json({ error: "Missing place_id" });
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!googleApiKey) {
        return res.status(500).json({ error: "API key not configured" });
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry,formatted_address&key=${googleApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.result) {
        return res.json({
          location: data.result.geometry.location,
          formatted_address: data.result.formatted_address,
        });
      }

      res.status(404).json({ error: "Place not found" });
    } catch (error) {
      console.error("Place details error:", error);
      res.status(500).json({ error: "Failed to get place details" });
    }
  });

  // Directions API for route calculation
  app.get("/api/directions", async (req, res) => {
    try {
      const { origin, destination } = req.query;
      if (!origin || !destination || typeof origin !== "string" || typeof destination !== "string") {
        return res.status(400).json({ error: "Missing origin or destination" });
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!googleApiKey) {
        return res.status(500).json({ error: "API key not configured" });
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&language=it&key=${googleApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Decode polyline
        const polyline = decodePolyline(route.overview_polyline.points);
        
        return res.json({
          distance: leg.distance.value / 1000, // Convert to km
          duration: leg.duration.value / 60, // Convert to minutes
          polyline,
          start_address: leg.start_address,
          end_address: leg.end_address,
        });
      }

      res.status(404).json({ error: "No route found" });
    } catch (error) {
      console.error("Directions error:", error);
      res.status(500).json({ error: "Failed to get directions" });
    }
  });

  // Helper function to decode Google Maps polyline
  function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const poly: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return poly;
  }

  // Helper function to sanitize domicilio addresses (remove civic numbers for privacy)
  function sanitizeDomicilioAddress(address: string): string {
    // Remove civic numbers (patterns like ", 15" or " 123" or ",15")
    let sanitized = address
      .replace(/,\s*\d+[a-zA-Z]?(?=\s|,|$)/g, "") // ",123" or ", 123A"
      .replace(/\s+\d+[a-zA-Z]?(?=\s|,|$)/g, "") // " 123" at end or before comma
      .replace(/\s+n\.\s*\d+[a-zA-Z]?/gi, "") // "n. 123"
      .replace(/\s+n°\s*\d+[a-zA-Z]?/gi, ""); // "n° 123"
    
    // Convert to uppercase
    return sanitized.toUpperCase().trim();
  }

  // Helper function to geocode an address with timeout (uses Google Geocoding API, Nominatim as fallback)
  async function geocodeAddress(address: string, isDomicilio: boolean = false, locationContext?: string, biasCoords?: { lat: number; lon: number }): Promise<{ lat: string; lon: string } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const preciseTypes = ["street_address", "route", "intersection", "premise", "subpremise", "establishment", "point_of_interest", "locality", "sublocality", "neighborhood", "postal_code", "airport", "park", "bus_station", "train_station", "transit_station", "hospital", "church"];
    
    function isResultPrecise(result: any): boolean {
      const resultTypes = result.types || [];
      if (resultTypes.includes("country")) return false;
      const hasPreciseType = resultTypes.some((t: string) => preciseTypes.includes(t));
      return hasPreciseType;
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
              console.log(`[Geocode] Google returned only vague results for "${address}", trying Nominatim`);
            }
          }
        } catch (googleError) {
          console.log("Google Geocoding failed, trying Nominatim");
        }
      }
      
      const nominatimQueries = [sanitizedAddress];
      if (locationContext) {
        nominatimQueries.unshift(`${sanitizedAddress}, ${locationContext}`);
      }
      
      for (const query of nominatimQueries) {
        try {
          let nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=it`;
          if (biasCoords) {
            nomUrl += `&viewbox=${biasCoords.lon - 0.5},${biasCoords.lat + 0.5},${biasCoords.lon + 0.5},${biasCoords.lat - 0.5}&bounded=0`;
          }
          const response = await fetch(nomUrl, {
            headers: {
              "User-Agent": "SoccorsoDigitaleApp/1.0 (info@soccorsodigitale.app)",
              "Accept-Language": "it",
            },
            signal: controller.signal,
          });
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              clearTimeout(timeout);
              return { lat: data[0].lat, lon: data[0].lon };
            }
          }
        } catch {}
      }
      
      clearTimeout(timeout);
      return null;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  // Calculate straight-line distance in km using Haversine formula
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Distance calculation endpoint using OSRM
  app.post("/api/distance", async (req, res) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const { originStructureId, originAddress, destinationStructureId, destinationAddress, originIsDomicilio, destinationIsDomicilio, locationContext: reqLocationContext } = req.body;

      let originCoords: { lat: string; lon: string } | null = null;
      let destCoords: { lat: string; lon: string } | null = null;
      let locationCtx: string | undefined = reqLocationContext;

      let biasCoords: { lat: number; lon: number } | undefined;

      if (!locationCtx) {
        try {
          const user = (req as any).user as any;
          if (user?.locationId) {
            const userLoc = await storage.getLocation(user.locationId);
            if (userLoc?.address) {
              const addrParts = userLoc.address.match(/\(([A-Z]{2})\)/);
              const province = addrParts ? addrParts[1] : "";
              locationCtx = userLoc.name + (province ? ` (${province})` : "");
            } else if (userLoc?.name) {
              locationCtx = userLoc.name;
            }
          }
        } catch {}
      }

      async function resolveCoords(structureId: string | null, address: string | null, isDomicilio: boolean): Promise<{ lat: string; lon: string } | null> {
        if (structureId) {
          const structure = await storage.getStructureById(structureId);
          if (structure) {
            if (structure.latitude && structure.longitude) {
              return { lat: structure.latitude, lon: structure.longitude };
            } else if (structure.address) {
              const coords = await geocodeAddress(structure.address, false, locationCtx, biasCoords);
              if (coords) {
                await storage.updateStructureCoords(structureId, coords.lat, coords.lon);
              }
              return coords;
            }
          }
          const location = await storage.getLocation(structureId);
          if (location?.address) {
            return await geocodeAddress(location.address, false, locationCtx, biasCoords);
          }
        }
        if (address) {
          return await geocodeAddress(address, isDomicilio, locationCtx, biasCoords);
        }
        return null;
      }

      originCoords = await resolveCoords(originStructureId, originAddress, !!originIsDomicilio);
      if (originCoords) {
        biasCoords = { lat: parseFloat(originCoords.lat), lon: parseFloat(originCoords.lon) };
      }
      destCoords = await resolveCoords(destinationStructureId, destinationAddress, !!destinationIsDomicilio);

      if (!originCoords || !destCoords) {
        clearTimeout(timeout);
        return res.status(400).json({ 
          error: "Impossibile geocodificare gli indirizzi",
          originFound: !!originCoords,
          destFound: !!destCoords 
        });
      }

      // Calculate straight-line distance for fallback
      const straightLineKm = haversineDistance(
        parseFloat(originCoords.lat), 
        parseFloat(originCoords.lon),
        parseFloat(destCoords.lat), 
        parseFloat(destCoords.lon)
      );
      // Road distance is typically 1.3x straight-line distance
      const fallbackDistanceKm = Math.round(straightLineKm * 1.3);

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (googleApiKey) {
        try {
          const gUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originCoords.lat},${originCoords.lon}&destination=${destCoords.lat},${destCoords.lon}&mode=driving&language=it&key=${googleApiKey}`;
          const gRes = await fetch(gUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (gRes.ok) {
            const gData = await gRes.json();
            if (gData.status === "OK" && gData.routes?.length > 0) {
              const leg = gData.routes[0].legs[0];
              return res.json({
                distanceKm: Math.round(leg.distance.value / 1000),
                distanceMeters: leg.distance.value,
                durationMinutes: Math.round(leg.duration.value / 60),
                origin: originCoords,
                destination: destCoords,
                method: "google",
              });
            }
          }
        } catch (gErr: any) {
          clearTimeout(timeout);
          console.log("Google Directions failed, trying OSRM fallback");
        }
      }

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
        const routeResponse = await fetch(osrmUrl, {
          headers: { "User-Agent": "SoccorsoDigitaleApp/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (routeResponse.ok) {
          const routeData = await routeResponse.json();
          if (routeData.code === "Ok" && routeData.routes?.length > 0) {
            const distanceMeters = routeData.routes[0].distance;
            return res.json({
              distanceKm: Math.round(distanceMeters / 1000),
              distanceMeters,
              durationMinutes: Math.round(routeData.routes[0].duration / 60),
              origin: originCoords,
              destination: destCoords,
              method: "osrm",
            });
          }
        }
      } catch (osrmErr: any) {
        console.log("OSRM also failed, using estimate");
      }

      res.json({
        distanceKm: fallbackDistanceKm,
        distanceMeters: fallbackDistanceKm * 1000,
        durationMinutes: Math.round(fallbackDistanceKm * 1.5),
        origin: originCoords,
        destination: destCoords,
        method: "estimate",
      });
    } catch (error: any) {
      clearTimeout(timeout);
      console.error("Distance calculation error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // PDF Report Generation

  app.get("/api/reports/trips-pdf", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, vehicleId, locationId, format } = req.query;
      const orgId = getEffectiveOrgId(req);
      
      // Get organization-scoped data
      let allVehicles: any[];
      let allLocations: any[];
      if (orgId) {
        allVehicles = await db.select().from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId)).orderBy(vehiclesTable.code);
        allLocations = await db.select().from(locations).where(eq(locations.organizationId, orgId)).orderBy(locations.name);
      } else {
        allVehicles = await storage.getVehicles();
        allLocations = await storage.getLocations();
      }
      
      // Build org-scoped filters for trips
      const orgVehicleIds = allVehicles.map(v => v.id);
      let tripsResult = await storage.getTripsFiltered({
        dateFrom: startDate as string | undefined,
        dateTo: endDate as string | undefined,
        organizationId: orgId || undefined,
        vehicleIds: vehicleId ? [vehicleId as string] : undefined,
      });
      
      // Filter trips
      let filteredTrips = tripsResult;
      
      if (locationId) {
        const locationVehicleIds = allVehicles
          .filter(v => v.locationId === locationId)
          .map(v => v.id);
        filteredTrips = filteredTrips.filter(t => locationVehicleIds.includes(t.vehicleId));
      }
      
      // Enrich trips with structure names
      const enrichedTrips = await enrichTrips(filteredTrips);
      
      // Sort by date descending
      enrichedTrips.sort((a, b) => 
        new Date(b.serviceDate || b.createdAt).getTime() - new Date(a.serviceDate || a.createdAt).getTime()
      );
      
      // Calculate totals
      const totalKm = enrichedTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const totalDuration = enrichedTrips.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
      const avgKmPerTrip = enrichedTrips.length > 0 ? Math.round(totalKm / enrichedTrips.length) : 0;
      
      // Format date range for header
      const formatDateIT = (date: Date) => date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const dateRangeStr = startDate && endDate 
        ? `${formatDateIT(new Date(startDate as string))} - ${formatDateIT(new Date(endDate as string))}`
        : 'Tutti i periodi';
      
      // Get vehicle/location name for header
      const vehicleName = vehicleId ? allVehicles.find(v => v.id === vehicleId)?.code || '' : 'Tutti';
      const locationName = locationId ? allLocations.find(l => l.id === locationId)?.name || '' : 'Tutte';
      
      // If JSON format requested (for mobile app)
      if (format === 'json') {
        return res.json({
          meta: {
            dateRange: dateRangeStr,
            vehicle: vehicleName,
            location: locationName,
            totalTrips: enrichedTrips.length,
            totalKm,
            totalDuration,
            avgKmPerTrip,
            generatedAt: new Date().toISOString(),
          },
          trips: enrichedTrips.map(t => ({
            id: t.id,
            progressive: t.progressiveNumber,
            date: t.serviceDate,
            vehicle: allVehicles.find(v => v.id === t.vehicleId)?.code || '',
            serviceType: t.serviceType,
            origin: t.originStructureName || t.originAddress || '',
            destination: t.destinationStructureName || t.destinationAddress || '',
            kmStart: t.kmStart,
            kmFinal: t.kmFinal,
            kmTraveled: t.kmTraveled,
            duration: t.durationMinutes,
          })),
        });
      }
      
      // Fetch organization name for report branding - use effective org (respects admin org filter)
      let reportOrgName = 'SOCCORSO DIGITALE';
      let reportOrgInitials = 'SD';
      const effectiveOrgId = orgId;
      if (effectiveOrgId) {
        const [effectiveOrg] = await db.select().from(organizations).where(eq(organizations.id, effectiveOrgId)).limit(1);
        if (effectiveOrg) {
          reportOrgName = effectiveOrg.name;
          reportOrgInitials = effectiveOrg.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
        }
      }

      // Generate HTML report for printing
      const tripRows = enrichedTrips.map(t => {
        const vehicle = allVehicles.find(v => v.id === t.vehicleId);
        const date = new Date(t.serviceDate || t.createdAt);
        const origin = t.originStructureName || t.originAddress || '-';
        const dest = t.destinationStructureName || t.destinationAddress || '-';
        const serviceTypeLabel = t.serviceType === 'emergenza' ? 'Emergenza' : 
                                 t.serviceType === 'ordinario' ? 'Ordinario' : 
                                 t.serviceType === 'dimissione' ? 'Dimissione' : t.serviceType || '-';
        
        return `
          <tr>
            <td>${t.progressiveNumber || '-'}</td>
            <td>${formatDateIT(date)}</td>
            <td>${vehicle?.code || '-'}</td>
            <td><span class="badge ${t.serviceType}">${serviceTypeLabel}</span></td>
            <td class="origin">${origin}</td>
            <td class="destination">${dest}</td>
            <td class="number">${(t.kmStart || 0).toLocaleString('it-IT')}</td>
            <td class="number">${(t.kmFinal || 0).toLocaleString('it-IT')}</td>
            <td class="number highlight">${(t.kmTraveled || 0).toLocaleString('it-IT')}</td>
            <td class="number">${t.durationMinutes ? `${t.durationMinutes} min` : '-'}</td>
          </tr>
        `;
      }).join('');
      
      const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Viaggi - ${reportOrgName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
      color: #1a1a2e; 
      line-height: 1.5;
      padding: 20px;
      background: #f8fafc;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #0066CC;
    }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon { 
      width: 48px; 
      height: 48px; 
      background: linear-gradient(135deg, #0066CC, #0052a3);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    }
    .company-name { font-size: 24px; font-weight: 700; color: #0066CC; }
    .report-title { font-size: 14px; color: #666; margin-top: 4px; }
    .header-right { text-align: right; font-size: 13px; color: #666; }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 4px solid #0066CC;
    }
    .summary-card.km { border-left-color: #10B981; }
    .summary-card.duration { border-left-color: #F59E0B; }
    .summary-card.avg { border-left-color: #8B5CF6; }
    .summary-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-value { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-top: 4px; }
    .summary-card.km .summary-value { color: #10B981; }
    .summary-card.duration .summary-value { color: #F59E0B; }
    .summary-card.avg .summary-value { color: #8B5CF6; }
    
    .filters-info {
      background: #e8f4fc;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #0066CC;
    }
    .filters-info strong { color: #004a99; }
    
    table { 
      width: 100%; 
      border-collapse: collapse; 
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th { 
      background: #0066CC; 
      color: white; 
      padding: 12px 10px;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td { 
      padding: 10px; 
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f0f7ff; }
    
    .number { text-align: right; font-family: 'SF Mono', Consolas, monospace; }
    .highlight { font-weight: 600; color: #0066CC; }
    .origin, .destination { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge.emergenza { background: #FEE2E2; color: #DC2626; }
    .badge.ordinario { background: #DBEAFE; color: #2563EB; }
    .badge.dimissione { background: #D1FAE5; color: #059669; }
    
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .summary-cards { grid-template-columns: repeat(4, 1fr); }
      .summary-card { box-shadow: none; border: 1px solid #ddd; }
      table { box-shadow: none; border: 1px solid #ddd; }
      .no-print { display: none; }
      @page { margin: 15mm; }
    }
    
    .print-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0066CC;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,102,204,0.3);
    }
    .print-btn:hover { background: #0052a3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">${reportOrgInitials}</div>
        <div>
          <div class="company-name">${reportOrgName}</div>
          <div class="report-title">Report Viaggi</div>
        </div>
      </div>
      <div class="header-right">
        <div>Generato il: ${formatDateIT(new Date())} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
    
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-label">Totale Viaggi</div>
        <div class="summary-value">${enrichedTrips.length.toLocaleString('it-IT')}</div>
      </div>
      <div class="summary-card km">
        <div class="summary-label">Km Totali</div>
        <div class="summary-value">${totalKm.toLocaleString('it-IT')}</div>
      </div>
      <div class="summary-card duration">
        <div class="summary-label">Durata Totale</div>
        <div class="summary-value">${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m</div>
      </div>
      <div class="summary-card avg">
        <div class="summary-label">Media Km/Viaggio</div>
        <div class="summary-value">${avgKmPerTrip.toLocaleString('it-IT')}</div>
      </div>
    </div>
    
    <div class="filters-info">
      <strong>Filtri applicati:</strong> Periodo: ${dateRangeStr} | Veicolo: ${vehicleName} | Sede: ${locationName}
    </div>
    
    <table>
      <thead>
        <tr>
          <th>N.</th>
          <th>Data</th>
          <th>Veicolo</th>
          <th>Tipo</th>
          <th>Origine</th>
          <th>Destinazione</th>
          <th>Km Inizio</th>
          <th>Km Fine</th>
          <th>Km Percorsi</th>
          <th>Durata</th>
        </tr>
      </thead>
      <tbody>
        ${tripRows || '<tr><td colspan="10" style="text-align:center;color:#999;padding:40px;">Nessun viaggio trovato per i filtri selezionati</td></tr>'}
      </tbody>
    </table>
    
    <div class="footer">
      SOCCORSO DIGITALE - Piattaforma di Gestione Trasporti Sanitari<br>
      Documento generato automaticamente per ${reportOrgName}
    </div>
  </div>
  
  <button class="print-btn no-print" onclick="window.print()">
    Stampa / Salva PDF
  </button>
</body>
</html>
      `;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error("Error generating PDF report:", error);
      res.status(500).json({ error: "Errore nella generazione del report" });
    }
  });

  // Single trip PDF report
  app.get("/api/reports/trip/:id/pdf", requireAuth, async (req, res) => {
    try {
      const trip = await storage.getTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      
      const enrichedTrips = await enrichTrips([trip]);
      const enrichedTrip = enrichedTrips[0];
      
      const allVehicles = await storage.getVehicles();
      const allLocations = await storage.getLocations();
      
      const vehicle = allVehicles.find(v => v.id === trip.vehicleId);
      const location = vehicle ? allLocations.find(l => l.id === vehicle.locationId) : null;
      
      // Fetch organization name for branding
      let tripOrgName = 'SOCCORSO DIGITALE';
      let tripOrgInitials = 'SD';
      if (trip.organizationId) {
        const [tripOrg] = await db.select().from(organizations).where(eq(organizations.id, trip.organizationId)).limit(1);
        if (tripOrg) {
          tripOrgName = tripOrg.name;
          tripOrgInitials = tripOrg.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
        }
      }

      const formatDateIT = (date: Date) => date.toLocaleDateString('it-IT', { 
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' 
      });
      const formatTimeIT = (date: Date) => date.toLocaleTimeString('it-IT', { 
        hour: '2-digit', minute: '2-digit' 
      });
      
      const serviceDate = new Date(trip.serviceDate || trip.createdAt);
      const serviceTypeLabel = trip.serviceType === 'emergenza' ? 'Emergenza' : 
                               trip.serviceType === 'ordinario' ? 'Ordinario' : 
                               trip.serviceType === 'dimissione' ? 'Dimissione' : trip.serviceType || '-';
      
      const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scheda Viaggio #${trip.progressiveNumber} - ${tripOrgName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', system-ui, sans-serif; 
      color: #1a1a2e; 
      line-height: 1.6;
      padding: 30px;
      background: #f8fafc;
    }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
    
    .header { 
      background: linear-gradient(135deg, #0066CC, #004a99);
      color: white;
      padding: 24px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon { 
      width: 48px; height: 48px; 
      background: rgba(255,255,255,0.2);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 18px;
    }
    .company-name { font-size: 22px; font-weight: 700; }
    .trip-number { 
      background: white; 
      color: #0066CC; 
      padding: 8px 20px; 
      border-radius: 30px;
      font-weight: 700;
      font-size: 18px;
    }
    
    .content { padding: 30px; }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-card {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      border-left: 4px solid #0066CC;
    }
    .info-card.vehicle { border-left-color: #8B5CF6; }
    .info-card.type { border-left-color: #F59E0B; }
    .info-card.date { border-left-color: #10B981; }
    .info-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-value { font-size: 16px; font-weight: 600; color: #1a1a2e; }
    
    .route-section { margin-bottom: 30px; }
    .section-title { 
      font-size: 14px; 
      font-weight: 600; 
      color: #666; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #eee;
    }
    .route-card {
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 12px;
    }
    .route-icon {
      width: 40px; height: 40px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .route-icon.origin { background: #DBEAFE; color: #2563EB; }
    .route-icon.destination { background: #D1FAE5; color: #059669; }
    .route-icon svg { width: 20px; height: 20px; }
    .route-details h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .route-details p { font-size: 13px; color: #666; }
    
    .km-section {
      background: linear-gradient(135deg, #f0f7ff, #e8f4fc);
      border-radius: 12px;
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      text-align: center;
    }
    .km-item label { font-size: 11px; color: #666; text-transform: uppercase; }
    .km-item .value { font-size: 28px; font-weight: 700; color: #0066CC; margin-top: 4px; }
    .km-item.traveled .value { color: #10B981; }
    
    .footer-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; border: 1px solid #ddd; }
      .no-print { display: none; }
      @page { margin: 15mm; }
    }
    
    .print-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0066CC;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,102,204,0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">${tripOrgInitials}</div>
        <div class="company-name">${tripOrgName}</div>
      </div>
      <div class="trip-number">Viaggio #${trip.progressiveNumber || trip.id.slice(0,8)}</div>
    </div>
    
    <div class="content">
      <div class="info-grid">
        <div class="info-card date">
          <div class="info-label">Data Servizio</div>
          <div class="info-value">${formatDateIT(serviceDate)}</div>
        </div>
        <div class="info-card type">
          <div class="info-label">Tipo Servizio</div>
          <div class="info-value">${serviceTypeLabel}</div>
        </div>
        <div class="info-card vehicle">
          <div class="info-label">Veicolo</div>
          <div class="info-value">${vehicle?.code || '-'} (${vehicle?.model || '-'})</div>
        </div>
        <div class="info-card">
          <div class="info-label">Sede</div>
          <div class="info-value">${location?.name || '-'}</div>
        </div>
      </div>
      
      <div class="route-section">
        <div class="section-title">Percorso</div>
        <div class="route-card">
          <div class="route-icon origin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/></svg>
          </div>
          <div class="route-details">
            <h4>Origine</h4>
            <p>${enrichedTrip.originStructureName || enrichedTrip.originAddress || '-'}</p>
            ${enrichedTrip.originDepartmentName ? `<p style="color:#888;font-size:12px;">${enrichedTrip.originDepartmentName}</p>` : ''}
          </div>
        </div>
        <div class="route-card">
          <div class="route-icon destination">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div class="route-details">
            <h4>Destinazione</h4>
            <p>${enrichedTrip.destinationStructureName || enrichedTrip.destinationAddress || '-'}</p>
            ${enrichedTrip.destinationDepartmentName ? `<p style="color:#888;font-size:12px;">${enrichedTrip.destinationDepartmentName}</p>` : ''}
          </div>
        </div>
      </div>
      
      <div class="section-title">Chilometraggio</div>
      <div class="km-section">
        <div class="km-item">
          <label>Km Partenza</label>
          <div class="value">${(trip.kmInitial || 0).toLocaleString('it-IT')}</div>
        </div>
        <div class="km-item">
          <label>Km Arrivo</label>
          <div class="value">${(trip.kmFinal || 0).toLocaleString('it-IT')}</div>
        </div>
        <div class="km-item traveled">
          <label>Km Percorsi</label>
          <div class="value">${(trip.kmTraveled || 0).toLocaleString('it-IT')}</div>
        </div>
      </div>
      
      ${trip.durationMinutes ? `
      <div style="margin-top: 20px; text-align: center; padding: 16px; background: #FEF3C7; border-radius: 12px;">
        <div style="font-size: 12px; color: #92400E; text-transform: uppercase;">Durata Viaggio</div>
        <div style="font-size: 24px; font-weight: 700; color: #D97706;">${Math.floor(trip.durationMinutes / 60)}h ${trip.durationMinutes % 60}min</div>
      </div>
      ` : ''}
      
      ${trip.notes ? `
      <div style="margin-top: 20px;">
        <div class="section-title">Note</div>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; color: #666; font-style: italic;">${trip.notes}</div>
      </div>
      ` : ''}
      
      <div class="footer-section">
        ${tripOrgName} - Servizio Ambulanze e Trasporto Sanitario<br>
        Documento generato il ${formatDateIT(new Date())} alle ${formatTimeIT(new Date())}
      </div>
    </div>
  </div>
  
  <button class="print-btn no-print" onclick="window.print()">Stampa / Salva PDF</button>
</body>
</html>
      `;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error("Error generating trip PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del report" });
    }
  });

  // Documents endpoint - serve legal documents
  app.get("/api/documents/:filename", requireAdmin, async (req, res) => {
    try {
      const { filename } = req.params;
      const download = req.query.download === 'true';
      
      // Validate filename to prevent directory traversal
      const allowedFiles = [
        'privacy-policy.md',
        'termini-condizioni.md',
        'regolamento-rimborsi.md',
        'manuale-utente.md'
      ];
      
      if (!allowedFiles.includes(filename)) {
        return res.status(404).json({ error: "Documento non trovato" });
      }
      
      const filePath = path.join(process.cwd(), 'docs', 'legal', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Documento non trovato" });
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      } else {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      
      res.send(content);
    } catch (error) {
      console.error("Error serving document:", error);
      res.status(500).json({ error: "Errore nel caricamento del documento" });
    }
  });

  // ============================================
  // TRIP INTEGRITY & INDIVIDUAL PDF
  // ============================================

  app.get("/api/trips/:id/verify-integrity", async (req, res) => {
    try {
      const result = await verifyTripIntegrity(req.params.id);
      const trip = await storage.getTrip(req.params.id);
      
      // Return JSON if requested via Accept header or format query param
      if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
        return res.json(result);
      }
      
      // Generate beautiful HTML page
      const statusColor = result.status === "VALID" ? "#059669" : result.status === "BROKEN" ? "#DC2626" : "#6B7280";
      const statusIcon = result.status === "VALID" ? "&#10004;" : result.status === "BROKEN" ? "&#10006;" : "&#8211;";
      const statusText = result.status === "VALID" ? "INTEGRITÀ VERIFICATA" : result.status === "BROKEN" ? "INTEGRITÀ COMPROMESSA" : "NON FIRMATO";
      const statusDesc = result.status === "VALID" 
        ? "Questo documento è stato firmato digitalmente e non ha subito modifiche dalla data di firma."
        : result.status === "BROKEN"
        ? "Attenzione: questo documento risulta alterato dopo la firma digitale."
        : "Questo documento non è stato ancora firmato digitalmente.";
      
      const signedDate = result.signedAt ? new Date(result.signedAt).toLocaleString("it-IT", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
      }) : "N/A";
      
      const serviceDate = trip?.serviceDate ? new Date(trip.serviceDate).toLocaleDateString("it-IT", {
        day: "2-digit", month: "long", year: "numeric"
      }) : "N/A";
      
      // Get PDF hash if available
      const pdfHash = (trip as any)?.pdfHash || null;
      const pdfHashDate = (trip as any)?.pdfHashGeneratedAt 
        ? new Date((trip as any).pdfHashGeneratedAt).toLocaleString("it-IT", {
            day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
          })
        : null;

      const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica Integrità - Soccorso Digitale</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
      width: 100%;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
      margin-top: 20px;
    }
    .header {
      background: linear-gradient(135deg, #0066CC 0%, #0052a3 100%);
      padding: 24px;
      text-align: center;
      color: white;
    }
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .logo-text {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 12px;
      opacity: 0.9;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .status-card {
      padding: 32px 24px;
      text-align: center;
      border-bottom: 1px solid #e5e7eb;
    }
    .status-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${statusColor}15;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 40px;
      color: ${statusColor};
    }
    .status-text {
      font-size: 18px;
      font-weight: 700;
      color: ${statusColor};
      margin-bottom: 8px;
      letter-spacing: 1px;
    }
    .status-desc {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }
    .details {
      padding: 24px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label {
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-value {
      font-size: 14px;
      color: #1f2937;
      font-weight: 600;
      text-align: right;
    }
    .footer {
      background: #f9fafb;
      padding: 16px 24px;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      color: #9ca3af;
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      background: ${statusColor}15;
      color: ${statusColor};
      margin-top: 4px;
    }
    .security-note {
      margin-top: 20px;
      padding: 16px;
      background: #f0fdf4;
      border-radius: 8px;
      border-left: 4px solid #059669;
    }
    .security-note-title {
      font-size: 12px;
      font-weight: 600;
      color: #065f46;
      margin-bottom: 4px;
    }
    .security-note-text {
      font-size: 12px;
      color: #047857;
      line-height: 1.5;
    }
    .pdf-section {
      margin-top: 24px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
    }
    .pdf-section-title {
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pdf-hash {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      background: #1e293b;
      color: #22c55e;
      padding: 12px;
      border-radius: 6px;
      word-break: break-all;
      margin-bottom: 12px;
    }
    .pdf-hash-label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .upload-area {
      border: 2px dashed #94a3b8;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
    }
    .upload-area:hover {
      border-color: #0066CC;
      background: #f0f9ff;
    }
    .upload-area.dragover {
      border-color: #0066CC;
      background: #dbeafe;
    }
    .upload-text {
      font-size: 13px;
      color: #64748b;
    }
    .upload-btn {
      display: inline-block;
      margin-top: 8px;
      padding: 8px 16px;
      background: #0066CC;
      color: white;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .result-box {
      margin-top: 16px;
      padding: 16px;
      border-radius: 8px;
      display: none;
    }
    .result-box.match {
      background: #dcfce7;
      border: 1px solid #22c55e;
    }
    .result-box.mismatch {
      background: #fee2e2;
      border: 1px solid #ef4444;
    }
    .result-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .result-box.match .result-title { color: #15803d; }
    .result-box.mismatch .result-title { color: #dc2626; }
    .result-text {
      font-size: 12px;
      line-height: 1.5;
    }
    .result-box.match .result-text { color: #166534; }
    .result-box.mismatch .result-text { color: #991b1b; }
    .computed-hash {
      font-family: 'Courier New', monospace;
      font-size: 9px;
      background: #374151;
      color: #fbbf24;
      padding: 8px;
      border-radius: 4px;
      word-break: break-all;
      margin-top: 8px;
    }
    .loading {
      display: none;
      text-align: center;
      padding: 16px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #e5e7eb;
      border-top-color: #0066CC;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 8px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container">
        <div class="logo-text">SOCCORSO DIGITALE</div>
      </div>
      <div class="subtitle">Sistema di Verifica Integrità Documenti</div>
    </div>
    
    <div class="status-card">
      <div class="status-icon">${statusIcon}</div>
      <div class="status-text">${statusText}</div>
      <div class="status-desc">${statusDesc}</div>
      ${result.status === "VALID" ? '<div class="badge">Documento Autentico</div>' : ''}
    </div>
    
    <div class="details">
      <div class="detail-row">
        <span class="detail-label">ID Servizio</span>
        <span class="detail-value">#${trip?.progressiveNumber || req.params.id.substring(0, 8)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Data Servizio</span>
        <span class="detail-value">${serviceDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Data Firma</span>
        <span class="detail-value">${signedDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Algoritmo</span>
        <span class="detail-value">${result.algorithm || "N/A"}</span>
      </div>
      
      ${result.status === "VALID" ? `
      <div class="security-note">
        <div class="security-note-title">Sicurezza Garantita</div>
        <div class="security-note-text">
          Questo documento è protetto da firma crittografica HMAC-SHA256. 
          Qualsiasi modifica al contenuto invaliderebbe automaticamente la firma.
        </div>
      </div>
      ` : ''}
      
      ${pdfHash ? `
      <div class="pdf-section">
        <div class="pdf-section-title">
          <span>Verifica File PDF</span>
        </div>
        <div class="pdf-hash-label">Impronta digitale (SHA-256) del PDF originale:</div>
        <div class="pdf-hash">${pdfHash}</div>
        ${pdfHashDate ? `<div class="pdf-hash-label">Generato il: ${pdfHashDate}</div>` : ''}
        
        <div style="margin-top: 16px;">
          <div class="pdf-hash-label">Verifica se il tuo PDF è autentico:</div>
          <div class="upload-area" id="uploadArea">
            <input type="file" id="fileInput" accept=".pdf" style="display:none;">
            <div class="upload-text">Trascina qui il file PDF o</div>
            <div class="upload-btn" onclick="document.getElementById('fileInput').click()">Seleziona File</div>
          </div>
        </div>
        
        <div class="loading" id="loading">
          <div class="spinner"></div>
          <div style="font-size: 12px; color: #64748b;">Calcolo impronta digitale...</div>
        </div>
        
        <div class="result-box" id="resultBox">
          <div class="result-title" id="resultTitle"></div>
          <div class="result-text" id="resultText"></div>
          <div class="computed-hash" id="computedHash"></div>
        </div>
      </div>
      ` : `
      <div class="pdf-section">
        <div class="pdf-section-title">Verifica File PDF</div>
        <div class="pdf-hash-label" style="color: #94a3b8;">
          L'impronta digitale del PDF non è ancora disponibile. 
          Scarica prima il PDF dal sistema per generarla.
        </div>
      </div>
      `}
    </div>
    
    <div class="footer">
      <div class="footer-text">
        Soccorso Digitale - Piattaforma di Gestione Trasporti Sanitari<br>
        Sistema di gestione trasporti sanitari - Verona<br>
        Verifica effettuata il ${new Date().toLocaleString("it-IT")}
      </div>
    </div>
  </div>
  
  ${pdfHash ? `
  <script>
    const expectedHash = "${pdfHash}";
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const loading = document.getElementById('loading');
    const resultBox = document.getElementById('resultBox');
    const resultTitle = document.getElementById('resultTitle');
    const resultText = document.getElementById('resultText');
    const computedHash = document.getElementById('computedHash');
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        verifyFile(file);
      }
    });
    
    // File input
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        verifyFile(file);
      }
    });
    
    async function verifyFile(file) {
      uploadArea.style.display = 'none';
      loading.style.display = 'block';
      resultBox.style.display = 'none';
      
      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        loading.style.display = 'none';
        resultBox.style.display = 'block';
        
        if (hash === expectedHash) {
          resultBox.className = 'result-box match';
          resultTitle.textContent = 'PDF AUTENTICO';
          resultText.textContent = 'Il file PDF che hai caricato corrisponde esattamente all\\'originale. Non è stato modificato.';
        } else {
          resultBox.className = 'result-box mismatch';
          resultTitle.textContent = 'PDF MODIFICATO';
          resultText.textContent = 'ATTENZIONE: Il file PDF che hai caricato è stato modificato rispetto all\\'originale!';
        }
        
        computedHash.textContent = 'Hash del file caricato: ' + hash;
        
      } catch (err) {
        loading.style.display = 'none';
        uploadArea.style.display = 'block';
        alert('Errore durante la verifica del file');
      }
    }
  </script>
  ` : ''}
</body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      console.error("Error verifying trip integrity:", error);
      res.status(500).send(`<!DOCTYPE html><html><body><h1>Errore</h1><p>Errore nella verifica integrità del viaggio</p></body></html>`);
    }
  });

  // Get integrity statistics for compliance dashboard
  app.get("/api/integrity/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await getIntegrityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting integrity stats:", error);
      res.status(500).json({ error: "Errore nel recupero delle statistiche di integrità" });
    }
  });

  // ========================================
  // FINANCIAL CALCULATIONS ENDPOINTS
  // ========================================

  app.get("/api/trips/:id/financials", requireAuth, async (req, res) => {
    try {
      const { profileId } = req.query;
      const financials = await calculateTripFinancials(
        req.params.id,
        profileId as string | undefined
      );
      if (!financials) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      res.json(financials);
    } catch (error) {
      console.error("Error calculating trip financials:", error);
      res.status(500).json({ error: "Errore nel calcolo dei dati finanziari del viaggio" });
    }
  });

  // Generate PDF report for a single trip
  app.get("/api/trips/:id/pdf", async (req, res) => {
    try {
      const { profileId } = req.query;
      const trip = await storage.getTrip(req.params.id);
      
      if (!trip) {
        return res.status(404).json({ error: "Viaggio non trovato" });
      }
      
      // Get related data
      const vehicle = await storage.getVehicle(trip.vehicleId);
      const driver = await storage.getUser(trip.userId);
      
      // Get location from vehicle
      let location = null;
      if (vehicle?.locationId) {
        location = await storage.getLocation(vehicle.locationId);
      }
      
      // Get structures for origin and destination
      let originStructure = null;
      let destinationStructure = null;
      let originDepartment = null;
      let destinationDepartment = null;
      
      if (trip.originStructureId) {
        originStructure = await storage.getStructureById(trip.originStructureId);
      }
      if (trip.destinationStructureId) {
        destinationStructure = await storage.getStructureById(trip.destinationStructureId);
      }
      if (trip.originDepartmentId) {
        originDepartment = await storage.getDepartmentById(trip.originDepartmentId);
      }
      if (trip.destinationDepartmentId) {
        destinationDepartment = await storage.getDepartmentById(trip.destinationDepartmentId);
      }
      
      // Calculate financials
      const financials = await calculateTripFinancials(
        req.params.id,
        profileId as string | undefined
      );
      
      // Build integrity data for PDF
      const baseUrl = process.env.EXPO_PUBLIC_DOMAIN 
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : 'http://localhost:5000';
      
      const integrityData = {
        status: (trip.integrityStatus ?? "NOT_SIGNED") as "VALID" | "BROKEN" | "NOT_SIGNED",
        signedAt: trip.integritySignedAt instanceof Date 
          ? trip.integritySignedAt.toISOString() 
          : (trip.integritySignedAt || null),
        algorithm: trip.integrityAlgorithm ?? null,
        verificationUrl: trip.integrityStatus === "VALID" 
          ? `${baseUrl}/api/trips/${trip.id}/verify-integrity`
          : undefined,
      };
      
      // Fetch organization data for logo/name in PDF
      let organizationName: string | null = null;
      let organizationLogoPath: string | null = null;
      if (trip.organizationId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, trip.organizationId)).limit(1);
        if (org) {
          organizationName = org.name;
          const logoFile = path.join(process.cwd(), "uploads", "logos", `${org.id}.png`);
          if (fs.existsSync(logoFile)) {
            organizationLogoPath = logoFile;
          }
        }
      }

      // Generate PDF
      const doc = await generateTripPDF({
        trip,
        vehicle,
        driver,
        location,
        financials,
        originStructure,
        destinationStructure,
        originDepartment,
        destinationDepartment,
        integrity: integrityData,
        organizationName,
        organizationLogoPath,
      });
      
      // Collect PDF into buffer to calculate hash
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          
          // Calculate SHA-256 hash of the PDF
          const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
          
          // Save the hash to database
          await storage.updateTrip(req.params.id, {
            pdfHash: pdfHash,
            pdfHashGeneratedAt: new Date(),
          } as any);
          
          // Set response headers for PDF download
          const pdfLabel = (trip.isReturnTrip && !trip.progressiveNumber) ? 'senza_paziente' : (trip.progressiveNumber || trip.id.substring(0, 8));
          const filename = `servizio_${pdfLabel}_${trip.serviceDate || 'report'}.pdf`;
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          res.setHeader("X-PDF-Hash", pdfHash);
          
          // Send the PDF buffer
          res.send(pdfBuffer);
        } catch (hashError) {
          console.error("Error saving PDF hash:", hashError);
          // Still send the PDF even if hash saving fails
          const pdfBuffer = Buffer.concat(chunks);
          const pdfLabel = (trip.isReturnTrip && !trip.progressiveNumber) ? 'senza_paziente' : (trip.progressiveNumber || trip.id.substring(0, 8));
          const filename = `servizio_${pdfLabel}_${trip.serviceDate || 'report'}.pdf`;
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          res.send(pdfBuffer);
        }
      });
      
      // Handle PDF generation errors
      doc.on('error', (err) => {
        console.error("PDF generation stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Errore nella generazione del PDF" });
        } else {
          res.end();
        }
      });
      
      // End the PDF document (triggers the 'end' event)
      doc.end();
    } catch (error) {
      console.error("Error generating trip PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF" });
    }
  });

  // ============================================
  // SOCCORSO LIVE
  // ============================================

  app.post("/api/soccorso-live/pdf", requireAuth, async (req, res) => {
    try {
      const { mode, vehicle, location, date, phases, patient, startTime, endTime, totalKm } = req.body;
      
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        info: {
          Title: `Scheda Servizio - ${date}`,
          Author: 'SOCCORSO DIGITALE',
          Subject: 'Scheda Intervento Sanitario',
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="servizio-${date.replace(/\//g, '-')}.pdf"`);
      doc.pipe(res);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      const colors = {
        primary: mode === 'Emergenza 118' ? '#DC3545' : '#0066CC',
        secondary: '#00A651',
        dark: '#1F2937',
        gray: '#6B7280',
        lightGray: '#F3F4F6',
        white: '#FFFFFF',
        codiceVerde: '#4CAF50',
        codiceGiallo: '#FFC107',
        codiceRosso: '#F44336',
      };

      // Header with gradient effect
      doc.rect(0, 0, pageWidth, 120).fill(colors.primary);
      
      // Logo area
      doc.circle(margin + 35, 60, 30).fill(colors.white);
      doc.font('Helvetica-Bold')
         .fontSize(24)
         .fillColor(colors.primary)
         .text('S', margin + 23, 48);
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.primary)
         .text('LIVE', margin + 18, 70);
      
      // Title
      doc.font('Helvetica-Bold')
         .fontSize(22)
         .fillColor(colors.white)
         .text('SCHEDA INTERVENTO', margin + 85, 35);
      doc.font('Helvetica')
         .fontSize(14)
         .fillColor(colors.white)
         .text(mode || 'Servizio Sanitario', margin + 85, 62);
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor('rgba(255,255,255,0.85)')
         .text(`${vehicle} - ${location}`, margin + 85, 82);

      // Date/Time badge
      doc.roundedRect(pageWidth - margin - 120, 35, 110, 50, 8).fill(colors.white);
      doc.font('Helvetica-Bold')
         .fontSize(16)
         .fillColor(colors.primary)
         .text(date || '', pageWidth - margin - 115, 42, { width: 100, align: 'center' });
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor(colors.gray)
         .text(`${startTime} - ${endTime}`, pageWidth - margin - 115, 62, { width: 100, align: 'center' });

      let yPos = 140;

      // Patient Data Section (if exists)
      if (patient) {
        doc.roundedRect(margin, yPos, contentWidth, 90, 10).fill(colors.lightGray);
        
        const codiceColor = patient.codice === 'ROSSO' ? colors.codiceRosso : 
                           patient.codice === 'GIALLO' ? colors.codiceGiallo : colors.codiceVerde;
        
        doc.roundedRect(margin + 15, yPos + 15, 80, 60, 8).fill(codiceColor);
        doc.font('Helvetica-Bold')
           .fontSize(20)
           .fillColor(colors.white)
           .text(patient.codice || 'N/D', margin + 15, yPos + 32, { width: 80, align: 'center' });
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor(colors.white)
           .text('CODICE', margin + 15, yPos + 55, { width: 80, align: 'center' });

        // Patient info
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor(colors.dark)
           .text('DATI PAZIENTE', margin + 110, yPos + 15);
        
        doc.font('Helvetica')
           .fontSize(11)
           .fillColor(colors.gray)
           .text(`Patologia: ${patient.patologia || 'Non specificata'}`, margin + 110, yPos + 35);
        doc.text(`Età: ${patient.eta || 'N/D'} anni  |  Sesso: ${patient.sesso || 'N/D'}`, margin + 110, yPos + 52);
        if (patient.note) {
          doc.text(`Note: ${patient.note}`, margin + 110, yPos + 69, { width: contentWidth - 130 });
        }
        
        yPos += 105;
      }

      // Timeline Section
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor(colors.dark)
         .text('CRONOLOGIA INTERVENTO', margin, yPos);
      yPos += 25;

      // Timeline items
      if (phases && phases.length > 0) {
        phases.forEach((phase: any, index: number) => {
          const isLast = index === phases.length - 1;
          
          // Timeline dot
          doc.circle(margin + 12, yPos + 12, 8).fill(isLast ? colors.secondary : colors.primary);
          doc.font('Helvetica-Bold')
             .fontSize(10)
             .fillColor(colors.white)
             .text(`${index + 1}`, margin + 8, yPos + 8);
          
          // Timeline line
          if (!isLast) {
            doc.moveTo(margin + 12, yPos + 22)
               .lineTo(margin + 12, yPos + 55)
               .strokeColor(colors.lightGray)
               .lineWidth(2)
               .stroke();
          }
          
          const phaseHeight = phase.hospital ? 60 : 45;
          
          doc.roundedRect(margin + 35, yPos, contentWidth - 45, phaseHeight, 6)
             .fillAndStroke(colors.white, colors.lightGray);
          
          doc.font('Helvetica-Bold')
             .fontSize(11)
             .fillColor(colors.dark)
             .text(phase.label || '', margin + 45, yPos + 8);
          
          doc.font('Helvetica')
             .fontSize(10)
             .fillColor(colors.primary)
             .text(phase.time || '', margin + 45, yPos + 24);
          
          doc.font('Helvetica')
             .fontSize(9)
             .fillColor(colors.gray)
             .text(phase.address || '', margin + 100, yPos + 24, { width: contentWidth - 160 });
          
          if (phase.hospital) {
            doc.font('Helvetica-Bold')
               .fontSize(9)
               .fillColor('#FF5252')
               .text(`Struttura: ${phase.hospital}`, margin + 45, yPos + 40, { width: contentWidth - 60 });
          }
          
          yPos += phaseHeight + 10;
        });
      }

      // Summary Section
      yPos += 15;
      doc.roundedRect(margin, yPos, contentWidth, 60, 10).fill(colors.secondary);
      
      const summaryBoxWidth = contentWidth / (totalKm ? 4 : 3);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('rgba(255,255,255,0.85)')
         .text('FASI', margin, yPos + 12, { width: summaryBoxWidth, align: 'center' });
      doc.font('Helvetica-Bold')
         .fontSize(22)
         .fillColor(colors.white)
         .text(phases?.length?.toString() || '0', margin, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('rgba(255,255,255,0.85)')
         .text('INIZIO', margin + summaryBoxWidth, yPos + 12, { width: summaryBoxWidth, align: 'center' });
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.white)
         .text(startTime || '--:--', margin + summaryBoxWidth, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('rgba(255,255,255,0.85)')
         .text('FINE', margin + summaryBoxWidth * 2, yPos + 12, { width: summaryBoxWidth, align: 'center' });
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.white)
         .text(endTime || '--:--', margin + summaryBoxWidth * 2, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      
      if (totalKm) {
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('rgba(255,255,255,0.85)')
           .text('KM', margin + summaryBoxWidth * 3, yPos + 12, { width: summaryBoxWidth, align: 'center' });
        doc.font('Helvetica-Bold')
           .fontSize(22)
           .fillColor(colors.white)
           .text(parseFloat(totalKm).toFixed(1), margin + summaryBoxWidth * 3, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      }

      // Footer
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(colors.gray)
         .text('Generato da SOCCORSO LIVE - SOCCORSO DIGITALE', margin, pageHeight - 40, { align: 'center', width: contentWidth });
      doc.text(`Documento generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`, margin, pageHeight - 28, { align: 'center', width: contentWidth });
      
      doc.end();
      
    } catch (error) {
      console.error("Error generating Soccorso Live PDF:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  app.post("/api/soccorso-live/report", requireAuth, async (req, res) => {
    try {
      const token = crypto.randomUUID();
      const { serviceData, routeData, totalKm } = req.body;
      
      await db.insert(soccorsoLiveReports).values({
        token,
        vehicleCode: serviceData.vehicle || null,
        locationName: serviceData.location || null,
        mode: serviceData.mode || null,
        serviceData: serviceData,
        routeData: routeData || null,
        totalKm: totalKm || null,
      });
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'http://localhost:5000');
      
      res.json({ 
        success: true, 
        token, 
        url: `${baseUrl}/api/public/soccorso-live/report/${token}` 
      });
    } catch (error) {
      console.error("Error saving report:", error);
      res.status(500).json({ error: "Errore salvataggio report" });
    }
  });

  app.get("/api/public/soccorso-live/report/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const [report] = await db.select().from(soccorsoLiveReports).where(eq(soccorsoLiveReports.token, token));
      
      if (!report) {
        return res.status(404).send(`
          <html><body style="background:#0A0E17;color:#E2E8F0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
            <div style="text-align:center"><h1 style="color:#FF1744">Report non trovato</h1><p style="color:#64748B">Il link potrebbe essere scaduto o non valido.</p></div>
          </body></html>
        `);
      }
      
      const data = report.serviceData as any;
      const route = report.routeData as any;
      
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        info: {
          Title: `Scheda Servizio - ${data.date || ''}`,
          Author: 'SOCCORSO DIGITALE',
          Subject: 'Scheda Intervento Sanitario',
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="servizio-${(data.date || '').replace(/\//g, '-')}.pdf"`);
      doc.pipe(res);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      const colors = {
        primary: data.mode === 'Emergenza 118' ? '#DC3545' : '#0066CC',
        secondary: '#00A651',
        dark: '#1A1A2E',
        gray: '#6C757D',
        lightGray: '#F0F4F8',
        white: '#FFFFFF',
        codiceRosso: '#DC3545',
        codiceGiallo: '#FFC107',
        codiceVerde: '#28A745',
      };

      doc.roundedRect(margin, margin, contentWidth, 80, 12).fill(colors.primary);
      
      doc.font('Helvetica-Bold')
         .fontSize(20)
         .fillColor(colors.white)
         .text(data.mode || 'SERVIZIO', margin + 20, margin + 15);
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor('rgba(255,255,255,0.85)')
         .text(`${data.vehicle || '---'} - ${data.location || '---'}`, margin + 20, margin + 40);
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor('rgba(255,255,255,0.85)')
         .text(`${data.date || ''}`, margin + 20, margin + 55);
      
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor(colors.white)
         .text(`${data.startTime || ''} - ${data.endTime || ''}`, pageWidth - margin - 135, margin + 18, { width: 120, align: 'center' });
      
      if (report.totalKm) {
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fillColor(colors.white)
           .text(`${report.totalKm.toFixed(1)} km`, pageWidth - margin - 135, margin + 45, { width: 120, align: 'center' });
      }

      let yPos = 140;

      if (data.patient) {
        doc.roundedRect(margin, yPos, contentWidth, 90, 10).fill(colors.lightGray);
        
        const codiceColor = data.patient.codice === 'ROSSO' ? colors.codiceRosso : 
                           data.patient.codice === 'GIALLO' ? colors.codiceGiallo : colors.codiceVerde;
        
        doc.roundedRect(margin + 15, yPos + 15, 80, 60, 8).fill(codiceColor);
        doc.font('Helvetica-Bold')
           .fontSize(20)
           .fillColor(colors.white)
           .text(data.patient.codice || 'N/D', margin + 15, yPos + 32, { width: 80, align: 'center' });
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor(colors.white)
           .text('CODICE', margin + 15, yPos + 55, { width: 80, align: 'center' });

        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor(colors.dark)
           .text('DATI PAZIENTE', margin + 110, yPos + 15);
        
        doc.font('Helvetica')
           .fontSize(11)
           .fillColor(colors.gray)
           .text(`Patologia: ${data.patient.patologia || 'Non specificata'}`, margin + 110, yPos + 35);
        doc.text(`Età: ${data.patient.eta || 'N/D'} anni  |  Sesso: ${data.patient.sesso || 'N/D'}`, margin + 110, yPos + 52);
        if (data.patient.note) {
          doc.text(`Note: ${data.patient.note}`, margin + 110, yPos + 69, { width: contentWidth - 130 });
        }
        if (data.patient.template) {
          doc.font('Helvetica-Bold')
             .fontSize(9)
             .fillColor(colors.primary)
             .text(`Scenario: ${data.patient.template}`, margin + 110, yPos + 69 + (data.patient.note ? 15 : 0));
        }
        
        yPos += 105;
      }

      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor(colors.dark)
         .text('CRONOLOGIA INTERVENTO', margin, yPos);
      yPos += 25;

      if (data.phases && data.phases.length > 0) {
        data.phases.forEach((phase: any, index: number) => {
          const isLast = index === data.phases.length - 1;
          
          doc.circle(margin + 12, yPos + 12, 8).fill(isLast ? colors.secondary : colors.primary);
          doc.font('Helvetica-Bold')
             .fontSize(10)
             .fillColor(colors.white)
             .text(`${index + 1}`, margin + 8, yPos + 8);
          
          if (!isLast) {
            doc.moveTo(margin + 12, yPos + 22)
               .lineTo(margin + 12, yPos + 55)
               .strokeColor(colors.lightGray)
               .lineWidth(2)
               .stroke();
          }
          
          const phaseHeight = phase.hospital ? 60 : 45;
          
          doc.roundedRect(margin + 35, yPos, contentWidth - 45, phaseHeight, 6)
             .fillAndStroke(colors.white, colors.lightGray);
          
          doc.font('Helvetica-Bold')
             .fontSize(11)
             .fillColor(colors.dark)
             .text(phase.label || '', margin + 45, yPos + 8);
          
          doc.font('Helvetica')
             .fontSize(10)
             .fillColor(colors.primary)
             .text(phase.time || '', margin + 45, yPos + 24);
          
          doc.font('Helvetica')
             .fontSize(9)
             .fillColor(colors.gray)
             .text(phase.address || '', margin + 100, yPos + 24, { width: contentWidth - 160 });
          
          if (phase.hospital) {
            doc.font('Helvetica-Bold')
               .fontSize(9)
               .fillColor('#FF5252')
               .text(`Struttura: ${phase.hospital}`, margin + 45, yPos + 40, { width: contentWidth - 60 });
          }
          
          yPos += phaseHeight + 10;
        });
      }

      yPos += 15;
      doc.roundedRect(margin, yPos, contentWidth, 60, 10).fill(colors.secondary);
      
      const summaryBoxWidth = contentWidth / (report.totalKm ? 4 : 3);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('rgba(255,255,255,0.85)')
         .text('FASI COMPLETATE', margin, yPos + 12, { width: summaryBoxWidth, align: 'center' });
      doc.font('Helvetica-Bold')
         .fontSize(20)
         .fillColor(colors.white)
         .text(data.phases?.length?.toString() || '0', margin, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('rgba(255,255,255,0.85)')
         .text('INIZIO', margin + summaryBoxWidth, yPos + 12, { width: summaryBoxWidth, align: 'center' });
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.white)
         .text(data.startTime || '--:--', margin + summaryBoxWidth, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('rgba(255,255,255,0.85)')
         .text('FINE', margin + summaryBoxWidth * 2, yPos + 12, { width: summaryBoxWidth, align: 'center' });
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.white)
         .text(data.endTime || '--:--', margin + summaryBoxWidth * 2, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      
      if (report.totalKm) {
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('rgba(255,255,255,0.85)')
           .text('KM PERCORSI', margin + summaryBoxWidth * 3, yPos + 12, { width: summaryBoxWidth, align: 'center' });
        doc.font('Helvetica-Bold')
           .fontSize(20)
           .fillColor(colors.white)
           .text(report.totalKm.toFixed(1), margin + summaryBoxWidth * 3, yPos + 28, { width: summaryBoxWidth, align: 'center' });
      }

      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(colors.gray)
         .text('Generato da SOCCORSO LIVE - SOCCORSO DIGITALE', margin, pageHeight - 40, { align: 'center', width: contentWidth });
      doc.text(`Report ID: ${token}`, margin, pageHeight - 28, { align: 'center', width: contentWidth });
      
      doc.end();
      
    } catch (error) {
      console.error("Error generating public report PDF:", error);
      res.status(500).send('<html><body style="background:#0A0E17;color:#E2E8F0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#FF1744">Errore</h1><p style="color:#64748B">Impossibile generare il report.</p></div></body></html>');
    }
  });

  // ============================================
  // SLA VIOLATION AUTO-DETECTION
  // ============================================

  app.post("/api/trips/:id/check-sla", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const [trip] = await (db.select().from(trips).where(and(eq(trips.id, req.params.id), eq(trips.organizationId, orgId || ''))) as any);
      if (!trip) return res.status(404).json({ error: "Servizio non trovato" });

      let violation = false;
      let violationType: string | null = null;
      let violationMinutes: number | null = null;

      if (trip.scheduledDepartureTime && trip.departureTime) {
        const scheduled = trip.scheduledDepartureTime.split(":").map(Number);
        const actual = trip.departureTime.split(":").map(Number);
        const delayMin = (actual[0] * 60 + actual[1]) - (scheduled[0] * 60 + scheduled[1]);
        
        if (delayMin > 60) {
          violation = true;
          violationType = "delay_60min";
          violationMinutes = delayMin;
        } else if (delayMin > 30) {
          violation = true;
          violationType = "late_30min";
          violationMinutes = delayMin;
        }
      }

      if (violation) {
        await db.update(trips).set({
          slaViolation: true,
          slaViolationType: violationType,
          slaViolationMinutes: violationMinutes
        }).where(eq(trips.id, trip.id));
      }

      res.json({ violation, type: violationType, minutes: violationMinutes });
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });
}
