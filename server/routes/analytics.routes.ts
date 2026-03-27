import type { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import {
  trips, vehicles as vehiclesTable, staffMembers, users,
  tripCarbonFootprint, contracts, organizations,
  tenderMonitors, tenderSimulations, orgScoreCards, saasMetrics,
  orgHealthScores, revenueForecasts, predictiveAlerts, benchmarks,
  vehicleDocuments,
} from "@shared/schema";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin, getEffectiveOrgId } from "../auth-middleware";
import * as dataQuality from "../data-quality-engine";
import { generateAnalyticsReportPDF } from "../pdf-generator";

let lastAnacSync = new Date(0);

export function registerAnalyticsRoutes(app: Express) {

  // ========================================
  // DATA QUALITY
  // ========================================

  // Overview metrics (lightweight)
  app.get("/api/data-quality/metrics", requireAdmin, async (req, res) => {
    try {
      const overview = await dataQuality.calculateOverallQualityScore();

      // Get timeliness data
      const timelinessResults = await dataQuality.analyzeTripsTimeliness();
      const lateCount = timelinessResults.filter(r => r.status === "late").length;
      const latePercent = overview.totalRecords > 0
        ? Math.round(lateCount / overview.totalRecords * 100)
        : 0;

      // Get anomalies for breakdown
      const anomalies = await dataQuality.analyzeTripsCoherence();
      const anomalyByType: Record<string, number> = {};
      for (const a of anomalies) {
        anomalyByType[a.anomalyType] = (anomalyByType[a.anomalyType] || 0) + 1;
      }

      // Get completeness for field breakdown
      const completenessResults = await dataQuality.analyzeTripsCompleteness();
      const fieldMissing: Record<string, number> = {};
      for (const r of completenessResults) {
        for (const f of [...r.missingFields, ...r.criticalMissing]) {
          fieldMissing[f] = (fieldMissing[f] || 0) + 1;
        }
      }

      // Get critical records
      const allTrips = await storage.getTrips();
      const allVehicles = await storage.getVehicles();
      const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

      const criticalDetails: any[] = [];
      const issueTrips = new Set<string>();

      // Add trips with anomalies
      for (const a of anomalies) {
        if (a.severity === "critical" && !issueTrips.has(a.entityId)) {
          issueTrips.add(a.entityId);
          const trip = allTrips.find(t => t.id === a.entityId);
          if (trip && criticalDetails.length < 20) {
            criticalDetails.push({
              id: trip.id,
              progressiveNumber: trip.progressiveNumber,
              serviceType: trip.serviceType === 'emergenza' ? 'Trasporto Critico' :
                           trip.serviceType === 'dialisi' ? 'Dialisi' : 'Ordinario',
              status: 'anomaly',
              vehicleCode: vehicleMap.get(trip.vehicleId)?.code || 'N/A',
              issue: a.description
            });
          }
        }
      }

      // Add incomplete trips
      for (const r of completenessResults) {
        if (r.criticalMissing.length > 0 && !issueTrips.has(r.entityId) && criticalDetails.length < 20) {
          issueTrips.add(r.entityId);
          const trip = allTrips.find(t => t.id === r.entityId);
          if (trip) {
            criticalDetails.push({
              id: trip.id,
              progressiveNumber: trip.progressiveNumber,
              serviceType: trip.serviceType === 'emergenza' ? 'Trasporto Critico' :
                           trip.serviceType === 'dialisi' ? 'Dialisi' : 'Ordinario',
              status: 'incomplete',
              vehicleCode: vehicleMap.get(trip.vehicleId)?.code || 'N/A',
              issue: `Campi mancanti: ${r.criticalMissing.join(', ')}`
            });
          }
        }
      }

      res.json({
        qualityScore: overview.globalScore,
        completenessScore: overview.completenessScore,
        coherenceScore: overview.coherenceScore,
        timelinessScore: overview.timelinessScore,
        accuracyScore: overview.accuracyScore,
        scoreChange: 0,
        totalRecords: overview.totalRecords,
        criticalRecords: overview.criticalAnomalies + overview.incompleteRecords,
        completenessPercent: overview.completenessScore,
        incompleteTrips: overview.incompleteRecords,
        missingFields: {
          datetime: fieldMissing.departureTime || 0,
          destination: fieldMissing.destination || 0,
          km: fieldMissing.kmInitial || 0,
          returnTime: fieldMissing.returnTime || 0,
          serviceType: fieldMissing.serviceType || 0
        },
        anomalies: {
          kmInvalid: anomalyByType.km_invalid || 0,
          kmRegression: anomalyByType.km_regression || 0,
          timeInvalid: anomalyByType.time_invalid || 0,
          noDeparture: anomalyByType.no_departure || 0,
          overlap: anomalyByType.overlap || 0,
          durationMismatch: anomalyByType.duration_mismatch || 0,
          kmImplausible: anomalyByType.km_implausible || 0
        },
        latePercent,
        realtimePercent: overview.realtimePercent,
        weeklyChange: 0,
        criticalDetails
      });
    } catch (error) {
      console.error("Error fetching data quality metrics:", error);
      res.status(500).json({ error: "Errore nel recupero metriche qualita" });
    }
  });

  // Detailed metrics (full analysis)
  app.get("/api/data-quality/detailed", requireAdmin, async (req, res) => {
    try {
      const metrics = await dataQuality.getDetailedQualityMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching detailed data quality:", error);
      res.status(500).json({ error: "Errore nel recupero analisi dettagliata" });
    }
  });

  // Anomalies list
  app.get("/api/data-quality/anomalies", requireAdmin, async (req, res) => {
    try {
      const anomalies = await dataQuality.analyzeTripsCoherence();
      res.json({ anomalies });
    } catch (error) {
      console.error("Error fetching anomalies:", error);
      res.status(500).json({ error: "Errore nel recupero anomalie" });
    }
  });

  // Timeliness distribution
  app.get("/api/data-quality/timeliness", requireAdmin, async (req, res) => {
    try {
      const results = await dataQuality.analyzeTripsTimeliness();
      const distribution = { realtime: 0, timely: 0, delayed: 0, late: 0 };
      let totalDelay = 0;

      for (const r of results) {
        distribution[r.status]++;
        totalDelay += r.delayMinutes;
      }

      res.json({
        distribution,
        avgDelayMinutes: results.length > 0 ? Math.round(totalDelay / results.length) : 0,
        totalRecords: results.length
      });
    } catch (error) {
      console.error("Error fetching timeliness:", error);
      res.status(500).json({ error: "Errore nel recupero tempestivita" });
    }
  });

  // Quality trend (historical)
  app.get("/api/data-quality/trend", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trend = await dataQuality.getQualityTrend(days);
      res.json({ trend });
    } catch (error) {
      console.error("Error fetching quality trend:", error);
      res.status(500).json({ error: "Errore nel recupero trend" });
    }
  });

  // Save quality snapshot (for daily cron)
  app.post("/api/data-quality/snapshot", requireAdmin, async (req, res) => {
    try {
      const overview = await dataQuality.saveQualitySnapshot();
      res.json({ success: true, overview });
    } catch (error) {
      console.error("Error saving quality snapshot:", error);
      res.status(500).json({ error: "Errore nel salvataggio snapshot" });
    }
  });

  // Get configuration
  app.get("/api/data-quality/config", requireAdmin, async (req, res) => {
    try {
      res.json(dataQuality.DEFAULT_QUALITY_CONFIG);
    } catch (error) {
      res.status(500).json({ error: "Errore nel recupero configurazione" });
    }
  });

  // ========================================
  // UTIF QUALITY VALIDATION
  // ========================================

  // Validate data quality before UTIF report generation
  app.get("/api/reports/utif-validate", requireAdmin, async (req, res) => {
    try {
      const { vehicleId, dateFrom, dateTo } = req.query;

      if (!vehicleId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Parametri mancanti" });
      }

      // Get trips for the period
      const allTrips = await storage.getTripsByVehicle(vehicleId as string);
      const fromDate = new Date(dateFrom as string);
      const toDate = new Date(dateTo as string);
      toDate.setHours(23, 59, 59, 999);

      const filteredTrips = allTrips.filter(trip => {
        const tripDate = new Date(trip.serviceDate);
        return tripDate >= fromDate && tripDate <= toDate;
      });

      // Analyze quality for these specific trips
      const completenessResults = await dataQuality.analyzeTripsCompleteness();
      const coherenceResults = await dataQuality.analyzeTripsCoherence();

      // Filter results to only include our trips
      const tripIds = new Set(filteredTrips.map(t => t.id));

      const relevantCompleteness = completenessResults.filter(r => tripIds.has(r.entityId));
      const relevantAnomalies = coherenceResults.filter(r => tripIds.has(r.entityId));

      // Calculate quality metrics for this specific report
      const totalTrips = filteredTrips.length;
      const incompleteTrips = relevantCompleteness.filter(r => !r.isComplete).length;
      const completenessPercent = totalTrips > 0
        ? Math.round(((totalTrips - incompleteTrips) / totalTrips) * 100)
        : 100;

      const criticalAnomalies = relevantAnomalies.filter(a => a.severity === "critical");
      const warningAnomalies = relevantAnomalies.filter(a => a.severity === "warning");

      // Determine overall quality status
      let status: "ok" | "warning" | "critical" = "ok";
      let canGenerate = true;
      const issues: string[] = [];

      if (criticalAnomalies.length > 0) {
        status = "critical";
        canGenerate = false;
        issues.push(`${criticalAnomalies.length} anomalie critiche (km invalidi, sovrapposizioni)`);
      }

      if (warningAnomalies.length > 0) {
        if (status === "ok") status = "warning";
        issues.push(`${warningAnomalies.length} anomalie da verificare`);
      }

      if (incompleteTrips > 0) {
        if (status === "ok") status = "warning";
        issues.push(`${incompleteTrips} viaggi con dati incompleti`);
      }

      if (totalTrips === 0) {
        status = "warning";
        issues.push("Nessun viaggio nel periodo selezionato");
      }

      res.json({
        status,
        canGenerate,
        totalTrips,
        completenessPercent,
        criticalCount: criticalAnomalies.length,
        warningCount: warningAnomalies.length,
        incompleteCount: incompleteTrips,
        issues,
        anomalies: relevantAnomalies.slice(0, 10).map(a => ({
          tripId: a.entityId,
          type: a.anomalyType,
          severity: a.severity,
          description: a.description
        }))
      });
    } catch (error) {
      console.error("Error validating UTIF quality:", error);
      res.status(500).json({ error: "Errore nella validazione qualità" });
    }
  });

  // Analytics Report PDF - Premium design export
  app.post("/api/reports/analytics-pdf", requireAdmin, async (req, res) => {
    try {
      const data = req.body;

      if (!data || !data.kpis) {
        return res.status(400).json({ error: "Dati mancanti per la generazione del report" });
      }

      const doc = await generateAnalyticsReportPDF(data);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="statistiche_operative_${new Date().toISOString().split("T")[0]}.pdf"`);

      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error("Error generating analytics PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF" });
    }
  });

  // ========================================
  // TENDERS - ANAC Open Data Integration
  // ========================================

  // ANAC Open Data Integration - Auto-import Veneto tenders
  app.post("/api/tenders/sync-anac", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      let imported = 0;

      // Try ANAC OpenData API — CPV trasporto sanitario, tutta Italia, nessun filtro regione
      try {
        const ANAC_BASE = "https://api.anticorruzione.it/opendata/ocds/api/v1/1.0.0";
        const now = new Date();
        const nineMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 9, 1);
        const startDate = nineMonthsAgo.toISOString().split('T')[0];
        const endDate = now.toISOString().split('T')[0];

        // Recupera fino a 100 CIG — nessun filtro regione
        const idsUrl = `${ANAC_BASE}/tender/ids?filterField=tenderStartDate&filterArgs=${startDate},${endDate}&tenderStatus=OPEN&limit=100`;
        const idsResponse = await fetch(idsUrl, { signal: AbortSignal.timeout(8000) });

        if (!idsResponse.ok) throw new Error(`ANAC API returned ${idsResponse.status}`);
        const tenderIds = await idsResponse.json();
        if (!Array.isArray(tenderIds) || tenderIds.length === 0) throw new Error("No tender IDs returned");

        // CPV trasporto sanitario (tutti i codici pertinenti)
        const healthCpvCodes = [
          '85143000', // Trasporto in ambulanza
          '60130000', // Servizi di trasporto stradale speciale
          '85111000', // Servizi ospedalieri
          '85112000', // Servizi paramedici
          '85140000', // Servizi sanitari vari
          '85100000', // Servizi sanitari
          '85110000', // Servizi ospedalieri e connessi
          '33192160', // Barelle
          '34114100', // Veicoli di emergenza
          '34114110', // Ambulanze
          '34114120', // Veicoli per paramedicale
        ];

        let releaseFailures = 0;
        console.log(`ANAC: trovati ${tenderIds.length} CIG, elaboro fino a 20...`);

        for (const tender of tenderIds.slice(0, 20)) {
          try {
            const releaseUrl = `${ANAC_BASE}/releases/tender/${encodeURIComponent(tender.value)}`;
            const releaseRes = await fetch(releaseUrl, { signal: AbortSignal.timeout(4000) });
            if (!releaseRes.ok) { releaseFailures++; if (releaseFailures >= 5) throw new Error("Releases endpoint down"); continue; }
            const releases = await releaseRes.json();
            if (!Array.isArray(releases) || releases.length === 0) continue;

            const release = releases[0];
            const tenderData = release.tender;
            if (!tenderData) continue;

            const cpvCodes: string[] = (tenderData.items || []).map((i: any) => i.classification?.id || '');
            const isHealthTransport = cpvCodes.some((c: string) =>
              healthCpvCodes.some(h => c.startsWith(h.substring(0, 5)))
            );

            // Importa TUTTI i bandi di trasporto sanitario, qualunque regione
            if (isHealthTransport) {
              const existingCheck = await db.select().from(tenderMonitors)
                .where(eq(tenderMonitors.cigCode, tender.value)).limit(1);
              if (existingCheck.length === 0) {
                const buyerRegion = release.buyer?.address?.region || null;
                const serviceType = cpvCodes.some((c: string) => c.startsWith('85143') || c.startsWith('34114'))
                  ? 'emergenza_118'
                  : cpvCodes.some((c: string) => c.startsWith('60130'))
                    ? 'trasporto_ordinario'
                    : 'altro';
                await db.insert(tenderMonitors).values({
                  organizationId: orgId || 'croce-europa-default',
                  title: tenderData.title || `Bando ${tender.value}`,
                  source: 'ANAC',
                  sourceUrl: `https://dati.anticorruzione.it/superset/dashboard/dettaglio_cig/?cig=${tender.value}`,
                  status: 'new',
                  priority: 'medium',
                  serviceType,
                  stationeName: release.buyer?.name || null,
                  estimatedValue: tenderData.value?.amount ? Number(tenderData.value.amount) : null,
                  cigCode: tender.value,
                  cpvCode: cpvCodes[0] || null,
                  region: buyerRegion,
                  province: release.buyer?.address?.locality || null,
                  deadline: tenderData.tenderPeriod?.endDate ? new Date(tenderData.tenderPeriod.endDate) : null,
                  durationMonths: tenderData.contractPeriod?.durationInDays
                    ? Math.ceil(tenderData.contractPeriod.durationInDays / 30)
                    : null,
                  notes: `Importato da ANAC Open Data. ${tenderData.description || ''}`.trim(),
                });
                imported++;

              }
            }
          } catch (innerErr: any) {
            releaseFailures++;
            if (releaseFailures >= 5) throw new Error("Releases endpoint consistently failing");
            continue;
          }
        }
        console.log(`ANAC: importati ${imported} bandi nuovi`);
      } catch (anacError: any) {
        console.error("ANAC API non disponibile:", anacError.message);
        return res.status(503).json({
          error: "Nessuna gara trovata da ANAC. Verifica la connessione o riprova più tardi.",
          detail: anacError.message,
        });
      }

      lastAnacSync = new Date();
      res.json({
        imported,
        source: 'ANAC Open Data',
        message: imported > 0
          ? `Importati ${imported} nuovi bandi da ANAC Open Data`
          : 'Nessun nuovo bando trovato. Tutti i bandi recenti sono già presenti nel sistema.',
      });
    } catch (error) {
      console.error("Error syncing ANAC:", error);
      res.status(500).json({ error: "Errore nella sincronizzazione ANAC" });
    }
  });

  app.get("/api/tenders/last-sync", requireAuth, (req, res) => {
    const nextSync = new Date(lastAnacSync.getTime() + 6 * 60 * 60 * 1000);
    res.json({
      lastSync: lastAnacSync.toISOString(),
      nextSync: nextSync.toISOString(),
    });
  });

  app.get("/api/tenders", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const isSuperAdmin = req.session.userRole === "super_admin";
      let result;
      if (isSuperAdmin && !orgId) {
        result = await db.select().from(tenderMonitors).orderBy(desc(tenderMonitors.createdAt));
      } else {
        result = await db.select().from(tenderMonitors).where(eq(tenderMonitors.organizationId, orgId!)).orderBy(desc(tenderMonitors.createdAt));
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching tenders:", error);
      res.status(500).json({ error: "Errore nel recupero dei bandi" });
    }
  });

  app.post("/api/tenders", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const data = { ...req.body, organizationId: orgId };
      const [tender] = await db.insert(tenderMonitors).values(data).returning();
      res.json(tender);
    } catch (error) {
      console.error("Error creating tender:", error);
      res.status(500).json({ error: "Errore nella creazione del bando" });
    }
  });

  app.put("/api/tenders/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(tenderMonitors).set({ ...req.body, updatedAt: new Date() }).where(eq(tenderMonitors.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Bando non trovato" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating tender:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del bando" });
    }
  });

  app.delete("/api/tenders/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(tenderMonitors).where(eq(tenderMonitors.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tender:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del bando" });
    }
  });

  // ============================================================================
  // TENDER SIMULATIONS
  // ============================================================================

  function calculateSimulationCosts(params: any) {
    const vehiclesCount = params.vehiclesCount || 1;
    const personnelCount = params.personnelCount || 2;
    const hoursPerDay = params.hoursPerDay || 12;
    const daysPerMonth = params.daysPerMonth || 30;
    const durationMonths = params.durationMonths || 12;
    const marginPercent = params.marginPercent || 15;

    const fuelCostMonthly = vehiclesCount * hoursPerDay * daysPerMonth * 3.5;
    const personnelCostMonthly = personnelCount * hoursPerDay * daysPerMonth * 18;
    const vehicleCostMonthly = vehiclesCount * 1200;
    const insuranceCostMonthly = vehiclesCount * 350;
    const maintenanceCostMonthly = vehiclesCount * 400;
    const overheadCostMonthly = (fuelCostMonthly + personnelCostMonthly + vehicleCostMonthly + insuranceCostMonthly + maintenanceCostMonthly) * 0.08;

    const totalCostMonthly = fuelCostMonthly + personnelCostMonthly + vehicleCostMonthly + insuranceCostMonthly + maintenanceCostMonthly + overheadCostMonthly;
    const proposedMonthlyPrice = totalCostMonthly * (1 + marginPercent / 100);
    const proposedTotalPrice = proposedMonthlyPrice * durationMonths;
    const totalHoursMonth = vehiclesCount * hoursPerDay * daysPerMonth;
    const pricePerHour = totalHoursMonth > 0 ? proposedMonthlyPrice / totalHoursMonth : 0;

    return {
      fuelCostMonthly: Math.round(fuelCostMonthly * 100) / 100,
      personnelCostMonthly: Math.round(personnelCostMonthly * 100) / 100,
      vehicleCostMonthly: Math.round(vehicleCostMonthly * 100) / 100,
      insuranceCostMonthly: Math.round(insuranceCostMonthly * 100) / 100,
      maintenanceCostMonthly: Math.round(maintenanceCostMonthly * 100) / 100,
      overheadCostMonthly: Math.round(overheadCostMonthly * 100) / 100,
      totalCostMonthly: Math.round(totalCostMonthly * 100) / 100,
      proposedMonthlyPrice: Math.round(proposedMonthlyPrice * 100) / 100,
      proposedTotalPrice: Math.round(proposedTotalPrice * 100) / 100,
      pricePerHour: Math.round(pricePerHour * 100) / 100,
    };
  }

  app.get("/api/tender-simulations", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const isSuperAdmin = req.session.userRole === "super_admin";
      let result;
      if (isSuperAdmin && !orgId) {
        result = await db.select().from(tenderSimulations).orderBy(desc(tenderSimulations.createdAt));
      } else {
        result = await db.select().from(tenderSimulations).where(eq(tenderSimulations.organizationId, orgId!)).orderBy(desc(tenderSimulations.createdAt));
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching tender simulations:", error);
      res.status(500).json({ error: "Errore nel recupero delle simulazioni" });
    }
  });

  app.post("/api/tender-simulations", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const costs = calculateSimulationCosts(req.body);
      const data = { ...req.body, ...costs, organizationId: orgId };
      const [simulation] = await db.insert(tenderSimulations).values(data).returning();
      res.json(simulation);
    } catch (error) {
      console.error("Error creating tender simulation:", error);
      res.status(500).json({ error: "Errore nella creazione della simulazione" });
    }
  });

  app.put("/api/tender-simulations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(tenderSimulations).set(req.body).where(eq(tenderSimulations.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Simulazione non trovata" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating tender simulation:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento della simulazione" });
    }
  });

  app.delete("/api/tender-simulations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(tenderSimulations).where(eq(tenderSimulations.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tender simulation:", error);
      res.status(500).json({ error: "Errore nell'eliminazione della simulazione" });
    }
  });

  app.post("/api/tender-simulations/:id/calculate", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(tenderSimulations).where(eq(tenderSimulations.id, id));
      if (!existing) return res.status(404).json({ error: "Simulazione non trovata" });

      const costs = calculateSimulationCosts(existing);
      const [updated] = await db.update(tenderSimulations).set(costs).where(eq(tenderSimulations.id, id)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error recalculating simulation:", error);
      res.status(500).json({ error: "Errore nel ricalcolo della simulazione" });
    }
  });

  // ============================================================================
  // ORG SCORE CARDS
  // ============================================================================

  async function calculateOrgScoreCard(orgId: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const dateStr = twelveMonthsAgo.toISOString().split("T")[0];

    const [tripStats] = await db.select({
      count: sql<number>`COUNT(*)::int`,
      totalKm: sql<number>`COALESCE(SUM(${trips.kmTraveled}), 0)::real`,
    }).from(trips).where(and(eq(trips.organizationId, orgId), gte(trips.serviceDate, dateStr)));

    const [vehicleStats] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.isActive, true)));

    const [staffStats] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(staffMembers).where(eq(staffMembers.organizationId, orgId));

    const totalTrips = tripStats?.count || 0;
    const totalKm = tripStats?.totalKm || 0;
    const fleetSize = vehicleStats?.count || 0;
    const activePersonnel = staffStats?.count || 0;

    const operationalScore = Math.min(100, Math.round((totalTrips / 50) * 10));

    const [completeness] = await db.select({
      withDeparture: sql<number>`COUNT(CASE WHEN ${trips.departureTime} IS NOT NULL THEN 1 END)::int`,
      withReturn: sql<number>`COUNT(CASE WHEN ${trips.returnTime} IS NOT NULL THEN 1 END)::int`,
      total: sql<number>`COUNT(*)::int`,
    }).from(trips).where(and(eq(trips.organizationId, orgId), gte(trips.serviceDate, dateStr)));
    const completeFields = (completeness?.withDeparture || 0) + (completeness?.withReturn || 0);
    const totalFields = (completeness?.total || 1) * 2;
    const complianceScore = Math.min(100, Math.round((completeFields / totalFields) * 100));

    const [carbonStats] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(tripCarbonFootprint);
    const sustainabilityScore = Math.min(100, Math.round(((carbonStats?.count || 0) / Math.max(totalTrips, 1)) * 100));

    const [contractStats] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(contracts).where(eq(contracts.organizationId, orgId));
    const financialScore = Math.min(100, (contractStats?.count || 0) > 0 ? 70 + Math.min(30, (contractStats?.count || 0) * 10) : 30);

    const overallScore = Math.round((operationalScore * 0.3 + complianceScore * 0.25 + sustainabilityScore * 0.2 + financialScore * 0.25));

    const scoreData = {
      organizationId: orgId,
      totalTripsLast12m: totalTrips,
      fleetSize,
      activePersonnel,
      totalKmLast12m: totalKm,
      operationalScore,
      complianceScore,
      sustainabilityScore,
      financialScore,
      overallScore,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    };

    const [existing] = await db.select().from(orgScoreCards).where(eq(orgScoreCards.organizationId, orgId));
    let result;
    if (existing) {
      [result] = await db.update(orgScoreCards).set(scoreData).where(eq(orgScoreCards.organizationId, orgId)).returning();
    } else {
      [result] = await db.insert(orgScoreCards).values(scoreData).returning();
    }
    return result;
  }

  app.get("/api/score-card", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const [scoreCard] = await db.select().from(orgScoreCards).where(eq(orgScoreCards.organizationId, orgId));
      if (!scoreCard) {
        const calculated = await calculateOrgScoreCard(orgId);
        return res.json(calculated);
      }
      res.json(scoreCard);
    } catch (error) {
      console.error("Error fetching score card:", error);
      res.status(500).json({ error: "Errore nel recupero della score card" });
    }
  });

  app.get("/api/score-card/:orgId", requireSuperAdmin, async (req, res) => {
    try {
      const { orgId } = req.params;
      const [scoreCard] = await db.select().from(orgScoreCards).where(eq(orgScoreCards.organizationId, orgId));
      if (!scoreCard) {
        const calculated = await calculateOrgScoreCard(orgId);
        return res.json(calculated);
      }
      res.json(scoreCard);
    } catch (error) {
      console.error("Error fetching score card:", error);
      res.status(500).json({ error: "Errore nel recupero della score card" });
    }
  });

  app.post("/api/score-card/calculate", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const result = await calculateOrgScoreCard(orgId);
      res.json(result);
    } catch (error) {
      console.error("Error calculating score card:", error);
      res.status(500).json({ error: "Errore nel calcolo della score card" });
    }
  });

  app.get("/api/score-card/:orgId/public", async (req, res) => {
    try {
      const { orgId } = req.params;
      const [scoreCard] = await db.select().from(orgScoreCards).where(and(eq(orgScoreCards.organizationId, orgId), eq(orgScoreCards.isPublic, true)));
      if (!scoreCard) return res.status(404).json({ error: "Profilo pubblico non disponibile" });

      const [org] = await db.select({ name: organizations.name, city: organizations.city }).from(organizations).where(eq(organizations.id, orgId));

      const roundTo100 = (n: number) => Math.floor(n / 100) * 100;
      const roundTo1000 = (n: number) => Math.floor(n / 1000) * 1000;
      const scoreRange = (s: number) => {
        const lower = Math.floor(s / 5) * 5;
        return `${lower}-${lower + 5}`;
      };
      const fleetRange = (n: number) => {
        if (n <= 5) return "1-5 veicoli";
        if (n <= 10) return "5-10 veicoli";
        if (n <= 20) return "10-20 veicoli";
        if (n <= 50) return "20-50 veicoli";
        return "50+ veicoli";
      };

      res.json({
        organizationName: org?.name || "Organizzazione",
        city: org?.city || null,
        totalTrips: `${roundTo100(scoreCard.totalTripsLast12m || 0).toLocaleString("it-IT")}+`,
        totalKm: `${roundTo1000(scoreCard.totalKmLast12m || 0).toLocaleString("it-IT")}+`,
        fleetSize: fleetRange(scoreCard.fleetSize || 0),
        operationalScore: scoreRange(scoreCard.operationalScore || 0),
        complianceScore: scoreRange(scoreCard.complianceScore || 0),
        sustainabilityScore: scoreRange(scoreCard.sustainabilityScore || 0),
        financialScore: scoreRange(scoreCard.financialScore || 0),
        overallScore: scoreRange(scoreCard.overallScore || 0),
        certifications: {
          iso9001: scoreCard.hasIso9001,
          iso45001: scoreCard.hasIso45001,
          iso14001: scoreCard.hasIso14001,
        },
      });
    } catch (error) {
      console.error("Error fetching public score card:", error);
      res.status(500).json({ error: "Errore nel recupero del profilo pubblico" });
    }
  });

  // ============================================================================
  // SAAS METRICS (super_admin only)
  // ============================================================================

  app.get("/api/saas-metrics", requireSuperAdmin, async (req, res) => {
    try {
      const [latest] = await db.select().from(saasMetrics).orderBy(desc(saasMetrics.createdAt)).limit(1);
      res.json(latest || null);
    } catch (error) {
      console.error("Error fetching SaaS metrics:", error);
      res.status(500).json({ error: "Errore nel recupero delle metriche SaaS" });
    }
  });

  app.get("/api/saas-metrics/history", requireSuperAdmin, async (req, res) => {
    try {
      const result = await db.select().from(saasMetrics).orderBy(desc(saasMetrics.createdAt)).limit(90);
      res.json(result);
    } catch (error) {
      console.error("Error fetching SaaS metrics history:", error);
      res.status(500).json({ error: "Errore nel recupero dello storico metriche" });
    }
  });

  app.post("/api/saas-metrics/calculate", requireSuperAdmin, async (req, res) => {
    try {
      const [orgStats] = await db.select({
        total: sql<number>`COUNT(*)::int`,
        active: sql<number>`COUNT(CASE WHEN ${organizations.status} = 'active' THEN 1 END)::int`,
        trial: sql<number>`COUNT(CASE WHEN ${organizations.status} = 'trial' THEN 1 END)::int`,
        inactive: sql<number>`COUNT(CASE WHEN ${organizations.status} = 'inactive' THEN 1 END)::int`,
      }).from(organizations);

      const [userStats] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(users);

      const [vehicleStats] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(vehiclesTable).where(eq(vehiclesTable.isActive, true));

      const [tripStats] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(trips);

      const activeOrgs = orgStats?.active || 0;
      const avgTripsPerOrg = activeOrgs > 0 ? Math.round((tripStats?.count || 0) / activeOrgs) : 0;

      const healthScores = await db.select().from(orgHealthScores);
      const avgHealth = healthScores.length > 0
        ? Math.round(healthScores.reduce((sum, h) => sum + (h.healthScore || 0), 0) / healthScores.length)
        : 0;
      const atRiskCount = healthScores.filter(h => h.riskLevel === "at_risk" || h.riskLevel === "critical").length;

      const today = new Date().toISOString().split("T")[0];
      const metricsData = {
        metricDate: today,
        totalOrgs: orgStats?.total || 0,
        activeOrgs,
        trialOrgs: orgStats?.trial || 0,
        churnedOrgs: orgStats?.inactive || 0,
        totalUsersAllOrgs: userStats?.count || 0,
        totalVehiclesAllOrgs: vehicleStats?.count || 0,
        totalTripsAllOrgs: tripStats?.count || 0,
        avgTripsPerOrg,
        avgHealthScore: avgHealth,
        atRiskOrgs: atRiskCount,
      };

      const [result] = await db.insert(saasMetrics).values(metricsData).returning();
      res.json(result);
    } catch (error) {
      console.error("Error calculating SaaS metrics:", error);
      res.status(500).json({ error: "Errore nel calcolo delle metriche SaaS" });
    }
  });

  // ============================================================================
  // ORG HEALTH SCORES (super_admin only)
  // ============================================================================

  app.get("/api/org-health", requireSuperAdmin, async (req, res) => {
    try {
      const result = await db.select().from(orgHealthScores).orderBy(desc(orgHealthScores.healthScore));
      res.json(result);
    } catch (error) {
      console.error("Error fetching org health scores:", error);
      res.status(500).json({ error: "Errore nel recupero dei punteggi salute" });
    }
  });

  app.get("/api/org-health/:orgId", requireSuperAdmin, async (req, res) => {
    try {
      const { orgId } = req.params;
      const [result] = await db.select().from(orgHealthScores).where(eq(orgHealthScores.organizationId, orgId));
      if (!result) return res.status(404).json({ error: "Punteggio salute non trovato" });
      res.json(result);
    } catch (error) {
      console.error("Error fetching org health:", error);
      res.status(500).json({ error: "Errore nel recupero del punteggio salute" });
    }
  });

  app.post("/api/org-health/calculate", requireSuperAdmin, async (req, res) => {
    try {
      const allOrgs = await db.select().from(organizations).where(eq(organizations.status, "active"));
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

      const totalAvailableModules = 15;
      const results = [];

      for (const org of allOrgs) {
        const orgUsers = await db.select().from(users).where(eq(users.organizationId, org.id));

        const recentLogins = orgUsers.filter(u => u.lastLoginAt && new Date(u.lastLoginAt) > fourWeeksAgo).length;
        const loginFrequency = Math.min(100, Math.round((recentLogins / Math.max(orgUsers.length, 1)) * 100));

        const [tripData] = await db.select({
          count: sql<number>`COUNT(*)::int`,
        }).from(trips).where(and(eq(trips.organizationId, org.id), gte(trips.serviceDate, fourWeeksAgoStr)));
        const tripsPerWeek = Math.round(((tripData?.count || 0) / 4) * 10) / 10;

        const enabledModules = Array.isArray(org.enabledModules) ? org.enabledModules.length : 0;
        const featureAdoption = Math.min(100, Math.round((enabledModules / totalAvailableModules) * 100));

        let filledFields = 0;
        const keyFields = [org.address, org.phone, org.email, org.city, org.province, org.vatNumber, org.pec];
        keyFields.forEach(f => { if (f) filledFields++; });
        const dataCompleteness = Math.round((filledFields / keyFields.length) * 100);

        const lastLogin = orgUsers
          .filter(u => u.lastLoginAt)
          .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())[0];
        const daysSinceLastLogin = lastLogin?.lastLoginAt
          ? Math.floor((Date.now() - new Date(lastLogin.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const tripsNormalized = Math.min(100, tripsPerWeek * 10);
        const healthScore = Math.round(
          loginFrequency * 0.2 +
          tripsNormalized * 0.3 +
          featureAdoption * 0.2 +
          dataCompleteness * 0.3
        );

        const riskLevel = healthScore > 70 ? "healthy" : healthScore >= 40 ? "at_risk" : "critical";

        const [previousScore] = await db.select().from(orgHealthScores).where(eq(orgHealthScores.organizationId, org.id));
        let trend = "stable";
        if (previousScore) {
          const diff = healthScore - (previousScore.healthScore || 0);
          if (diff > 5) trend = "improving";
          else if (diff < -5) trend = "declining";
        }

        const recommendedAction = riskLevel === "critical"
          ? "Contatto urgente: l'organizzazione è a rischio abbandono"
          : riskLevel === "at_risk"
          ? "Pianificare una call di supporto per aumentare l'adozione"
          : "Nessuna azione richiesta";

        const healthData = {
          organizationId: org.id,
          loginFrequency,
          tripsPerWeek,
          featureAdoption,
          dataCompleteness,
          lastActiveAt: lastLogin?.lastLoginAt || null,
          daysSinceLastLogin,
          healthScore,
          riskLevel,
          trend,
          recommendedAction,
          lastCalculatedAt: new Date(),
          updatedAt: new Date(),
        };

        if (previousScore) {
          const [updated] = await db.update(orgHealthScores).set(healthData).where(eq(orgHealthScores.organizationId, org.id)).returning();
          results.push(updated);
        } else {
          const [created] = await db.insert(orgHealthScores).values(healthData).returning();
          results.push(created);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error calculating org health scores:", error);
      res.status(500).json({ error: "Errore nel calcolo dei punteggi salute" });
    }
  });

  // ============================================================================
  // REVENUE FORECASTS
  // ============================================================================

  app.get("/api/revenue-forecasts", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const result = await db.select().from(revenueForecasts).where(eq(revenueForecasts.organizationId, orgId)).orderBy(desc(revenueForecasts.forecastMonth));
      res.json(result);
    } catch (error) {
      console.error("Error fetching revenue forecasts:", error);
      res.status(500).json({ error: "Errore nel recupero delle previsioni" });
    }
  });

  app.post("/api/revenue-forecasts/generate", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });

      const monthlyData: { month: string; tripCount: number; totalKm: number }[] = [];
      for (let i = 6; i >= 1; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
        const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];

        const [stats] = await db.select({
          count: sql<number>`COUNT(*)::int`,
          totalKm: sql<number>`COALESCE(SUM(${trips.kmTraveled}), 0)::real`,
        }).from(trips).where(and(
          eq(trips.organizationId, orgId),
          gte(trips.serviceDate, startDate),
          lte(trips.serviceDate, endDate)
        ));

        monthlyData.push({
          month: startDate,
          tripCount: stats?.count || 0,
          totalKm: stats?.totalKm || 0,
        });
      }

      const tripCounts = monthlyData.map(m => m.tripCount);
      const n = tripCounts.length;
      const avgTrips = n > 0 ? tripCounts.reduce((a, b) => a + b, 0) / n : 0;

      let slope = 0;
      if (n > 1) {
        const xMean = (n - 1) / 2;
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
          num += (i - xMean) * (tripCounts[i] - avgTrips);
          den += (i - xMean) * (i - xMean);
        }
        slope = den !== 0 ? num / den : 0;
      }

      const avgKmPerTrip = avgTrips > 0
        ? monthlyData.reduce((s, m) => s + m.totalKm, 0) / monthlyData.reduce((s, m) => s + m.tripCount, 0)
        : 25;
      const costPerKm = 1.8;
      const revenuePerTrip = 85;

      const dataPoints = tripCounts.filter(t => t > 0).length;
      const baseConfidence = Math.min(90, dataPoints * 15);

      const forecasts = [];
      for (let i = 1; i <= 6; i++) {
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + i);
        const forecastMonth = new Date(futureDate.getFullYear(), futureDate.getMonth(), 1).toISOString().split("T")[0];

        const projectedTrips = Math.max(0, Math.round(avgTrips + slope * (n + i - 1)));
        const projectedKm = Math.round(projectedTrips * avgKmPerTrip);
        const projectedRevenue = Math.round(projectedTrips * revenuePerTrip * 100) / 100;
        const projectedCosts = Math.round(projectedKm * costPerKm * 100) / 100;
        const projectedProfit = Math.round((projectedRevenue - projectedCosts) * 100) / 100;
        const confidenceLevel = Math.max(10, baseConfidence - i * 8);

        const [forecast] = await db.insert(revenueForecasts).values({
          organizationId: orgId,
          forecastMonth,
          projectedRevenue,
          projectedCosts,
          projectedProfit,
          projectedTrips,
          projectedKm,
          confidenceLevel,
          forecastModel: "linear",
        }).returning();
        forecasts.push(forecast);
      }

      res.json(forecasts);
    } catch (error) {
      console.error("Error generating revenue forecasts:", error);
      res.status(500).json({ error: "Errore nella generazione delle previsioni" });
    }
  });

  // ============================================================================
  // PREDICTIVE ALERTS
  // ============================================================================

  app.get("/api/predictive-alerts", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const result = await db.select().from(predictiveAlerts)
        .where(and(eq(predictiveAlerts.organizationId, orgId), eq(predictiveAlerts.status, "active")))
        .orderBy(desc(predictiveAlerts.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching predictive alerts:", error);
      res.status(500).json({ error: "Errore nel recupero degli alert" });
    }
  });

  app.put("/api/predictive-alerts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updateData: any = { status };
      if (status === "resolved" || status === "dismissed") {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = req.session.userId;
      }
      const [updated] = await db.update(predictiveAlerts).set(updateData).where(eq(predictiveAlerts.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Alert non trovato" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating predictive alert:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dell'alert" });
    }
  });

  app.post("/api/predictive-alerts/generate", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });

      const generatedAlerts = [];

      const orgVehicles = await db.select().from(vehiclesTable)
        .where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.isActive, true)));

      for (const v of orgVehicles) {
        if (v.currentKm && v.lastMaintenanceKm) {
          const kmSinceMaint = v.currentKm - v.lastMaintenanceKm;
          if (kmSinceMaint > 15000) {
            const [alert] = await db.insert(predictiveAlerts).values({
              organizationId: orgId,
              alertType: "maintenance",
              severity: kmSinceMaint > 25000 ? "high" : "medium",
              title: `Manutenzione necessaria: ${v.code}`,
              description: `Il veicolo ${v.code} ha percorso ${kmSinceMaint.toLocaleString("it-IT")} km dall'ultima manutenzione. Si consiglia un tagliando.`,
              confidence: 85,
              relatedEntityType: "vehicle",
              relatedEntityId: v.id,
              suggestedAction: "Pianificare tagliando presso officina convenzionata",
            }).returning();
            generatedAlerts.push(alert);
          }
        }
      }

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

      const expiringDocs = await db.select().from(vehicleDocuments)
        .where(and(
          eq(vehicleDocuments.isActive, true),
          gte(vehicleDocuments.expiryDate, today),
          lte(vehicleDocuments.expiryDate, thirtyDaysStr)
        ));

      const orgVehicleIds = new Set(orgVehicles.map(v => v.id));
      for (const doc of expiringDocs) {
        if (!orgVehicleIds.has(doc.vehicleId)) continue;
        const daysUntilExpiry = Math.ceil((new Date(doc.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const [alert] = await db.insert(predictiveAlerts).values({
          organizationId: orgId,
          alertType: "document_expiry",
          severity: daysUntilExpiry <= 7 ? "high" : daysUntilExpiry <= 14 ? "medium" : "low",
          title: `Documento in scadenza: ${doc.documentLabel}`,
          description: `Il documento "${doc.documentLabel}" del veicolo ${doc.vehicleCode} scade tra ${daysUntilExpiry} giorni (${doc.expiryDate}).`,
          predictedDate: new Date(doc.expiryDate!),
          confidence: 100,
          relatedEntityType: "vehicle_document",
          relatedEntityId: doc.id,
          suggestedAction: "Rinnovare il documento prima della scadenza",
        }).returning();
        generatedAlerts.push(alert);
      }

      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const fourWeeksStr = fourWeeksAgo.toISOString().split("T")[0];

      const [staffWorkload] = await db.select({
        totalTrips: sql<number>`COUNT(*)::int`,
        uniqueStaff: sql<number>`COUNT(DISTINCT ${trips.userId})::int`,
      }).from(trips).where(and(eq(trips.organizationId, orgId), gte(trips.serviceDate, fourWeeksStr)));

      const totalTrips4w = staffWorkload?.totalTrips || 0;
      const uniqueStaff = staffWorkload?.uniqueStaff || 1;
      const tripsPerPerson = totalTrips4w / uniqueStaff;

      if (tripsPerPerson > 40) {
        const [alert] = await db.insert(predictiveAlerts).values({
          organizationId: orgId,
          alertType: "staff_shortage",
          severity: tripsPerPerson > 60 ? "high" : "medium",
          title: "Sovraccarico personale rilevato",
          description: `Media di ${Math.round(tripsPerPerson)} servizi per operatore nelle ultime 4 settimane. Il carico di lavoro è elevato.`,
          confidence: 75,
          suggestedAction: "Valutare il reclutamento di personale aggiuntivo o la redistribuzione dei turni",
        }).returning();
        generatedAlerts.push(alert);
      }

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsStr = threeMonthsAgo.toISOString().split("T")[0];
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const oneMonthStr = oneMonthAgo.toISOString().split("T")[0];

      const [avgMonthlyTrips] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(trips).where(and(eq(trips.organizationId, orgId), gte(trips.serviceDate, threeMonthsStr), lte(trips.serviceDate, oneMonthStr)));

      const [recentMonthTrips] = await db.select({
        count: sql<number>`COUNT(*)::int`,
        totalKm: sql<number>`COALESCE(SUM(${trips.kmTraveled}), 0)::real`,
      }).from(trips).where(and(eq(trips.organizationId, orgId), gte(trips.serviceDate, oneMonthStr)));

      const avgMonthly = ((avgMonthlyTrips?.count || 0) / 2);
      const recentCount = recentMonthTrips?.count || 0;

      if (avgMonthly > 0 && recentCount > avgMonthly * 1.2) {
        const increasePercent = Math.round(((recentCount - avgMonthly) / avgMonthly) * 100);
        const [alert] = await db.insert(predictiveAlerts).values({
          organizationId: orgId,
          alertType: "cost_anomaly",
          severity: increasePercent > 50 ? "high" : "medium",
          title: "Anomalia costi operativi",
          description: `I servizi dell'ultimo mese (${recentCount}) superano la media trimestrale (${Math.round(avgMonthly)}) del ${increasePercent}%. Verificare i costi associati.`,
          confidence: 70,
          suggestedAction: "Analizzare le cause dell'aumento e verificare la sostenibilità dei costi",
        }).returning();
        generatedAlerts.push(alert);
      }

      res.json(generatedAlerts);
    } catch (error) {
      console.error("Error generating predictive alerts:", error);
      res.status(500).json({ error: "Errore nella generazione degli alert" });
    }
  });

  // ============================================================================
  // BENCHMARKS
  // ============================================================================

  app.get("/api/benchmarks", requireAuth, async (req, res) => {
    try {
      const result = await db.select().from(benchmarks).orderBy(desc(benchmarks.createdAt)).limit(50);
      res.json(result);
    } catch (error) {
      console.error("Error fetching benchmarks:", error);
      res.status(500).json({ error: "Errore nel recupero dei benchmark" });
    }
  });

  app.post("/api/benchmarks/calculate", requireSuperAdmin, async (req, res) => {
    try {
      const allOrgs = await db.select().from(organizations).where(eq(organizations.status, "active"));
      const today = new Date().toISOString().split("T")[0];
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const dateStr = twelveMonthsAgo.toISOString().split("T")[0];

      const orgMetrics: { orgId: string; trips: number; km: number; vehicles: number; staff: number; tripsPerVehicle: number; kmPerTrip: number }[] = [];

      for (const org of allOrgs) {
        const [tripData] = await db.select({
          count: sql<number>`COUNT(*)::int`,
          totalKm: sql<number>`COALESCE(SUM(${trips.kmTraveled}), 0)::real`,
        }).from(trips).where(and(eq(trips.organizationId, org.id), gte(trips.serviceDate, dateStr)));

        const [vehicleData] = await db.select({
          count: sql<number>`COUNT(*)::int`,
        }).from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, org.id), eq(vehiclesTable.isActive, true)));

        const [staffData] = await db.select({
          count: sql<number>`COUNT(*)::int`,
        }).from(staffMembers).where(eq(staffMembers.organizationId, org.id));

        const tripCount = tripData?.count || 0;
        const totalKm = tripData?.totalKm || 0;
        const vehicleCount = vehicleData?.count || 0;
        const staffCount = staffData?.count || 0;

        orgMetrics.push({
          orgId: org.id,
          trips: tripCount,
          km: totalKm,
          vehicles: vehicleCount,
          staff: staffCount,
          tripsPerVehicle: vehicleCount > 0 ? tripCount / vehicleCount : 0,
          kmPerTrip: tripCount > 0 ? totalKm / tripCount : 0,
        });
      }

      const metricTypes = [
        { type: "trips_per_year", values: orgMetrics.map(m => m.trips) },
        { type: "km_per_year", values: orgMetrics.map(m => m.km) },
        { type: "fleet_size", values: orgMetrics.map(m => m.vehicles) },
        { type: "staff_count", values: orgMetrics.map(m => m.staff) },
        { type: "trips_per_vehicle", values: orgMetrics.map(m => m.tripsPerVehicle) },
        { type: "km_per_trip", values: orgMetrics.map(m => m.kmPerTrip) },
      ];

      const createdBenchmarks = [];

      for (const mt of metricTypes) {
        const sorted = [...mt.values].sort((a, b) => a - b);
        const n = sorted.length;
        if (n === 0) continue;

        const avg = sorted.reduce((a, b) => a + b, 0) / n;
        const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
        const p25 = sorted[Math.floor(n * 0.25)] || 0;
        const p75 = sorted[Math.floor(n * 0.75)] || 0;

        const [bm] = await db.insert(benchmarks).values({
          metricDate: today,
          metricType: mt.type,
          avgValue: Math.round(avg * 100) / 100,
          medianValue: Math.round(median * 100) / 100,
          p25Value: Math.round(p25 * 100) / 100,
          p75Value: Math.round(p75 * 100) / 100,
          minValue: Math.round(sorted[0] * 100) / 100,
          maxValue: Math.round(sorted[n - 1] * 100) / 100,
          sampleSize: n,
        }).returning();
        createdBenchmarks.push(bm);
      }

      res.json(createdBenchmarks);
    } catch (error) {
      console.error("Error calculating benchmarks:", error);
      res.status(500).json({ error: "Errore nel calcolo dei benchmark" });
    }
  });

  app.get("/api/benchmarks/my-position", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const dateStr = twelveMonthsAgo.toISOString().split("T")[0];

      const [tripData] = await db.select({
        count: sql<number>`COUNT(*)::int`,
        totalKm: sql<number>`COALESCE(SUM(${trips.kmTraveled}), 0)::real`,
      }).from(trips).where(and(eq(trips.organizationId, orgId), gte(trips.serviceDate, dateStr)));

      const [vehicleData] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(vehiclesTable).where(and(eq(vehiclesTable.organizationId, orgId), eq(vehiclesTable.isActive, true)));

      const tripCount = tripData?.count || 0;
      const totalKm = tripData?.totalKm || 0;
      const vehicleCount = vehicleData?.count || 0;

      const latestBenchmarks = await db.select().from(benchmarks).orderBy(desc(benchmarks.createdAt)).limit(10);

      const benchmarkMap: Record<string, any> = {};
      for (const bm of latestBenchmarks) {
        if (!benchmarkMap[bm.metricType]) {
          benchmarkMap[bm.metricType] = bm;
        }
      }

      const getPosition = (value: number, bm: any) => {
        if (!bm) return "non_disponibile";
        if (value >= (bm.p75Value || 0)) return "top_25";
        if (value >= (bm.medianValue || 0)) return "above_median";
        if (value >= (bm.p25Value || 0)) return "below_median";
        return "bottom_25";
      };

      res.json({
        orgId,
        metrics: {
          trips_per_year: {
            value: tripCount,
            position: getPosition(tripCount, benchmarkMap["trips_per_year"]),
            benchmark: benchmarkMap["trips_per_year"] || null,
          },
          km_per_year: {
            value: totalKm,
            position: getPosition(totalKm, benchmarkMap["km_per_year"]),
            benchmark: benchmarkMap["km_per_year"] || null,
          },
          fleet_size: {
            value: vehicleCount,
            position: getPosition(vehicleCount, benchmarkMap["fleet_size"]),
            benchmark: benchmarkMap["fleet_size"] || null,
          },
          trips_per_vehicle: {
            value: vehicleCount > 0 ? Math.round(tripCount / vehicleCount) : 0,
            position: getPosition(vehicleCount > 0 ? tripCount / vehicleCount : 0, benchmarkMap["trips_per_vehicle"]),
            benchmark: benchmarkMap["trips_per_vehicle"] || null,
          },
          km_per_trip: {
            value: tripCount > 0 ? Math.round(totalKm / tripCount) : 0,
            position: getPosition(tripCount > 0 ? totalKm / tripCount : 0, benchmarkMap["km_per_trip"]),
            benchmark: benchmarkMap["km_per_trip"] || null,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching benchmark position:", error);
      res.status(500).json({ error: "Errore nel recupero della posizione benchmark" });
    }
  });
}
