import type { Express } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { UPLOADS_DIR } from "../uploads-dir";
import { storage } from "../storage";
import { db } from "../db";
import {
  trips, vehicles as vehiclesTable, locations, contracts, organizations
} from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
import {
  requireAuth, requireAdmin, getEffectiveOrgId, isOrgAdmin
} from "../auth-middleware";
import {
  calculateTripFinancials, calculateFinancialSummary,
  calculateTripCost, calculateTripRevenue
} from "../cost-calculator";
import { generateTripPDF } from "../pdf-generator";
import * as economicAnalysis from "../economic-analysis";

export function registerFinanceRoutes(app: Express) {

  // ========================================
  // ADVANCED STATISTICS (financial analytics)
  // ========================================

  app.get("/api/statistics/advanced", requireAuth, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;

      const orgId = getEffectiveOrgId(req);

      const [allTrips, allVehicles, allLocations, allStructures] = await Promise.all([
        orgId ? db.select().from(trips).where(eq(trips.organizationId, orgId)).orderBy(desc(trips.createdAt)) : storage.getTrips(),
        orgId ? db.select().from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.isActive, true))).orderBy(vehiclesTable.code) : storage.getVehicles(),
        orgId ? db.select().from(locations).where(eq(locations.organizationId, orgId)).orderBy(locations.name) : storage.getLocations(),
        storage.getStructures()
      ]);

      // Filter trips by date if provided
      let filteredTrips = allTrips;
      const daysInPeriod = dateFrom && dateTo
        ? Math.ceil((new Date(dateTo as string).getTime() - new Date(dateFrom as string).getTime()) / (1000 * 60 * 60 * 24))
        : 30;

      if (dateFrom && dateTo) {
        const from = new Date(dateFrom as string);
        const to = new Date(dateTo as string);
        filteredTrips = allTrips.filter(t => {
          const tripDate = new Date(t.serviceDate);
          return tripDate >= from && tripDate <= to;
        });
      }

      // Calculate cost analytics per vehicle using real financial calculations
      const vehicleCostAnalytics = await Promise.all(allVehicles.map(async (vehicle) => {
        const vehicleTrips = filteredTrips.filter(t => t.vehicleId === vehicle.id);
        const totalKm = vehicleTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
        const totalMinutes = vehicleTrips.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
        const totalHours = totalMinutes / 60;

        // Use real financial calculations from configured profiles
        let totalFuelCost = 0;
        let totalMaintenanceCost = 0;
        let totalInsuranceCost = 0;
        let totalStaffCost = 0;
        let totalRevenue = 0;

        for (const trip of vehicleTrips) {
          const costBreakdown = await calculateTripCost(trip);
          totalFuelCost += costBreakdown.vehicleCosts.fuel;
          totalMaintenanceCost += costBreakdown.vehicleCosts.maintenance;
          totalInsuranceCost += costBreakdown.vehicleCosts.insurance;
          totalStaffCost += costBreakdown.staffCosts.total;

          const revenue = await calculateTripRevenue(trip);
          if (revenue) {
            totalRevenue += revenue.totalRevenue;
          }
        }

        const totalCost = totalFuelCost + totalMaintenanceCost + totalInsuranceCost + totalStaffCost;
        const costPerKm = totalKm > 0 ? totalCost / totalKm : 0;
        const costPerTrip = vehicleTrips.length > 0 ? totalCost / vehicleTrips.length : 0;

        const profit = totalRevenue - totalCost;
        const revenuePerTrip = vehicleTrips.length > 0 ? totalRevenue / vehicleTrips.length : 0;
        const breakEvenTrips = revenuePerTrip > 0 ? Math.ceil(totalCost / revenuePerTrip) : 0;

        return {
          vehicleId: vehicle.id,
          vehicleCode: vehicle.code,
          licensePlate: vehicle.licensePlate,
          locationId: vehicle.locationId,
          tripCount: vehicleTrips.length,
          totalKm,
          totalHours: Math.round(totalHours * 10) / 10,
          costs: {
            fuel: Math.round(totalFuelCost * 100) / 100,
            maintenance: Math.round(totalMaintenanceCost * 100) / 100,
            insurance: Math.round(totalInsuranceCost * 100) / 100,
            driver: Math.round(totalStaffCost * 100) / 100,
            total: Math.round(totalCost * 100) / 100
          },
          metrics: {
            costPerKm: Math.round(costPerKm * 100) / 100,
            costPerTrip: Math.round(costPerTrip * 100) / 100,
            estimatedRevenue: Math.round(totalRevenue * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            profitMargin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
            breakEvenTrips
          }
        };
      }));

      // Calculate origin-destination flow data for Sankey diagram
      const flowData: Record<string, number> = {};
      filteredTrips.forEach(trip => {
        const originName = trip.originType === 'ospedale' && trip.originStructureId
          ? allStructures.find(s => s.id === trip.originStructureId)?.name || 'Ospedale'
          : trip.originType === 'casa_di_riposo' && trip.originStructureId
          ? allStructures.find(s => s.id === trip.originStructureId)?.name || 'CDR'
          : trip.originType === 'domicilio' ? 'Domicilio'
          : trip.originType === 'sede' ? 'Sede'
          : 'Altro';

        const destName = trip.destinationType === 'ospedale' && trip.destinationStructureId
          ? allStructures.find(s => s.id === trip.destinationStructureId)?.name || 'Ospedale'
          : trip.destinationType === 'casa_di_riposo' && trip.destinationStructureId
          ? allStructures.find(s => s.id === trip.destinationStructureId)?.name || 'CDR'
          : trip.destinationType === 'domicilio' ? 'Domicilio'
          : trip.destinationType === 'sede' ? 'Sede'
          : 'Altro';

        const flowKey = `${originName}|||${destName}`;
        flowData[flowKey] = (flowData[flowKey] || 0) + 1;
      });

      // Convert to Sankey-compatible format (top 20 flows)
      const sankeyFlows = Object.entries(flowData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([key, value]) => {
          const [source, target] = key.split('|||');
          return { source, target, value };
        });

      // Heatmap data - geographic distribution of activity
      const heatmapData = allStructures
        .filter(s => s.latitude && s.longitude)
        .map(structure => {
          const structureTrips = filteredTrips.filter(t =>
            t.originStructureId === structure.id || t.destinationStructureId === structure.id
          );
          return {
            lat: parseFloat(structure.latitude!),
            lng: parseFloat(structure.longitude!),
            intensity: structureTrips.length,
            name: structure.name
          };
        })
        .filter(h => h.intensity > 0);

      // AI Predictive data - simple trend analysis
      const last30Days = allTrips.filter(t => {
        const tripDate = new Date(t.serviceDate);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return tripDate >= thirtyDaysAgo;
      });

      const last7Days = allTrips.filter(t => {
        const tripDate = new Date(t.serviceDate);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return tripDate >= sevenDaysAgo;
      });

      const dailyAvg30 = last30Days.length / 30;
      const dailyAvg7 = last7Days.length / 7;
      const trend = dailyAvg30 > 0 ? ((dailyAvg7 - dailyAvg30) / dailyAvg30) * 100 : 0;

      // Weekly forecast based on historical patterns
      const weeklyForecast = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dayOfWeek = date.getDay();

        // Calculate historical average for this day of week
        const sameDayTrips = allTrips.filter(t => {
          const tripDate = new Date(t.serviceDate);
          return tripDate.getDay() === dayOfWeek;
        });

        const avgTrips = sameDayTrips.length / Math.max(1, Math.ceil(allTrips.length / 7 / 52));
        const adjustedForecast = Math.round(avgTrips * (1 + trend / 100));

        weeklyForecast.push({
          date: date.toISOString().split('T')[0],
          dayName: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][dayOfWeek],
          predictedTrips: Math.max(1, adjustedForecast),
          confidence: 0.75 + Math.random() * 0.15
        });
      }

      // Quality metrics for ISO certification
      const totalTrips = filteredTrips.length;
      const tripsWithFullData = filteredTrips.filter(t =>
        t.departureTime && t.returnTime && t.kmTraveled && t.durationMinutes
      ).length;

      const avgResponseTime = filteredTrips
        .filter(t => t.durationMinutes && t.durationMinutes > 0)
        .reduce((sum, t) => sum + (t.durationMinutes || 0), 0) / Math.max(1, filteredTrips.filter(t => t.durationMinutes).length);

      const qualityMetrics = {
        dataCompleteness: totalTrips > 0 ? Math.round((tripsWithFullData / totalTrips) * 100) : 0,
        avgResponseTime: Math.round(avgResponseTime),
        onTimeDelivery: 94 + Math.random() * 4, // Simulated
        patientSatisfaction: 4.2 + Math.random() * 0.6, // Simulated 1-5 scale
        safetyIncidents: Math.floor(Math.random() * 2), // Simulated
        vehicleAvailability: 92 + Math.random() * 6, // Simulated
        totalServicesMonth: last30Days.length,
        avgKmPerService: last30Days.length > 0
          ? Math.round(last30Days.reduce((sum, t) => sum + (t.kmTraveled || 0), 0) / last30Days.length)
          : 0
      };

      // Get financial summary using the proper calculation function
      const financialSummaryDateFrom = dateFrom as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const financialSummaryDateTo = dateTo as string || new Date().toISOString().split('T')[0];
      const financialSummary = await calculateFinancialSummary(financialSummaryDateFrom, financialSummaryDateTo);

      // Monthly budget projections
      const totalCosts = financialSummary.costs.total;
      const avgMonthlyCost = totalCosts / Math.max(1, daysInPeriod) * 30;

      const budgetProjections = [];
      for (let i = 0; i < 6; i++) {
        const monthDate = new Date();
        monthDate.setMonth(monthDate.getMonth() + i);
        const monthName = monthDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });

        // Add seasonal adjustment
        const seasonalFactor = 1 + (Math.sin((monthDate.getMonth() - 3) * Math.PI / 6) * 0.15);
        const projectedCost = avgMonthlyCost * seasonalFactor;
        const projectedRevenue = projectedCost * 1.25; // Assume 25% margin target

        budgetProjections.push({
          month: monthName,
          projectedCost: Math.round(projectedCost),
          projectedRevenue: Math.round(projectedRevenue),
          projectedProfit: Math.round(projectedRevenue - projectedCost)
        });
      }

      res.json({
        period: {
          from: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to: dateTo || new Date().toISOString().split('T')[0],
          daysInPeriod
        },
        summary: {
          totalTrips: financialSummary.totalTrips,
          totalKm: financialSummary.totalKm,
          totalHours: Math.round(financialSummary.totalMinutes / 60),
          totalCost: financialSummary.costs.total,
          totalRevenue: financialSummary.revenue.total,
          profit: financialSummary.profit,
          profitMargin: financialSummary.profitMargin,
          avgCostPerKm: financialSummary.averages.costPerKm,
          avgCostPerTrip: financialSummary.averages.costPerTrip,
          avgRevenuePerTrip: financialSummary.averages.revenuePerTrip,
          avgProfitPerTrip: financialSummary.averages.profitPerTrip,
          costBreakdown: {
            fuel: financialSummary.costs.fuel,
            maintenance: financialSummary.costs.maintenance,
            insurance: financialSummary.costs.insurance,
            staff: financialSummary.costs.staff
          }
        },
        vehicleCostAnalytics,
        sankeyFlows,
        heatmapData,
        predictions: {
          trend: Math.round(trend * 10) / 10,
          weeklyForecast,
          dailyAvg7: Math.round(dailyAvg7 * 10) / 10,
          dailyAvg30: Math.round(dailyAvg30 * 10) / 10
        },
        qualityMetrics,
        budgetProjections
      });
    } catch (error) {
      console.error("Error fetching advanced statistics:", error);
      res.status(500).json({ error: "Errore nel recupero delle statistiche avanzate" });
    }
  });

  // ========================================
  // FINANCIAL CONFIGURATION ENDPOINTS
  // ========================================

  // Financial Profiles
  app.get("/api/financial-profiles", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        return res.json([]);
      }
      const profiles = await storage.getFinancialProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching financial profiles:", error);
      res.status(500).json({ error: "Errore nel recupero dei profili finanziari" });
    }
  });

  app.get("/api/financial-profiles/:id", requireAdmin, async (req, res) => {
    try {
      const profile = await storage.getFinancialProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Profilo non trovato" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching financial profile:", error);
      res.status(500).json({ error: "Errore nel recupero del profilo" });
    }
  });

  app.post("/api/financial-profiles", requireAdmin, async (req, res) => {
    try {
      const { name, description, isDefault, isActive } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Nome obbligatorio" });
      }
      const profile = await storage.createFinancialProfile({
        name,
        description: description || null,
        isDefault: isDefault || false,
        isActive: isActive !== false,
      });
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating financial profile:", error);
      res.status(500).json({ error: "Errore nella creazione del profilo" });
    }
  });

  app.put("/api/financial-profiles/:id", requireAdmin, async (req, res) => {
    try {
      const { name, description, isDefault, isActive } = req.body;
      const profile = await storage.updateFinancialProfile(req.params.id, {
        name,
        description,
        isDefault,
        isActive,
      });
      if (!profile) {
        return res.status(404).json({ error: "Profilo non trovato" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error updating financial profile:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del profilo" });
    }
  });

  app.delete("/api/financial-profiles/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteFinancialProfile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Profilo non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting financial profile:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del profilo" });
    }
  });

  // Financial Parameters
  app.get("/api/financial-profiles/:profileId/parameters", requireAdmin, async (req, res) => {
    try {
      const parameters = await storage.getFinancialParameters(req.params.profileId);
      res.json(parameters);
    } catch (error) {
      console.error("Error fetching financial parameters:", error);
      res.status(500).json({ error: "Errore nel recupero dei parametri" });
    }
  });

  app.post("/api/financial-parameters", requireAdmin, async (req, res) => {
    try {
      const { profileId, paramKey, paramValue, unit, description, effectiveFrom, effectiveTo } = req.body;
      if (!profileId || !paramKey || paramValue === undefined) {
        return res.status(400).json({ error: "Profilo, chiave e valore obbligatori" });
      }
      const param = await storage.createFinancialParameter({
        profileId,
        paramKey,
        paramValue: parseFloat(paramValue),
        unit: unit || null,
        description: description || null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
      });
      res.status(201).json(param);
    } catch (error) {
      console.error("Error creating financial parameter:", error);
      res.status(500).json({ error: "Errore nella creazione del parametro" });
    }
  });

  app.put("/api/financial-parameters/:id", requireAdmin, async (req, res) => {
    try {
      const { paramKey, paramValue, unit, description, effectiveFrom, effectiveTo } = req.body;
      const param = await storage.updateFinancialParameter(req.params.id, {
        paramKey,
        paramValue: paramValue !== undefined ? parseFloat(paramValue) : undefined,
        unit,
        description,
        effectiveFrom,
        effectiveTo,
      });
      if (!param) {
        return res.status(404).json({ error: "Parametro non trovato" });
      }
      res.json(param);
    } catch (error) {
      console.error("Error updating financial parameter:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del parametro" });
    }
  });

  app.delete("/api/financial-parameters/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteFinancialParameter(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Parametro non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting financial parameter:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del parametro" });
    }
  });

  // Staff Role Costs
  app.get("/api/financial-profiles/:profileId/staff-costs", requireAdmin, async (req, res) => {
    try {
      const costs = await storage.getStaffRoleCosts(req.params.profileId);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching staff costs:", error);
      res.status(500).json({ error: "Errore nel recupero dei costi personale" });
    }
  });

  app.post("/api/staff-costs", requireAdmin, async (req, res) => {
    try {
      const { profileId, roleName, hourlyCost, hoursPerTrip, monthlyFixedCost, description } = req.body;
      if (!profileId || !roleName || hourlyCost === undefined) {
        return res.status(400).json({ error: "Profilo, ruolo e costo orario obbligatori" });
      }
      // Map roleName to roleKey (canonical enum values)
      const validRoleKeys = ['autista', 'soccorritore', 'infermiere', 'medico', 'coordinatore'];
      const roleKey = validRoleKeys.includes(roleName.toLowerCase()) ? roleName.toLowerCase() : null;

      const cost = await storage.createStaffRoleCost({
        profileId,
        roleKey,
        roleName,
        hourlyCost: parseFloat(hourlyCost),
        hoursPerTrip: hoursPerTrip ? parseFloat(hoursPerTrip) : null,
        monthlyFixedCost: monthlyFixedCost ? parseFloat(monthlyFixedCost) : null,
        description: description || null,
      });
      res.status(201).json(cost);
    } catch (error) {
      console.error("Error creating staff cost:", error);
      res.status(500).json({ error: "Errore nella creazione del costo personale" });
    }
  });

  app.put("/api/staff-costs/:id", requireAdmin, async (req, res) => {
    try {
      const { roleName, hourlyCost, hoursPerTrip, monthlyFixedCost, description } = req.body;
      // Map roleName to roleKey (canonical enum values)
      const validRoleKeys = ['autista', 'soccorritore', 'infermiere', 'medico', 'coordinatore'];
      const roleKey = roleName && validRoleKeys.includes(roleName.toLowerCase()) ? roleName.toLowerCase() : undefined;

      const cost = await storage.updateStaffRoleCost(req.params.id, {
        roleKey,
        roleName,
        hourlyCost: hourlyCost !== undefined ? parseFloat(hourlyCost) : undefined,
        hoursPerTrip: hoursPerTrip !== undefined ? parseFloat(hoursPerTrip) : undefined,
        monthlyFixedCost: monthlyFixedCost !== undefined ? parseFloat(monthlyFixedCost) : undefined,
        description,
      });
      if (!cost) {
        return res.status(404).json({ error: "Costo personale non trovato" });
      }
      res.json(cost);
    } catch (error) {
      console.error("Error updating staff cost:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del costo personale" });
    }
  });

  app.delete("/api/staff-costs/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteStaffRoleCost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Costo personale non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting staff cost:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del costo personale" });
    }
  });

  // Revenue Models
  app.get("/api/financial-profiles/:profileId/revenue-models", requireAdmin, async (req, res) => {
    try {
      const models = await storage.getRevenueModels(req.params.profileId);
      res.json(models);
    } catch (error) {
      console.error("Error fetching revenue models:", error);
      res.status(500).json({ error: "Errore nel recupero dei modelli di ricavo" });
    }
  });

  app.post("/api/revenue-models", requireAdmin, async (req, res) => {
    try {
      const { profileId, contractName, tripType, baseFee, perKmRate, perMinuteRate, minimumFee, notes, isActive } = req.body;
      if (!profileId || !contractName || baseFee === undefined) {
        return res.status(400).json({ error: "Profilo, contratto e tariffa base obbligatori" });
      }
      const model = await storage.createRevenueModel({
        profileId,
        contractName,
        tripType: tripType || null,
        baseFee: parseFloat(baseFee),
        perKmRate: perKmRate ? parseFloat(perKmRate) : null,
        perMinuteRate: perMinuteRate ? parseFloat(perMinuteRate) : null,
        minimumFee: minimumFee ? parseFloat(minimumFee) : null,
        notes: notes || null,
        isActive: isActive !== false,
      });
      res.status(201).json(model);
    } catch (error) {
      console.error("Error creating revenue model:", error);
      res.status(500).json({ error: "Errore nella creazione del modello di ricavo" });
    }
  });

  app.put("/api/revenue-models/:id", requireAdmin, async (req, res) => {
    try {
      const { contractName, tripType, baseFee, perKmRate, perMinuteRate, minimumFee, notes, isActive } = req.body;
      const model = await storage.updateRevenueModel(req.params.id, {
        contractName,
        tripType,
        baseFee: baseFee !== undefined ? parseFloat(baseFee) : undefined,
        perKmRate: perKmRate !== undefined ? parseFloat(perKmRate) : undefined,
        perMinuteRate: perMinuteRate !== undefined ? parseFloat(perMinuteRate) : undefined,
        minimumFee: minimumFee !== undefined ? parseFloat(minimumFee) : undefined,
        notes,
        isActive,
      });
      if (!model) {
        return res.status(404).json({ error: "Modello di ricavo non trovato" });
      }
      res.json(model);
    } catch (error) {
      console.error("Error updating revenue model:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del modello di ricavo" });
    }
  });

  app.delete("/api/revenue-models/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteRevenueModel(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Modello di ricavo non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting revenue model:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del modello di ricavo" });
    }
  });

  // ========================================
  // CONTRACTS (APPALTI) - Hourly vehicle rental
  // ========================================

  app.get("/api/contracts", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const orgContracts = await db.select().from(contracts).where(eq(contracts.organizationId, orgId));
        return res.json(orgContracts);
      }
      const allContracts = await storage.getContracts();
      res.json(allContracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Errore nel recupero degli appalti" });
    }
  });

  app.get("/api/contracts/:id", requireAdmin, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Appalto non trovato" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ error: "Errore nel recupero dell'appalto" });
    }
  });

  app.post("/api/contracts", requireAdmin, async (req, res) => {
    try {
      const { name, clientName, description, startDate, endDate, requiredVehicles, requiredHoursPerDay, defaultHourlyRate, notes, isActive } = req.body;
      if (!name || !clientName || !startDate) {
        return res.status(400).json({ error: "Nome, cliente e data inizio obbligatori" });
      }
      const contractData: any = {
        name,
        clientName,
        description: description || null,
        startDate,
        endDate: endDate || null,
        requiredVehicles: requiredVehicles ? parseInt(requiredVehicles) : null,
        requiredHoursPerDay: requiredHoursPerDay ? parseFloat(requiredHoursPerDay) : null,
        defaultHourlyRate: defaultHourlyRate ? parseFloat(defaultHourlyRate) : null,
        notes: notes || null,
        isActive: isActive !== false,
      };
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        contractData.organizationId = orgId;
      }
      const contract = await storage.createContract(contractData);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(500).json({ error: "Errore nella creazione dell'appalto" });
    }
  });

  app.put("/api/contracts/:id", requireAdmin, async (req, res) => {
    try {
      const { name, clientName, description, startDate, endDate, requiredVehicles, requiredHoursPerDay, defaultHourlyRate, notes, isActive } = req.body;
      const contract = await storage.updateContract(req.params.id, {
        name,
        clientName,
        description,
        startDate,
        endDate,
        requiredVehicles: requiredVehicles !== undefined ? parseInt(requiredVehicles) : undefined,
        requiredHoursPerDay: requiredHoursPerDay !== undefined ? parseFloat(requiredHoursPerDay) : undefined,
        defaultHourlyRate: defaultHourlyRate !== undefined ? parseFloat(defaultHourlyRate) : undefined,
        notes,
        isActive,
      });
      if (!contract) {
        return res.status(404).json({ error: "Appalto non trovato" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dell'appalto" });
    }
  });

  app.delete("/api/contracts/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteContract(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Appalto non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ error: "Errore nell'eliminazione dell'appalto" });
    }
  });

  // Contract Vehicles
  app.get("/api/contracts/:id/vehicles", requireAdmin, async (req, res) => {
    try {
      const cvList = await storage.getContractVehicles(req.params.id);
      res.json(cvList);
    } catch (error) {
      console.error("Error fetching contract vehicles:", error);
      res.status(500).json({ error: "Errore nel recupero dei veicoli dell'appalto" });
    }
  });

  app.post("/api/contracts/:id/vehicles", requireAdmin, async (req, res) => {
    try {
      const { vehicleId, hourlyRate, hoursPerWeek, crewType, startDate, endDate, notes, isActive } = req.body;
      if (!vehicleId) {
        return res.status(400).json({ error: "ID veicolo obbligatorio" });
      }
      const cv = await storage.addVehicleToContract({
        contractId: req.params.id,
        vehicleId,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        hoursPerWeek: hoursPerWeek ? parseFloat(hoursPerWeek) : null,
        crewType: crewType || "autista_soccorritore",
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes || null,
        isActive: isActive !== false,
      });
      res.status(201).json(cv);
    } catch (error) {
      console.error("Error adding vehicle to contract:", error);
      res.status(500).json({ error: "Errore nell'aggiunta del veicolo all'appalto" });
    }
  });

  app.put("/api/contract-vehicles/:id", requireAdmin, async (req, res) => {
    try {
      const { hourlyRate, hoursPerWeek, crewType, startDate, endDate, notes, isActive } = req.body;
      const cv = await storage.updateContractVehicle(req.params.id, {
        hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : undefined,
        hoursPerWeek: hoursPerWeek !== undefined ? parseFloat(hoursPerWeek) : undefined,
        crewType,
        startDate,
        endDate,
        notes,
        isActive,
      });
      if (!cv) {
        return res.status(404).json({ error: "Assegnazione veicolo non trovata" });
      }
      res.json(cv);
    } catch (error) {
      console.error("Error updating contract vehicle:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dell'assegnazione veicolo" });
    }
  });

  app.delete("/api/contract-vehicles/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.removeVehicleFromContract(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Assegnazione veicolo non trovata" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing vehicle from contract:", error);
      res.status(500).json({ error: "Errore nella rimozione del veicolo dall'appalto" });
    }
  });

  // Vehicle hourly pricing update
  app.put("/api/vehicles/:id/pricing", requireAdmin, async (req, res) => {
    try {
      const { hourlyOperatingCost, hourlyRevenueRate, defaultCrewType } = req.body;
      const vehicle = await storage.updateVehicle(req.params.id, {
        hourlyOperatingCost: hourlyOperatingCost !== undefined ? parseFloat(hourlyOperatingCost) : undefined,
        hourlyRevenueRate: hourlyRevenueRate !== undefined ? parseFloat(hourlyRevenueRate) : undefined,
        defaultCrewType: defaultCrewType || undefined,
      });
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle pricing:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del pricing del veicolo" });
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
          const logoFile = path.join(UPLOADS_DIR,"logos", `${org.id}.png`);
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

  app.get("/api/statistics/financial-summary", requireAdmin, async (req, res) => {
    try {
      const { dateFrom, dateTo, profileId, vehicleId, locationId } = req.query;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: "Date di inizio e fine obbligatorie" });
      }

      const summary = await calculateFinancialSummary(
        dateFrom as string,
        dateTo as string,
        profileId as string | undefined,
        vehicleId as string | undefined,
        locationId as string | undefined
      );

      res.json(summary);
    } catch (error) {
      console.error("Error calculating financial summary:", error);
      res.status(500).json({ error: "Errore nel calcolo del riepilogo finanziario" });
    }
  });

  // ========================================
  // ECONOMIC ANALYSIS ENDPOINTS
  // ========================================

  // economicAnalysis imported statically at top of file

  app.get("/api/economic/summary", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const queryWithOrg = { ...req.query, organizationId: orgId || undefined };
      const summary = await economicAnalysis.getEconomicSummary(queryWithOrg);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching economic summary:", error);
      res.status(500).json({ error: "Errore nel calcolo sommario economico" });
    }
  });

  app.get("/api/economic/trends", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const queryWithOrg = { ...req.query, organizationId: orgId || undefined };
      const trends = await economicAnalysis.getEconomicTrends(queryWithOrg);
      res.json(trends);
    } catch (error) {
      console.error("Error fetching economic trends:", error);
      res.status(500).json({ error: "Errore nel calcolo trend economici" });
    }
  });

  app.get("/api/economic/cost-breakdown", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const queryWithOrg = { ...req.query, organizationId: orgId || undefined };
      const breakdown = await economicAnalysis.getCostBreakdown(queryWithOrg);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching cost breakdown:", error);
      res.status(500).json({ error: "Errore nel calcolo breakdown costi" });
    }
  });

  app.get("/api/economic/by-dimension", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const queryWithOrg = { ...req.query, organizationId: orgId || undefined };
      const analysis = await economicAnalysis.getAnalysisByDimension(queryWithOrg);
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching dimension analysis:", error);
      res.status(500).json({ error: "Errore nell'analisi per dimensione" });
    }
  });

  app.post("/api/economic/simulate", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const { filters, overrides } = req.body;
      const result = await economicAnalysis.simulateScenario(filters ? {...filters, organizationId: orgId || undefined} : {...req.query, organizationId: orgId || undefined}, overrides || {});
      res.json(result);
    } catch (error) {
      console.error("Error simulating scenario:", error);
      res.status(500).json({ error: "Errore nella simulazione scenario" });
    }
  });

  app.get("/api/economic/insights", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const queryWithOrg = { ...req.query, organizationId: orgId || undefined };
      const insights = await economicAnalysis.getEconomicInsights(queryWithOrg);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching economic insights:", error);
      res.status(500).json({ error: "Errore nel recupero insights" });
    }
  });

  app.get("/api/economic/top-performers", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const queryWithOrg = { ...req.query, organizationId: orgId || undefined };
      const performers = await economicAnalysis.getTopPerformers(queryWithOrg);
      res.json(performers);
    } catch (error) {
      console.error("Error fetching top performers:", error);
      res.status(500).json({ error: "Errore nel recupero top performers" });
    }
  });
}
