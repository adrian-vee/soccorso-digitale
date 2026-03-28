/**
 * Booking Routes — Scheduled Services & Mobile endpoints
 *
 * Covers:
 * - CRUD for scheduled services
 * - PDF upload / import for scheduled services
 * - Mobile today, start/complete/suspend/cancel/wait/resume
 * - Empty-trip start/complete
 * - Mobile extra-service creation
 */

import type { Express } from "express";
import multer from "multer";
import { db } from "../db";
import { storage } from "../storage";
import {
  scheduledServices,
  vehicles,
  trips,
  structureDepartments,
  departments as departmentsTable,
  pdfTemplates,
} from "@shared/schema";
import { and, eq, asc, desc, inArray } from "drizzle-orm";
import {
  requireAuth,
  requireAdmin,
  getUserId,
  getEffectiveOrgId,
} from "../auth-middleware";
import { parseSampleTable, applyTemplateMapping, type TemplateConfig } from "../pdf-table-parser";

export function registerBookingRoutes(app: Express) {
  // ============================================
  // SCHEDULED SERVICES CRUD
  // ============================================

  // Get all scheduled services (with optional filters)
  app.get("/api/scheduled-services", requireAuth, async (req, res) => {
    try {
      const { vehicleId, locationId, date } = req.query;
      const orgId = getEffectiveOrgId(req);

      // Build conditions — always filter by org when available
      const conditions: ReturnType<typeof eq>[] = [];
      if (orgId) conditions.push(eq(scheduledServices.organizationId, orgId));
      if (vehicleId) conditions.push(eq(scheduledServices.vehicleId, vehicleId as string));
      if (locationId) conditions.push(eq(scheduledServices.locationId, locationId as string));
      if (date) conditions.push(eq(scheduledServices.serviceDate, date as string));

      const services = await db
        .select()
        .from(scheduledServices)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(scheduledServices.serviceDate), scheduledServices.scheduledTime);

      const vehicleIds = [...new Set(services.filter((s: any) => s.vehicleId).map((s: any) => s.vehicleId))];
      let vehicleMap: Record<string, { code: string; natoName: string | null; licensePlate: string | null }> = {};
      if (vehicleIds.length > 0) {
        const vRows = await db.select({
          id: vehicles.id,
          code: vehicles.code,
          natoName: vehicles.natoName,
          licensePlate: vehicles.licensePlate
        }).from(vehicles).where(inArray(vehicles.id, vehicleIds as string[]));
        for (const v of vRows) {
          vehicleMap[v.id] = { code: v.code, natoName: v.natoName, licensePlate: v.licensePlate };
        }
      }

      const enriched = services.map((s: any) => {
        const v = s.vehicleId ? vehicleMap[s.vehicleId] : null;
        let vehicleLabel = null;
        if (v) {
          const parts: string[] = [];
          if (v.code) parts.push(v.code);
          if (v.natoName) parts.push(`(${v.natoName})`);
          if (v.licensePlate) parts.push(`- ${v.licensePlate}`);
          vehicleLabel = parts.join(' ') || s.vehicleId;
        }
        return { ...s, vehicleLabel };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching scheduled services:", error);
      res.status(500).json({ error: "Errore nel caricamento dei servizi programmati" });
    }
  });

  // Get single scheduled service
  app.get("/api/scheduled-services/:id", requireAuth, async (req, res) => {
    try {
      const service = await storage.getScheduledService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Servizio non trovato" });
      }
      res.json({ ...service, hasPatient: !!service.patientName });
    } catch (error) {
      console.error("Error fetching scheduled service:", error);
      res.status(500).json({ error: "Errore nel caricamento del servizio" });
    }
  });

  // Create scheduled service
  app.post("/api/scheduled-services", requireAdmin, async (req, res) => {
    try {
      const service = await storage.createScheduledService(req.body);
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating scheduled service:", error);
      res.status(500).json({ error: "Errore nella creazione del servizio" });
    }
  });

  // Bulk create scheduled services
  app.post("/api/scheduled-services/bulk", requireAdmin, async (req, res) => {
    try {
      const { services } = req.body;
      if (!Array.isArray(services)) {
        return res.status(400).json({ error: "Array di servizi richiesto" });
      }
      const created = await storage.createScheduledServices(services);
      res.status(201).json({ created: created.length, services: created });
    } catch (error) {
      console.error("Error bulk creating scheduled services:", error);
      res.status(500).json({ error: "Errore nella creazione dei servizi" });
    }
  });

  // Update scheduled service
  app.put("/api/scheduled-services/:id", requireAdmin, async (req, res) => {
    try {
      const service = await storage.updateScheduledService(req.params.id, req.body);
      if (!service) {
        return res.status(404).json({ error: "Servizio non trovato" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating scheduled service:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del servizio" });
    }
  });

  // Update service status
  app.patch("/api/scheduled-services/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'waiting_for_visit', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Stato non valido" });
      }
      const service = await storage.updateScheduledService(req.params.id, { status });
      if (!service) {
        return res.status(404).json({ error: "Servizio non trovato" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating service status:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dello stato" });
    }
  });

  // Delete scheduled service
  app.delete("/api/scheduled-services/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteScheduledService(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Servizio non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting scheduled service:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del servizio" });
    }
  });

  // Delete all services for a vehicle on a specific date (for re-import)
  app.delete("/api/scheduled-services/vehicle/:vehicleId/date/:date", requireAdmin, async (req, res) => {
    try {
      const { vehicleId, date } = req.params;
      const deleted = await storage.deleteScheduledServicesByVehicleAndDate(vehicleId, date);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error deleting scheduled services:", error);
      res.status(500).json({ error: "Errore nell'eliminazione dei servizi" });
    }
  });

  // ============================================
  // PDF UPLOAD & IMPORT
  // ============================================

  // Upload and parse PDF for scheduled services
  const scheduledPdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/scheduled-services/upload-pdf", requireAdmin, scheduledPdfUpload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nessun file PDF caricato" });
      }

      const orgId = getEffectiveOrgId(req);

      // ── Template-based parsing (multi-org) ──────────────────────────────────
      if (orgId) {
        const [activeTpl] = await db.select().from(pdfTemplates)
          .where(and(eq(pdfTemplates.organizationId, orgId), eq(pdfTemplates.isActive, true)))
          .limit(1);

        if (activeTpl) {
          const config = activeTpl.columnMapping as TemplateConfig;
          if (config?.mappings && config.mappings.length > 0) {
            const { headers, rows, totalRows, rawText } = await parseSampleTable(req.file.buffer);
            const skipHeader = activeTpl.skipHeaderRows ?? 1;
            const dataRows = rows.slice(skipHeader);
            const parsedRows = applyTemplateMapping(dataRows, config, {
              skipFooterRows: activeTpl.skipFooterRows ?? 0,
            });

            return res.json({
              success: true,
              source: "template",
              templateId: activeTpl.id,
              templateName: activeTpl.name,
              vehicleName: null,
              serviceDate: null,
              serviceCount: parsedRows.length,
              services: parsedRows,
              rawText,
              pageCount: 1,
              fileName: req.file.originalname,
              headers,
              totalRows,
            });
          }
        }

        // Org exists but has no configured template → block and ask to configure
        return res.status(422).json({
          success: false,
          error: "NO_TEMPLATE",
          message: "Non hai ancora configurato il template PDF per la tua organizzazione. Vai in Impostazioni → Template Import PDF per configurare la mappatura delle colonne del tuo PDF.",
        });
      }

      // ── Legacy hardcoded parser (Croce Europa only — superadmin/no-org) ──────
      const { parsePdfServices } = await import("../pdf-service-parser");
      const result = await parsePdfServices(req.file.buffer);

      const allStructures = await storage.getStructures();
      const allDepartments = await db.select().from(departmentsTable);
      const structureDeptRows = await db.select().from(structureDepartments);

      const structureAbbreviations: Record<string, string[]> = {
        'h': ['ospedale', 'hospital'],
        'osp': ['ospedale'],
        'p.o.': ['presidio ospedaliero'],
        'po': ['presidio ospedaliero'],
        'rsa': ['residenza sanitaria assistenziale', 'casa di riposo'],
        'cdr': ['casa di riposo'],
        'pol': ['poliambulatorio', 'policlinico'],
        'cl': ['clinica'],
        'amb': ['ambulatorio'],
        'cs': ['casa di cura', 'centro salute'],
      };

      function matchStructure(rawName: string | null) {
        if (!rawName) return { structureId: null, structureName: null, departmentName: null };
        const name = rawName.trim();
        const nameLower = name.toLowerCase();

        for (const s of allStructures) {
          if (s.name.toLowerCase() === nameLower) {
            return { structureId: s.id, structureName: s.name, departmentName: null };
          }
        }

        let expandedName = name;
        for (const [abbr, expansions] of Object.entries(structureAbbreviations)) {
          const abbrRegex = new RegExp(`^${abbr.replace('.', '\\.')}\\s+`, 'i');
          if (abbrRegex.test(name)) {
            const rest = name.replace(abbrRegex, '').trim();
            for (const exp of expansions) {
              const candidate = `${exp} ${rest}`;
              for (const s of allStructures) {
                if (s.name.toLowerCase().includes(rest.toLowerCase()) ||
                    s.name.toLowerCase().includes(candidate.toLowerCase())) {
                  return { structureId: s.id, structureName: s.name, departmentName: null };
                }
              }
            }
            expandedName = `${expansions[0]} ${rest}`;
            break;
          }
        }

        const words = nameLower.split(/\s+/).filter(w => w.length > 2);
        let bestMatch: typeof allStructures[0] | null = null;
        let bestScore = 0;
        for (const s of allStructures) {
          const sLower = s.name.toLowerCase();
          let score = 0;
          for (const w of words) {
            if (sLower.includes(w)) score++;
          }
          const ratio = words.length > 0 ? score / words.length : 0;
          if (ratio > 0.5 && score > bestScore) {
            bestScore = score;
            bestMatch = s;
          }
        }
        if (bestMatch) {
          return { structureId: bestMatch.id, structureName: bestMatch.name, departmentName: null };
        }

        return { structureId: null, structureName: null, departmentName: null };
      }

      function extractDepartment(rawName: string | null) {
        if (!rawName) return null;
        const deptPatterns = [
          /(?:reparto|rep\.|u\.o\.|uo|unita operativa)\s*[:\-]?\s*(.+)/i,
          /\-\s*(.+)$/,
        ];
        for (const p of deptPatterns) {
          const m = rawName.match(p);
          if (m) return m[1].trim();
        }
        return null;
      }

      const enrichedServices = result.services.map((s, idx, arr) => {
        const enriched: any = { ...s };

        const originDept = extractDepartment(s.originName);
        const destDept = extractDepartment(s.destinationName);
        const cleanOriginName = originDept ? s.originName!.replace(/[\-]\s*[^-]+$/, '').trim() : s.originName;
        const cleanDestName = destDept ? s.destinationName!.replace(/[\-]\s*[^-]+$/, '').trim() : s.destinationName;

        const originMatch = matchStructure(cleanOriginName);
        const destMatch = matchStructure(cleanDestName);

        if (originMatch.structureId) {
          enriched.originStructureId = originMatch.structureId;
          enriched.originName = originMatch.structureName;
        }
        if (destMatch.structureId) {
          enriched.destinationStructureId = destMatch.structureId;
          enriched.destinationName = destMatch.structureName;
        }
        if (originDept) enriched.originDepartment = originDept;
        if (destDept) enriched.destinationDepartment = destDept;

        if (!s.patientName && idx > 0) {
          const prev = arr[idx - 1];
          if (prev.destinationName) {
            enriched.originName = enriched.originName || prev.destinationName;
            enriched.originAddress = enriched.originAddress || prev.destinationAddress;
            enriched.originCity = enriched.originCity || prev.destinationCity;
            enriched.originProvince = enriched.originProvince || prev.destinationProvince;
          }
        }

        const stLower = (s.serviceType || '').toLowerCase();
        if (stLower.includes('dimissione') || stLower.includes('dimissioni')) {
          enriched.serviceCategory = 'dimissione';
        } else if (stLower.includes('visita') || stLower.includes('day hospital') || stLower.includes('day-hospital') || stLower.includes('prestazione')) {
          enriched.serviceCategory = 'visita';
        } else if (stLower.includes('trasferimento') || stLower.includes('interospedaliero')) {
          enriched.serviceCategory = 'trasferimento';
        } else if (stLower.includes('dialisi')) {
          enriched.serviceCategory = 'dialisi';
        } else {
          enriched.serviceCategory = 'trasporto';
        }

        return enriched;
      });

      res.json({
        success: true,
        vehicleName: result.vehicleName,
        serviceDate: result.serviceDate,
        serviceCount: enrichedServices.length,
        services: enrichedServices,
        rawText: result.rawText,
        pageCount: result.pageCount,
        fileName: req.file.originalname,
      });
    } catch (error) {
      console.error("Error parsing PDF:", error);
      res.status(500).json({ error: "Errore nel parsing del PDF" });
    }
  });

  app.post("/api/scheduled-services/import-pdf", requireAdmin, async (req, res) => {
    try {
      const { services, vehicleId, locationId, organizationId, serviceDate, sourcePdfName } = req.body;

      if (!services || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ error: "Nessun servizio da importare" });
      }

      const targetDate = serviceDate || services[0]?.serviceDate;
      const conditions = [eq(scheduledServices.serviceDate, targetDate)];
      if (organizationId) conditions.push(eq(scheduledServices.organizationId, organizationId));

      const existingServices = targetDate
        ? await db.select({
            progressiveCode: scheduledServices.progressiveCode,
            scheduledTime: scheduledServices.scheduledTime,
            serviceType: scheduledServices.serviceType
          })
            .from(scheduledServices)
            .where(and(...conditions))
        : [];

      const existingKeys = new Set(
        existingServices.map(s => `${s.progressiveCode || ''}_${s.scheduledTime || ''}_${s.serviceType || ''}`)
      );

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const toInsert = services
        .filter((s: any) => {
          const key = `${s.progressiveCode || ''}_${s.scheduledTime || ''}_${s.serviceType || ''}`;
          return !existingKeys.has(key);
        })
        .map((s: any) => ({
          organizationId: organizationId || null,
          vehicleId: vehicleId || null,
          locationId: locationId || null,
          serviceDate: serviceDate || s.serviceDate,
          progressiveCode: s.progressiveCode || null,
          scheduledTime: s.scheduledTime || null,
          serviceType: s.serviceType || null,
          patientName: s.patientName || null,
          patientNameExpiresAt: s.patientName ? expiresAt : null,
          patientCondition: s.patientCondition || null,
          patientWeight: s.patientWeight || null,
          patientPhone: s.patientPhone || null,
          patientNotes: s.patientNotes || null,
          originName: s.originName || null,
          originAddress: s.originAddress || null,
          originCity: s.originCity || null,
          originProvince: s.originProvince || null,
          originFloor: s.originFloor || null,
          destinationName: s.destinationName || null,
          destinationAddress: s.destinationAddress || null,
          destinationCity: s.destinationCity || null,
          destinationProvince: s.destinationProvince || null,
          destinationFloor: s.destinationFloor || null,
          estimatedKm: s.estimatedKm || null,
          precautions: s.precautions || null,
          transportMode: s.transportMode || null,
          notes: s.notes || null,
          additionalPersonnel: s.additionalPersonnel || null,
          sourcePdfName: sourcePdfName || null,
          importSource: "pdf_upload",
          status: "scheduled",
        }));

      if (toInsert.length === 0) {
        const skipped = services.length;
        return res.json({ success: true, imported: 0, skipped, message: `Tutti i ${skipped} servizi esistono gia per questa data` });
      }

      const created = await storage.createScheduledServices(toInsert);
      const skipped = services.length - toInsert.length;

      // Auto-calculate km for services that don't have km but have origin+destination
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (googleApiKey) {
        for (const svc of created) {
          if (!svc.estimatedKm && svc.originName && svc.destinationName) {
            try {
              const originStr = [svc.originAddress, svc.originCity, svc.originProvince].filter(Boolean).join(', ') || svc.originName;
              const destStr = [svc.destinationAddress, svc.destinationCity, svc.destinationProvince].filter(Boolean).join(', ') || svc.destinationName;
              const gUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&mode=driving&language=it&key=${googleApiKey}`;
              const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(5000) });
              const gData = await gRes.json() as any;
              if (gData.status === 'OK' && gData.routes?.[0]?.legs?.[0]) {
                let km = Math.round(gData.routes[0].legs[0].distance.value / 1000);
                const stLower = (svc.serviceType || '').toLowerCase();
                if (stLower.includes('visita') || stLower.includes('day hospital') || stLower.includes('prestazione')) {
                  km = km * 2;
                }
                await db.update(scheduledServices).set({ estimatedKm: km }).where(eq(scheduledServices.id, svc.id));
              }
            } catch (e) { /* skip km calc on error */ }
          }
        }
      }

      res.json({ success: true, imported: created.length, skipped, services: created });
    } catch (error) {
      console.error("Error importing PDF services:", error);
      res.status(500).json({ error: "Errore nell'importazione dei servizi" });
    }
  });

  // ============================================
  // MOBILE SCHEDULED SERVICES APIs
  // ============================================

  app.get("/api/mobile/today", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Non autenticato" });

      const user = await storage.getUser(userId);
      const vehicleId = user?.vehicleId;
      if (!vehicleId) {
        return res.status(400).json({ error: "Nessun mezzo associato a questo account" });
      }

      const today = new Date().toISOString().split("T")[0];
      const services = await db.select()
        .from(scheduledServices)
        .where(and(
          eq(scheduledServices.vehicleId, vehicleId),
          eq(scheduledServices.serviceDate, today),
        ))
        .orderBy(asc(scheduledServices.scheduledTime));

      const enrichService = (s: any) => {
        return { ...s, hasPatient: !!s.patientName };
      };

      const mainServices = services.filter(s => !s.isEmptyTrip);
      const emptyTrips = services.filter(s => s.isEmptyTrip);

      const result: any[] = [];
      for (let i = 0; i < mainServices.length; i++) {
        result.push({ type: "service", data: enrichService(mainServices[i]) });
      }

      emptyTrips.forEach(et => {
        result.push({ type: "empty_trip", data: enrichService(et) });
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching today's services:", error);
      res.status(500).json({ error: "Errore nel recupero dei servizi del giorno" });
    }
  });

  app.patch("/api/mobile/scheduled-services/:id/start", requireAuth, async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const userId = getUserId(req);
      let currentVehicleKm: number | null = null;
      if (userId) {
        const u = await storage.getUser(userId);
        if (u?.vehicleId) {
          const [v] = await db.select({ currentKm: vehicles.currentKm }).from(vehicles).where(eq(vehicles.id, u.vehicleId));
          if (v) currentVehicleKm = v.currentKm;
        }
      }
      const updated = await db.update(scheduledServices)
        .set({
          status: "in_progress",
          actualStartTime: new Date(),
          ...(lat != null ? { startGpsLat: String(lat) } : {}),
          ...(lng != null ? { startGpsLng: String(lng) } : {}),
          ...(currentVehicleKm != null ? { kmStart: currentVehicleKm } : {}),
        })
        .where(eq(scheduledServices.id, req.params.id))
        .returning();

      if (updated.length === 0) return res.status(404).json({ error: "Servizio non trovato" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error starting service:", error);
      res.status(500).json({ error: "Errore nell'avvio del servizio" });
    }
  });

  app.patch("/api/mobile/scheduled-services/:id/complete", requireAuth, async (req, res) => {
    try {
      const { kmEnd, lat, lng, notes: completionNotes } = req.body;
      const now = new Date();
      const updated = await db.update(scheduledServices)
        .set({
          status: "completed",
          actualEndTime: now,
          ...(kmEnd != null ? { kmEnd: parseInt(String(kmEnd)) } : {}),
          ...(lat != null ? { endGpsLat: String(lat) } : {}),
          ...(lng != null ? { endGpsLng: String(lng) } : {}),
          ...(completionNotes ? { notes: completionNotes } : {}),
        })
        .where(eq(scheduledServices.id, req.params.id))
        .returning();

      if (updated.length === 0) return res.status(404).json({ error: "Servizio non trovato" });

      const svc = updated[0];
      try {
        const startTime = svc.actualStartTime ? new Date(svc.actualStartTime) : now;
        const endTime = now;
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        const kmStart = svc.kmStart ?? 0;
        const kmFinal = kmEnd != null ? parseInt(String(kmEnd)) : kmStart;
        const kmTraveled = Math.max(0, kmFinal - kmStart);

        const departureTime = startTime.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        const returnTime = endTime.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

        const userId = getUserId(req);
        if (svc.vehicleId && userId) {
          await db.insert(trips).values({
            progressiveNumber: svc.progressiveCode || `SVC-${svc.id.substring(0, 8)}`,
            vehicleId: svc.vehicleId,
            userId,
            organizationId: svc.organizationId,
            serviceDate: svc.serviceDate,
            departureTime,
            returnTime,
            scheduledDepartureTime: svc.scheduledTime ? svc.scheduledTime + ":00" : null,
            patientGender: svc.gender || null,
            originType: "altro",
            originAddress: [svc.originName, svc.originAddress, svc.originCity].filter(Boolean).join(", "),
            destinationType: "altro",
            destinationAddress: [svc.destinationName, svc.destinationAddress, svc.destinationCity].filter(Boolean).join(", "),
            kmInitial: kmStart,
            kmFinal,
            kmTraveled,
            durationMinutes,
            serviceType: svc.serviceType || null,
            isReturnTrip: svc.isEmptyTrip || false,
            notes: svc.notes || completionNotes || null,
          });
        }

        if (kmEnd != null && svc.vehicleId) {
          await db.update(vehicles)
            .set({ currentKm: parseInt(String(kmEnd)) })
            .where(eq(vehicles.id, svc.vehicleId));
        }
      } catch (tripError) {
        console.error("Error creating trip from scheduled service:", tripError);
      }

      res.json(svc);
    } catch (error) {
      console.error("Error completing service:", error);
      res.status(500).json({ error: "Errore nella chiusura del servizio" });
    }
  });

  app.patch("/api/mobile/scheduled-services/:id/suspend", requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: "Motivo sospensione obbligatorio" });

      const updated = await db.update(scheduledServices)
        .set({ status: "suspended", suspendReason: reason })
        .where(eq(scheduledServices.id, req.params.id))
        .returning();

      if (updated.length === 0) return res.status(404).json({ error: "Servizio non trovato" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error suspending service:", error);
      res.status(500).json({ error: "Errore nella sospensione del servizio" });
    }
  });

  app.patch("/api/mobile/scheduled-services/:id/cancel", requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: "Motivo annullamento obbligatorio" });

      const updated = await db.update(scheduledServices)
        .set({ status: "cancelled", cancelReason: reason })
        .where(eq(scheduledServices.id, req.params.id))
        .returning();

      if (updated.length === 0) return res.status(404).json({ error: "Servizio non trovato" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error cancelling service:", error);
      res.status(500).json({ error: "Errore nell'annullamento del servizio" });
    }
  });

  app.patch("/api/mobile/scheduled-services/:id/wait", requireAuth, async (req, res) => {
    try {
      const updated = await db.update(scheduledServices)
        .set({ status: "waiting_for_visit" })
        .where(eq(scheduledServices.id, req.params.id))
        .returning();

      if (updated.length === 0) return res.status(404).json({ error: "Servizio non trovato" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error setting wait status:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.patch("/api/mobile/scheduled-services/:id/resume", requireAuth, async (req, res) => {
    try {
      const updated = await db.update(scheduledServices)
        .set({ status: "in_progress" })
        .where(eq(scheduledServices.id, req.params.id))
        .returning();

      if (updated.length === 0) return res.status(404).json({ error: "Servizio non trovato" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error resuming service:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.post("/api/mobile/empty-trip/start", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Non autenticato" });

      const user = await storage.getUser(userId);
      const vehicleId = user?.vehicleId;
      if (!vehicleId) return res.status(400).json({ error: "Nessun mezzo associato" });

      const { originName, originAddress, originCity, destinationName, destinationAddress, destinationCity } = req.body;
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();

      const [row] = await db.insert(scheduledServices).values({
        organizationId: user.organizationId || null,
        vehicleId,
        serviceDate: today,
        scheduledTime: now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        serviceType: "Trasferimento a vuoto",
        isEmptyTrip: true,
        originName: originName || null,
        originAddress: originAddress || null,
        originCity: originCity || null,
        destinationName: destinationName || null,
        destinationAddress: destinationAddress || null,
        destinationCity: destinationCity || null,
        status: "in_progress",
        actualStartTime: now,
        importSource: "auto_empty",
      }).returning();

      res.json(row);
    } catch (error) {
      console.error("Error starting empty trip:", error);
      res.status(500).json({ error: "Errore nell'avvio del viaggio a vuoto" });
    }
  });

  app.patch("/api/mobile/empty-trip/:id/complete", requireAuth, async (req, res) => {
    try {
      const { kmEnd } = req.body;
      const updated = await db.update(scheduledServices)
        .set({
          status: "completed",
          actualEndTime: new Date(),
          ...(kmEnd != null ? { kmEnd: parseInt(String(kmEnd)) } : {}),
        })
        .where(and(
          eq(scheduledServices.id, req.params.id),
          eq(scheduledServices.isEmptyTrip, true)
        ))
        .returning();

      if (updated.length === 0) return res.status(404).json({ error: "Viaggio a vuoto non trovato" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Error completing empty trip:", error);
      res.status(500).json({ error: "Errore nella chiusura del viaggio a vuoto" });
    }
  });

  app.post("/api/mobile/scheduled-services", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Non autenticato" });

      const user = await storage.getUser(userId);
      const vehicleId = user?.vehicleId;
      if (!vehicleId) return res.status(400).json({ error: "Nessun mezzo associato" });

      const {
        scheduledTime, serviceType, gender,
        originName, originAddress, originCity,
        destinationName, destinationAddress, destinationCity,
        notes, transportMode, patientName,
      } = req.body;

      const today = new Date().toISOString().split("T")[0];
      const now = new Date();

      const [row] = await db.insert(scheduledServices).values({
        organizationId: user.organizationId || null,
        vehicleId,
        serviceDate: today,
        scheduledTime: scheduledTime || now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        serviceType: serviceType || "Servizio extra",
        gender: gender || null,
        patientName: patientName || null,
        patientNameExpiresAt: patientName ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
        originName: originName || null,
        originAddress: originAddress || null,
        originCity: originCity || null,
        destinationName: destinationName || null,
        destinationAddress: destinationAddress || null,
        destinationCity: destinationCity || null,
        notes: notes || null,
        transportMode: transportMode || null,
        status: "scheduled",
        importSource: "manual",
      }).returning();

      res.json(row);
    } catch (error) {
      console.error("Error creating extra service:", error);
      res.status(500).json({ error: "Errore nella creazione del servizio extra" });
    }
  });
}
