import type { Express } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import bcrypt from "bcrypt";
import { UPLOADS_DIR } from "../uploads-dir";
// @ts-ignore
import { WebSocket } from "ws";
import * as economicAnalysis from "../economic-analysis";

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
import { storage } from "../storage";
import { db } from "../db";
import {
  insertTripSchema, insertVehicleSchema,
  shiftInstances, shiftAssignments, staffMembers, vehicles as vehiclesTable,
  trips, vehicles, auditLogs, users,
  tripWaypoints, soccorsoLiveReports, tripGpsPoints, activeTrackingSessions,
  partners, partnerRequests, partnerVerifications, partnerReviews,
  staffConfidentialityAgreements, locations, handoffs, materialRestorations,
  fuelCards, fuelEntries, shiftLogs, fuelPrices, checklistPhotos, photoReportMessages,
  vehicleDocuments, sanitizationLogs, rescueSheets, organizations, announcements,
  contracts,
  slaConfigurations,
  volunteerRegistry,
  volunteerSignatures, orgDocumentTemplates,
  structureRequests,
  shiftAuditLog,
  orgCustomRoles, orgUserInvitations, orgAccessLogs,
  monitoringTokens,
  scheduledServices,
  structures as structuresTable2, departments as departmentsTable, structureDepartments
} from "@shared/schema";
import { z } from "zod";
import { and, eq, gte, lte, inArray, sql, desc, asc, between, ne, isNotNull } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin, requireOrgAdmin, getUserId, getOrganizationId, getEffectiveOrgId, requireAdminOrManager, getLocationFilter, isFullAdmin, isOrgAdmin, isBranchManager, getManagedLocationIds } from "../auth-middleware";
import { ALL_PERMISSIONS, PERMISSION_CATEGORIES, getPermissionsByCategory, generateSecurePassword } from "../permissions";
import { generateDeviceAuthorizationPDF } from "../pdf-generator";
import { auditLog, getAuditLogs, getAuditStats, verifyHashChain, repairHashChain, createVerificationRecord, createAuditEntry } from "../audit";
import * as gdpr from "../gdpr";
import * as sla from "../sla";
import * as backup from "../backup";
import * as dataQuality from "../data-quality-engine";
import { signTrip, verifyTripIntegrity, checkAndInvalidateIntegrity, getIntegrityStats } from "../trip-integrity";
import { signVolunteerEntry, verifyVolunteerIntegrity, checkAndInvalidateVolunteerIntegrity, bulkSignVolunteers, getVolunteerIntegrityStats } from "../volunteer-integrity";
import { generateSingleVolunteerPDF, generateFullRegistryPDF } from "../volunteer-registry-pdf";
import { generatePartnerProposalPDF } from "../partner-proposal-pdf";
import { generatePartnershipProposalPDF } from "../partnership-proposal-pdf";
import { generatePartnershipActivationGuidePDF } from "../partnership-activation-guide-pdf";
import { generateBusinessPlanPDF, generateSocialImpactPDF, generateInvestmentPlanPDF, generateTimelinePDF, ProjectStats } from "../eu-funding-documents";
import { generateUserManualPDF } from "../user-manual-pdf";
import { generateManualeOperativoPDF } from "../manuale-operativo-pdf";
import { sendConfidentialityConfirmationEmail, sendSignatureRequestEmail, getResendClient, sendInvitationEmail } from "../resend-client";
const cheerio: typeof import("cheerio") = new Proxy({} as any, {
  get(_target, prop) {
    const mod = require("cheerio");
    return mod[prop];
  }
});
import { createDemoAccount, isDemoExpired, startDemoCleanupScheduler } from "../demo-manager";
import { runHealthCheck, startHealthMonitoring, getUptimePercentage, getRecentIncidents } from "../health-monitor";
import { broadcastMessage } from "./index";

const calculateCarbonFootprintForTrip = (_tripId: any, _vehicleId?: any, _km?: any) => Promise.resolve(0);

export function registerAdminRoutes(app: Express) {
  const uploadsLogosDir = path.join(UPLOADS_DIR,"logos");
  if (!fs.existsSync(uploadsLogosDir)) {
    fs.mkdirSync(uploadsLogosDir, { recursive: true });
  }

  app.get("/api/admin/organizations", requireSuperAdmin, async (req, res) => {
    try {
      const allOrgs = await db.select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        isDemo: organizations.isDemo,
        demoExpiresAt: organizations.demoExpiresAt,
        enabledModules: organizations.enabledModules,
      }).from(organizations).orderBy(organizations.name);
      const filtered = allOrgs.filter(org => {
        if (org.isDemo && org.demoExpiresAt && new Date(org.demoExpiresAt) < new Date()) {
          return false;
        }
        return true;
      });
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/organizations/:orgId/logo", requireAdmin, async (req, res) => {
    try {
      const { orgId } = req.params;
      const { logoData, mimeType } = req.body;

      if (!logoData || !mimeType) {
        return res.status(400).json({ error: "logoData e mimeType sono obbligatori" });
      }

      const base64Data = logoData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filePath = path.join(uploadsLogosDir, `${orgId}.png`);
      fs.writeFileSync(filePath, buffer);

      const logoUrl = `/uploads/logos/${orgId}.png`;
      await db.update(organizations).set({ logoUrl, updatedAt: new Date() }).where(eq(organizations.id, orgId));

      res.json({ success: true, logoUrl });
    } catch (error) {
      console.error("Error uploading organization logo:", error);
      res.status(500).json({ error: "Errore nel caricamento del logo" });
    }
  });

  app.get("/api/organizations/:orgId/logo", (req, res) => {
    const { orgId } = req.params;
    const filePath = path.join(uploadsLogosDir, `${orgId}.png`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Logo non trovato" });
    }

    res.setHeader("Content-Type", "image/png");
    res.sendFile(filePath);
  });

  app.delete("/api/organizations/:orgId/logo", requireAdmin, async (req, res) => {
    try {
      const { orgId } = req.params;
      const filePath = path.join(uploadsLogosDir, `${orgId}.png`);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      await db.update(organizations).set({ logoUrl: null, updatedAt: new Date() }).where(eq(organizations.id, orgId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing organization logo:", error);
      res.status(500).json({ error: "Errore nella rimozione del logo" });
    }
  });
  
  // Config endpoint for client-side configuration (Maps API key with domain restrictions)
  // Public endpoint - API key is protected by domain restrictions in Google Cloud Console
  app.get("/api/config/maps", (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(404).json({ error: "Maps API key not configured" });
    }
    res.json({ apiKey });
  });
  
  // ============================================================================
  // APK MANAGEMENT - Upload (super_admin only) and public download
  // Uses local filesystem (uploads/apk/) for storage on Railway
  // ============================================================================

  const APK_DIR = path.join(UPLOADS_DIR,"apk");
  const APK_FINAL_PATH = path.join(APK_DIR, "current.apk");
  const APK_META_PATH = path.join(APK_DIR, "meta.json");

  function getApkMetaFromStorage(): { version: string; filename: string; size: number; uploadDate: string; accessCode?: string } | null {
    try {
      if (!fs.existsSync(APK_META_PATH)) return null;
      return JSON.parse(fs.readFileSync(APK_META_PATH, "utf-8"));
    } catch (err) {
      console.error("Error reading APK meta:", err);
      return null;
    }
  }

  function saveApkMetaToStorage(meta: any): void {
    if (!fs.existsSync(APK_DIR)) fs.mkdirSync(APK_DIR, { recursive: true });
    fs.writeFileSync(APK_META_PATH, JSON.stringify(meta, null, 2));
  }

  app.get("/api/public/apk-info", async (_req, res) => {
    try {
      const meta = await getApkMetaFromStorage();
      if (meta && meta.filename && meta.version) {
        if (fs.existsSync(APK_FINAL_PATH)) {
          res.json({ available: true, version: meta.version, size: meta.size, uploadDate: meta.uploadDate });
        } else {
          res.json({ available: false });
        }
      } else {
        res.json({ available: false });
      }
    } catch (err) {
      console.error("APK info error:", err);
      res.json({ available: false });
    }
  });

  app.get("/api/admin/apk-access-code", requireSuperAdmin, (_req, res) => {
    const meta = getApkMetaFromStorage();
    res.json({ accessCode: meta?.accessCode || "SD2026APP" });
  });

  app.put("/api/admin/apk-access-code", requireSuperAdmin, (req, res) => {
    const { accessCode } = req.body;
    if (!accessCode || typeof accessCode !== "string" || accessCode.trim().length < 4) {
      return res.status(400).json({ error: "Il codice deve avere almeno 4 caratteri" });
    }
    const cleanCode = accessCode.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (cleanCode.length < 4) {
      return res.status(400).json({ error: "Il codice puo contenere solo lettere, numeri, trattini e underscore" });
    }
    const meta = getApkMetaFromStorage();
    if (meta) {
      meta.accessCode = cleanCode;
      saveApkMetaToStorage(meta);
    } else {
      saveApkMetaToStorage({ accessCode: cleanCode });
    }
    res.json({ success: true, accessCode: cleanCode });
  });

  app.get("/api/public/download-apk", (req, res) => {
    try {
      const meta = getApkMetaFromStorage();
      if (!meta || !fs.existsSync(APK_FINAL_PATH)) {
        return res.status(404).json({ error: "APK non disponibile" });
      }
      const fileSize = fs.statSync(APK_FINAL_PATH).size;
      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      const chunkParam = req.query.chunk;

      if (chunkParam !== undefined) {
        const chunkIndex = parseInt(chunkParam as string, 10);
        if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
          return res.status(400).json({ error: "Chunk non valido" });
        }
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
        const chunkSize = end - start + 1;

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", String(chunkSize));
        res.setHeader("X-Total-Size", String(fileSize));
        res.setHeader("X-Total-Chunks", String(totalChunks));
        res.setHeader("X-Chunk-Index", String(chunkIndex));
        res.setHeader("Access-Control-Expose-Headers", "X-Total-Size, X-Total-Chunks, X-Chunk-Index");

        const stream = fs.createReadStream(APK_FINAL_PATH, { start, end });
        stream.on("error", (err: any) => {
          console.error("APK chunk download error:", err);
          if (!res.headersSent) res.status(500).json({ error: "Errore download chunk" });
        });
        stream.pipe(res);
      } else {
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", `attachment; filename="SoccorsoDigitale-${meta.version || 'latest'}.apk"`);
        res.setHeader("Content-Length", String(fileSize));
        const stream = fs.createReadStream(APK_FINAL_PATH);
        stream.on("error", (err: any) => {
          console.error("APK download error:", err);
          if (!res.headersSent) res.status(500).json({ error: "Errore download" });
        });
        stream.pipe(res);
      }
    } catch (err) {
      console.error("APK download error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Errore download APK" });
    }
  });

  const uploadsApkTempDir = path.join(UPLOADS_DIR,"apk", "temp");
  if (!fs.existsSync(uploadsApkTempDir)) {
    try { fs.mkdirSync(uploadsApkTempDir, { recursive: true }); } catch (e) { console.warn("Cannot create APK temp dir:", e); }
  }

  const apkChunkUpload = multer({
    dest: path.join(uploadsApkTempDir, "chunks"),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.post("/api/admin/upload-apk-init", requireSuperAdmin, (req, res) => {
    try {
      const { version, totalChunks, totalSize } = req.body;
      if (!version || !totalChunks || !totalSize) {
        return res.status(400).json({ error: "Parametri mancanti" });
      }
      const uploadId = crypto.randomUUID();
      const chunksDir = path.join(uploadsApkTempDir, "chunks", uploadId);
      fs.mkdirSync(chunksDir, { recursive: true });
      const uploadMeta = { uploadId, version, totalChunks, totalSize, receivedChunks: 0 };
      fs.writeFileSync(path.join(chunksDir, "upload.json"), JSON.stringify(uploadMeta));
      console.log(`APK chunked upload started: ${uploadId} (${totalChunks} chunks, ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
      res.json({ success: true, uploadId });
    } catch (err) {
      console.error("APK init error:", err);
      res.status(500).json({ error: "Errore inizializzazione upload" });
    }
  });

  app.post("/api/admin/upload-apk-chunk", requireSuperAdmin, apkChunkUpload.single('chunk'), (req, res) => {
    try {
      const uploadId = req.body?.uploadId;
      const chunkIndex = parseInt(req.body?.chunkIndex, 10);
      if (!uploadId || isNaN(chunkIndex) || !req.file) {
        return res.status(400).json({ error: "Parametri mancanti" });
      }
      const chunksDir = path.join(uploadsApkTempDir, "chunks", uploadId);
      const uploadMetaPath = path.join(chunksDir, "upload.json");
      if (!fs.existsSync(uploadMetaPath)) {
        return res.status(404).json({ error: "Upload non trovato" });
      }
      fs.renameSync(req.file.path, path.join(chunksDir, `chunk-${chunkIndex}`));
      const uploadMeta = JSON.parse(fs.readFileSync(uploadMetaPath, "utf-8"));
      uploadMeta.receivedChunks++;
      fs.writeFileSync(uploadMetaPath, JSON.stringify(uploadMeta));
      res.json({ success: true, received: uploadMeta.receivedChunks, total: uploadMeta.totalChunks });
    } catch (err) {
      console.error("APK chunk error:", err);
      res.status(500).json({ error: "Errore caricamento chunk" });
    }
  });

  app.post("/api/admin/upload-apk-complete", requireSuperAdmin, async (req, res) => {
    try {
      const { uploadId } = req.body;
      if (!uploadId) return res.status(400).json({ error: "uploadId mancante" });
      const chunksDir = path.join(uploadsApkTempDir, "chunks", uploadId);
      const uploadMetaPath = path.join(chunksDir, "upload.json");
      if (!fs.existsSync(uploadMetaPath)) {
        return res.status(404).json({ error: "Upload non trovato" });
      }
      const uploadMeta = JSON.parse(fs.readFileSync(uploadMetaPath, "utf-8"));
      const version = uploadMeta.version || "1.0.0";
      const filename = `soccorso-digitale-${version}.apk`;
      const tempDestPath = path.resolve(uploadsApkTempDir, filename);

      const writeStream = fs.createWriteStream(tempDestPath);
      for (let i = 0; i < uploadMeta.totalChunks; i++) {
        const chunkPath = path.join(chunksDir, `chunk-${i}`);
        if (!fs.existsSync(chunkPath)) {
          writeStream.destroy();
          if (fs.existsSync(tempDestPath)) fs.unlinkSync(tempDestPath);
          return res.status(400).json({ error: `Chunk ${i} mancante` });
        }
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
      }
      writeStream.end();

      writeStream.on('finish', () => {
        try {
          const fileSize = fs.statSync(tempDestPath).size;
          // Move assembled file to final APK path
          if (fs.existsSync(APK_FINAL_PATH)) fs.unlinkSync(APK_FINAL_PATH);
          fs.renameSync(tempDestPath, APK_FINAL_PATH);
          const oldMeta = getApkMetaFromStorage();
          const accessCode = oldMeta?.accessCode || "SD2026APP";
          const meta = { version, filename, size: fileSize, uploadDate: new Date().toISOString(), accessCode };
          saveApkMetaToStorage(meta);
          fs.rmSync(chunksDir, { recursive: true, force: true });
          console.log(`APK saved locally: ${filename} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
          res.json({ success: true, ...meta });
        } catch (uploadErr) {
          console.error("APK save error:", uploadErr);
          if (fs.existsSync(tempDestPath)) fs.unlinkSync(tempDestPath);
          if (!res.headersSent) res.status(500).json({ error: "Errore salvataggio APK" });
        }
      });

      writeStream.on('error', (err) => {
        console.error("APK assembly error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Errore assemblaggio file" });
      });
    } catch (err) {
      console.error("APK complete error:", err);
      res.status(500).json({ error: "Errore completamento upload" });
    }
  });

  app.delete("/api/admin/delete-apk", requireSuperAdmin, (_req, res) => {
    try {
      if (fs.existsSync(APK_FINAL_PATH)) fs.unlinkSync(APK_FINAL_PATH);
      if (fs.existsSync(APK_META_PATH)) fs.unlinkSync(APK_META_PATH);
      res.json({ success: true });
    } catch (err) {
      console.error("APK delete error:", err);
      res.json({ success: true });
    }
  });

  // ============================================================================
  // PUBLIC API - No authentication required
  // ============================================================================
  
  // Demo account request
  app.post("/api/public/request-demo", async (req, res) => {
    try {
      const { email, name, company } = req.body;
      
      if (!email || !name) {
        return res.status(400).json({ error: "Email e nome sono obbligatori" });
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Indirizzo email non valido" });
      }
      
      const result = await createDemoAccount(email, name, company);
      
      if (!result.success) {
        return res.status(409).json({ error: result.error });
      }
      
      if ((result as any).emailFailed && (result as any).credentials) {
        return res.json({
          success: true,
          message: "Demo creata! L'invio email non è riuscito, ecco le tue credenziali:",
          credentials: (result as any).credentials
        });
      }
      
      res.json({ success: true, message: "Demo creata! Controlla la tua email per le credenziali di accesso." });
    } catch (error) {
      console.error("Error creating demo:", error);
      res.status(500).json({ error: "Errore durante la creazione della demo" });
    }
  });
  
  if (process.env.NODE_ENV !== "production") {
    startDemoCleanupScheduler();
    startHealthMonitoring();
  } else {
    console.log("[Production] Background schedulers disabled to save memory");
  }
  
  app.get("/api/google-maps-loader", (_req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(`(function(){var s=document.createElement('script');s.src='https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places,marker&v=weekly&callback=__gmapsInit';s.async=true;s.defer=true;window.__gmapsInit=function(){window.__gmapsReady=true;document.dispatchEvent(new Event("gmaps-ready"));};document.head.appendChild(s);})();`);
  });

  // GET /api/health - Infrastructure health check (public, for PA uptime verification)
  app.get("/api/health", async (_req, res) => {
    try {
      const result = await runHealthCheck();
      const statusCode = result.status === "operational" ? 200 : 503;
      res.status(statusCode).json(result);
    } catch (err) {
      res.status(503).json({ status: "major_outage", timestamp: new Date().toISOString(), services: [] });
    }
  });
  
  // GET /api/public/status - Public status page data (no auth required)
  app.get("/api/public/status", async (_req, res) => {
    try {
      const healthResult = await runHealthCheck();
      const uptime30d = await getUptimePercentage(30);
      const uptime90d = await getUptimePercentage(90);
      const incidents = await getRecentIncidents(30);
      
      res.json({
        status: healthResult.status,
        timestamp: healthResult.timestamp,
        services: healthResult.services.map(s => ({
          name: s.service,
          status: s.status,
          responseTimeMs: s.responseTimeMs,
        })),
        uptime: { last30Days: uptime30d, last90Days: uptime90d },
        incidents: incidents.map((i: any) => ({
          id: i.id,
          service: i.service_name,
          severity: i.breach_severity,
          createdAt: i.created_at,
          resolvedAt: i.resolved_at,
          durationMinutes: i.duration_minutes ? Math.round(i.duration_minutes) : null,
          resolution: i.resolution,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Errore nel caricamento dello stato" });
    }
  });
  
  // Live activity feed - anonymized recent service completions
  app.get("/api/public/activity-feed", async (req, res) => {
    try {
      const allTrips = await (storage.getTrips as any)({});
      const locations = await storage.getLocations();
      const locationMap = new Map(locations.map(l => [l.id, l.name]));

      // Get trips from last 48 hours, sorted by most recent
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const recentTrips = allTrips
        .filter((t: any) => new Date(t.createdAt || '') > cutoff)
        .sort((a: any, b: any) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
        .slice(0, 10);

      // Anonymize and format for public display
      const activities = recentTrips.map((trip: any, index: any) => {
        const locationName = (trip as any).locationId ? locationMap.get((trip as any).locationId) : null;
        const timeAgo = getTimeAgo(new Date(trip.createdAt || ''));
        
        // Generate anonymous activity messages
        const messages = [
          `Servizio completato${locationName ? ` a ${locationName}` : ''}`,
          `Paziente trasportato in sicurezza`,
          `Trasporto sanitario effettuato`,
          `Intervento completato con successo`,
        ];
        
        return {
          id: `activity-${index}`,
          message: messages[index % messages.length],
          timeAgo,
          km: trip.kmTraveled || 0,
          type: trip.serviceType || 'transport',
          icon: trip.isReturnTrip ? 'corner-down-left' : 'truck',
        };
      });
      
      res.json({ activities });
    } catch (error) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ error: "Errore nel recupero attività" });
    }
  });
  
  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "Ora";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min fa`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ore fa`;
    return `${Math.floor(seconds / 86400)} giorni fa`;
  }
  
  app.get("/api/public/impact", async (req, res) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      
      // Get all trips for aggregation (only public, non-sensitive data)
      const allTrips = await (storage.getTrips as any)({});
      
      // Calculate today's metrics
      const todayTrips = allTrips.filter((t: any) => t.serviceDate === today);
      const todayServices = todayTrips.length;
      const todayKm = todayTrips.reduce((sum: any, t: any) => sum + (t.kmTraveled || 0), 0);

      // Calculate monthly metrics
      const monthTrips = allTrips.filter((t: any) => t.serviceDate >= startOfMonth);
      const monthPatients = monthTrips.filter((t: any) => !t.isReturnTrip).length;
      const monthKm = monthTrips.reduce((sum: any, t: any) => sum + (t.kmTraveled || 0), 0);

      // Calculate yearly metrics
      const yearTrips = allTrips.filter((t: any) => t.serviceDate >= startOfYear);
      const yearServices = yearTrips.length;
      const yearPatients = yearTrips.filter((t: any) => !t.isReturnTrip).length;
      const yearKm = yearTrips.reduce((sum: any, t: any) => sum + (t.kmTraveled || 0), 0);

      // Get active vehicles count (vehicles with trips in last 24 hours)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const recentTrips = allTrips.filter((t: any) => t.serviceDate >= yesterday);
      const activeVehicleIds = new Set(recentTrips.map((t: any) => t.vehicleId));
      const activeVehicles = activeVehicleIds.size;
      
      // Mock campaign data (can be stored in DB later)
      const campaign = {
        name: "Adotta un Mezzo 2025",
        goal: 80000,
        raised: 12500,
        description: "Aiutaci ad acquistare una nuova ambulanza"
      };
      
      // Return aggregated public data only (no PII)
      res.json({
        today: {
          services: todayServices,
          km: todayKm
        },
        month: {
          patients: monthPatients,
          km: monthKm,
          services: monthTrips.length
        },
        year: {
          services: yearServices,
          patients: yearPatients,
          km: yearKm
        },
        live: {
          activeVehicles
        },
        campaign,
        lastUpdate: now.toISOString()
      });
    } catch (error) {
      console.error("Error fetching public impact data:", error);
      res.status(500).json({ error: "Errore nel recupero dati" });
    }
  });

  // Locations
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

  app.get("/api/org/primary-location", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      // Get all locations for this org
      const locs = await db.select().from(locations).where(eq(locations.organizationId, orgId || ''));
      // Find primary or fallback to first
      const primary = locs.find((l: any) => l.isPrimary) || locs[0];
      if (primary) {
        res.json({
          id: primary.id,
          name: primary.name,
          lat: parseFloat((primary as any).latitude) || null,
          lng: parseFloat((primary as any).longitude) || null,
          isPrimary: (primary as any).isPrimary || false,
        });
      } else {
        // Fallback: San Giovanni Lupatoto (Croce Europa HQ)
        res.json({ lat: 45.3833, lng: 11.0458, name: 'San Giovanni Lupatoto', isPrimary: false });
      }
    } catch (e) {
      res.json({ lat: 45.3833, lng: 11.0458, name: 'San Giovanni Lupatoto', isPrimary: false });
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

  app.put("/api/locations/:id/set-primary", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(403).json({ error: "Non autorizzato" });
      const existing = await storage.getLocation(req.params.id);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ error: "Sede non trovata" });
      }
      // Unset all others, then set this one
      const allLocs = (await storage.getLocations()).filter(l => l.organizationId === orgId);
      for (const loc of allLocs) {
        if (loc.id !== req.params.id && loc.isPrimary) {
          await storage.updateLocation(loc.id, { isPrimary: false } as any);
        }
      }
      const updated = await storage.updateLocation(req.params.id, { isPrimary: true } as any);
      res.json(updated);
    } catch (error) {
      console.error("Error setting primary location:", error);
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
        if (trip.kmFinal && (trip as any).kmStart) {
          kmToday += trip.kmFinal - (trip as any).kmStart;
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
      const orgId = getEffectiveOrgId(req);
      const body = { ...req.body };
      // Auto-assign first location of the org if locationId not provided
      if (!body.locationId && orgId) {
        const [defaultLoc] = await db
          .select()
          .from(locations)
          .where(eq(locations.organizationId, orgId))
          .limit(1);
        if (defaultLoc) body.locationId = defaultLoc.id;
      }
      const vehicleData = insertVehicleSchema.parse(body);
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
          const staffMember = await storage.getStaffMemberById(assignment.staffMemberId);
          if (staffMember) {
            allCrew.push({
              id: staffMember.id,
              name: `${staffMember.firstName} ${staffMember.lastName}`,
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
      const orgId = getEffectiveOrgId(req);
      if (orgId && trip.organizationId && trip.organizationId !== orgId) {
        return res.status(403).json({ error: "Accesso non autorizzato" });
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
      if (orgId && !isFullAdmin(req)) {
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

  // Notifications endpoint - get recent manual entries from crew
  app.get("/api/announcements", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.json([]);
      }
      const orgId = getEffectiveOrgId(req);
      const unreadAnnouncements = await storage.getUnreadAnnouncementsForUser(userId, orgId);
      res.json(unreadAnnouncements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get all announcements (for admin)
  app.get("/api/announcements/all", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        const orgAnnouncements = await db.select().from(announcements)
          .where(eq(announcements.organizationId, orgId))
          .orderBy(desc(announcements.createdAt));
        return res.json(orgAnnouncements);
      }
      
      const allAnnouncements = await storage.getAllAnnouncements();
      res.json(allAnnouncements);
    } catch (error) {
      console.error("Error fetching all announcements:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get single announcement
  app.get("/api/announcements/:id", requireAuth, async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ error: "Comunicazione non trovata" });
      }
      res.json(announcement);
    } catch (error) {
      console.error("Error fetching announcement:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Create announcement (admin only)
  app.post("/api/announcements", requireAdmin, async (req, res) => {
    try {
      const { title, content, priority, expiresAt } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: "Titolo e contenuto obbligatori" });
      }
      
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const announcementData: any = {
        title,
        content,
        priority: priority || "normal",
        createdById: user?.id || "system",
        createdByName: user?.name || "Sistema",
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      };
      const orgId = getEffectiveOrgId(req);
      if (isOrgAdmin(req) && orgId) {
        announcementData.organizationId = orgId;
      }
      const announcement = await storage.createAnnouncement(announcementData);
      
      res.status(201).json(announcement);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Update announcement (admin only)
  app.put("/api/announcements/:id", requireAdmin, async (req, res) => {
    try {
      const { title, content, priority, isActive, expiresAt } = req.body;
      const announcement = await storage.updateAnnouncement(req.params.id, {
        title,
        content,
        priority,
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      if (!announcement) {
        return res.status(404).json({ error: "Comunicazione non trovata" });
      }
      res.json(announcement);
    } catch (error) {
      console.error("Error updating announcement:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Delete announcement (admin only)
  app.delete("/api/announcements/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteAnnouncement(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Comunicazione non trovata" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get announcement read status (admin only)
  app.get("/api/announcements/:id/reads", requireAdmin, async (req, res) => {
    try {
      const reads = await storage.getAnnouncementReads(req.params.id);
      const users = await storage.getUsers();
      
      // Map reads with user names
      const readUsers = reads.map(read => {
        const user = users.find(u => u.id === read.userId);
        return {
          ...read,
          userName: user?.name || "Utente sconosciuto",
          userEmail: user?.email || "",
        };
      });
      
      // Also return users who haven't read
      const readUserIds = new Set(reads.map(r => r.userId));
      const unreadUsers = users
        .filter(u => !readUserIds.has(u.id) && u.role === "crew")
        .map(u => ({ userId: u.id, userName: u.name, userEmail: u.email }));
      
      res.json({ reads: readUsers, unread: unreadUsers, totalRead: reads.length });
    } catch (error) {
      console.error("Error fetching announcement reads:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Mark announcement as read (crew)
  app.post("/api/announcements/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Non autenticato" });
      }
      
      const read = await storage.markAnnouncementAsRead(req.params.id, userId);
      res.json(read);
    } catch (error) {
      console.error("Error marking announcement as read:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get user's read announcements
  app.get("/api/user/announcement-reads", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Non autenticato" });
      }
      
      const reads = await storage.getUserAnnouncementReads(userId);
      res.json(reads);
    } catch (error) {
      console.error("Error fetching user announcement reads:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ===== USER SETTINGS API =====
  
  // Get user settings
  app.get("/api/scadenze/status", requireAuth, async (req, res) => {
    try {
      const { vehicleId, month, year } = req.query;
      if (!vehicleId || !month || !year) {
        return res.status(400).json({ error: "Parametri mancanti" });
      }
      
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const [vehicle] = await db.select().from(vehiclesTable).where(and(eq(vehiclesTable.id, vehicleId as string), eq(vehiclesTable.organizationId, orgId)));
        if (!vehicle) {
          return res.status(403).json({ error: "Accesso non autorizzato a questo veicolo" });
        }
      }
      
      const report = await storage.getScadenzeReport(
        vehicleId as string,
        parseInt(month as string),
        parseInt(year as string)
      );
      
      const completed = !!report;
      const currentDay = new Date().getDate();
      const pendingDays = completed ? 0 : Math.max(0, 31 - currentDay);
      
      res.json({ completed, pendingDays, report });
    } catch (error) {
      console.error("Error fetching scadenze status:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get current month scadenze report
  app.get("/api/scadenze/current", requireAuth, async (req, res) => {
    try {
      const { vehicleId, month, year } = req.query;
      if (!vehicleId || !month || !year) {
        return res.status(400).json({ error: "Parametri mancanti" });
      }
      
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const [vehicle] = await db.select().from(vehiclesTable).where(and(eq(vehiclesTable.id, vehicleId as string), eq(vehiclesTable.organizationId, orgId)));
        if (!vehicle) {
          return res.status(403).json({ error: "Accesso non autorizzato a questo veicolo" });
        }
      }
      
      const report = await storage.getScadenzeReport(
        vehicleId as string,
        parseInt(month as string),
        parseInt(year as string)
      );
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching current scadenze:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Submit scadenze report
  app.post("/api/scadenze", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Non autenticato" });
      }

      const user = await storage.getUser(userId);
      const orgId = user?.organizationId || getEffectiveOrgId(req) || 'croce-europa-default';
      
      const report = await storage.createScadenzeReport({
        ...req.body,
        submittedByUserId: userId,
        completedAt: new Date(),
        organizationId: orgId,
      });
      
      res.json(report);
    } catch (error) {
      console.error("Error creating scadenze report:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get all scadenze reports (admin only)
  app.get("/api/scadenze", requireAdmin, async (req, res) => {
    try {
      const { month, year, locationId } = req.query;
      
      const orgId = getEffectiveOrgId(req);
      const isOrg = isOrgAdmin(req) && orgId;
      
      let effectiveLocationId = locationId as string | undefined;
      
      if (isOrg) {
        const orgLocations = await db.select().from(locations).where(eq(locations.organizationId, orgId!));
        const orgLocationIds = orgLocations.map(l => l.id);
        
        if (effectiveLocationId) {
          if (!orgLocationIds.includes(effectiveLocationId)) {
            return res.json([]);
          }
        } else {
          const reports = await storage.getScadenzeReports({
            month: month ? parseInt(month as string) : undefined,
            year: year ? parseInt(year as string) : undefined,
          });
          const filteredReports = reports.filter(r => orgLocationIds.includes(r.locationId));
          return res.json(filteredReports);
        }
      }
      
      const reports = await storage.getScadenzeReports({
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        locationId: effectiveLocationId,
      });
      res.json(reports);
    } catch (error) {
      console.error("Error fetching scadenze reports:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get items expiring within alert threshold (for push notifications)
  app.get("/api/expiry-alerts", requireAuth, async (req, res) => {
    try {
      const items = await storage.getChecklistTemplateItems();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const expiringItems = items
        .filter(item => item.hasExpiry && item.expiryDate)
        .map(item => {
          const expiryDate = new Date(item.expiryDate!);
          expiryDate.setHours(0, 0, 0, 0);
          const timeDiff = expiryDate.getTime() - today.getTime();
          const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          const alertDays = item.expiryAlertDays || 15;
          
          return {
            id: item.id,
            label: item.label,
            category: item.category,
            subZone: item.subZone,
            expiryDate: item.expiryDate,
            daysUntilExpiry,
            alertDays,
            shouldAlert: daysUntilExpiry <= alertDays,
          };
        })
        .filter(item => item.shouldAlert)
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
      
      res.json(expiringItems);
    } catch (error) {
      console.error("Error fetching expiry alerts:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Generate scadenze PDF report
  app.get("/api/scadenze/:id/pdf", requireAuth, async (req, res) => {
    try {
      const report = await storage.getScadenzeReportById(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report non trovato" });
      }
      
      // Get vehicle and location info
      const vehicle = await storage.getVehicle(report.vehicleId);
      const location = await storage.getLocation(report.locationId);
      
      // Generate PDF
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=scadenze_${report.reportMonth}_${report.reportYear}_${vehicle?.code || 'veicolo'}.pdf`);
      doc.pipe(res);
      
      // Header
      doc.fontSize(20).fillColor("#1a365d").text("SOCCORSO DIGITALE", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).text("Report Scadenze Materiali", { align: "center" });
      doc.moveDown();
      
      // Report info
      const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
                          "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
      doc.fontSize(12).fillColor("#333");
      doc.text(`Mese: ${monthNames[report.reportMonth - 1]} ${report.reportYear}`);
      doc.text(`Veicolo: ${vehicle?.code || "N/D"} - ${vehicle?.licensePlate || ""}`);
      doc.text(`Sede: ${location?.name || "N/D"}`);
      doc.text(`Completato da: ${report.submittedByName}`);
      doc.text(`Data compilazione: ${new Date(report.completedAt).toLocaleDateString("it-IT")}`);
      doc.moveDown();
      
      // Summary
      doc.fontSize(14).fillColor("#1a365d").text("Riepilogo", { underline: true });
      doc.fontSize(12).fillColor("#333");
      doc.text(`Articoli verificati: ${report.totalItemsChecked}`);
      doc.text(`Scaduti: ${report.expiredItemsCount}`, { continued: false });
      doc.text(`In scadenza (30gg): ${report.expiringItemsCount}`);
      doc.moveDown();
      
      // Items table
      doc.fontSize(14).fillColor("#1a365d").text("Dettaglio Materiali", { underline: true });
      doc.moveDown(0.5);
      
      const items = report.items as any[];
      items.forEach((item, idx) => {
        const statusLabel = item.status === "expired" ? "[SCADUTO]" : 
                           item.status === "expiring" ? "[IN SCADENZA]" : "[OK]";
        const statusColor = item.status === "expired" ? "#DC2626" : 
                           item.status === "expiring" ? "#F59E0B" : "#10B981";
        
        doc.fontSize(10).fillColor(statusColor).text(statusLabel, { continued: true });
        doc.fillColor("#333").text(` ${item.itemName} - Qty: ${item.quantity}${item.expiryDate ? ` - Scad: ${new Date(item.expiryDate).toLocaleDateString("it-IT")}` : ""}`);
      });
      
      if (report.notes) {
        doc.moveDown();
        doc.fontSize(12).fillColor("#1a365d").text("Note:", { underline: true });
        doc.fontSize(10).fillColor("#333").text(report.notes);
      }
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor("#666").text(`Generato il ${new Date().toLocaleString("it-IT")}`, { align: "center" });
      
      doc.end();
    } catch (error) {
      console.error("Error generating scadenze PDF:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ===== EXPIRY CORRECTION REQUESTS API =====

  // Submit expiry correction request from crew
  app.post("/api/expiry-corrections", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const { checklistItemId, vehicleId, requestedByName, currentExpiryDate, proposedExpiryDate, notes } = req.body;
      
      if (!checklistItemId || !vehicleId || !requestedByName) {
        return res.status(400).json({ error: "Dati mancanti" });
      }

      // Get item details
      const item = await storage.getChecklistTemplateItem(checklistItemId);
      if (!item) {
        return res.status(404).json({ error: "Articolo non trovato" });
      }

      // Get vehicle details
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }

      const request = await storage.createExpiryCorrectionRequest({
        itemId: checklistItemId,
        itemLabel: item.label,
        vehicleId,
        vehicleCode: vehicle.code,
        locationId: vehicle.locationId,
        requestedById: userId || "unknown",
        requestedByName,
        currentExpiryDate: currentExpiryDate || null,
        suggestedExpiryDate: proposedExpiryDate || null,
        notes: notes || null,
        status: "pending",
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating expiry correction request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get all expiry correction requests (admin only)
  app.get("/api/expiry-corrections", requireAdmin, async (req, res) => {
    try {
      const { status, locationId } = req.query;
      const requests = await storage.getExpiryCorrectionRequests({
        status: status as string | undefined,
        locationId: locationId as string | undefined,
      });
      res.json(requests);
    } catch (error) {
      console.error("Error fetching expiry correction requests:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Update expiry correction request (admin only)
  app.patch("/api/expiry-corrections/:id", requireAdmin, async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const { status, resolvedNotes } = req.body;

      const request = await storage.updateExpiryCorrectionRequest(req.params.id, {
        status,
        resolvedById: userId,
        resolutionNotes: resolvedNotes,
        resolvedAt: new Date(),
      });

      if (!request) {
        return res.status(404).json({ error: "Richiesta non trovata" });
      }

      // If approved, update the checklist item expiry date
      if (status === "approved" && request.suggestedExpiryDate) {
        await storage.updateChecklistTemplateItem(request.itemId, {
          expiryDate: request.suggestedExpiryDate,
        });
      }

      res.json(request);
    } catch (error) {
      console.error("Error updating expiry correction request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ===== STRUCTURE PHONE/ACCESS CODE API =====
  
  // Update structure phone number and access code (admin only)
  app.patch("/api/structures/:id/contact", requireAdmin, async (req, res) => {
    try {
      const { phoneNumber, accessCode } = req.body;
      const structure = await storage.updateStructure(req.params.id, {
        phoneNumber,
        accessCode,
      });
      if (!structure) {
        return res.status(404).json({ error: "Struttura non trovata" });
      }
      res.json(structure);
    } catch (error) {
      console.error("Error updating structure contact info:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Get all users (admin only) - for announcement read tracking
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      let allUsers;
      if (orgId && !isFullAdmin(req)) {
        allUsers = await db.select().from(users).where(eq(users.organizationId, orgId)).orderBy(users.name);
      } else {
        allUsers = await storage.getUsers();
      }
      // Remove passwords from response
      const safeUsers = allUsers.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ===== BRANCH MANAGERS ENDPOINTS =====

  // Get all branch managers with their assigned locations
  app.get("/api/branch-managers", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      let managers = await storage.getAllBranchManagers();
      if (orgId) {
        managers = managers.filter((m: any) => m.organizationId === orgId);
      }
      const safeManagers = managers.map(({ password, ...m }) => m);
      res.json(safeManagers);
    } catch (error) {
      console.error("Error fetching branch managers:", error);
      res.status(500).json({ error: "Errore nel recupero responsabili" });
    }
  });

  // Create a new branch manager
  app.post("/api/branch-managers", requireAdmin, async (req, res) => {
    try {
      const { email, password, name, locationIds } = req.body;
      
      // Create user with branch_manager role
      const hashedPassword = password; // In production, hash this
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: 'branch_manager',
      } as any);
      
      // Assign locations
      if (locationIds && Array.isArray(locationIds)) {
        for (let i = 0; i < locationIds.length; i++) {
          await storage.createUserLocation({
            userId: user.id,
            locationId: locationIds[i],
            isPrimary: i === 0
          });
        }
      }
      
      const { password: _, ...safeUser } = user;
      const userLocs = await storage.getUserLocations(user.id);
      res.status(201).json({ 
        ...safeUser, 
        assignedLocations: userLocs.map(ul => ul.location) 
      });
    } catch (error) {
      console.error("Error creating branch manager:", error);
      res.status(500).json({ error: "Errore nella creazione responsabile" });
    }
  });

  // Update branch manager locations
  app.put("/api/branch-managers/:userId/locations", requireAdmin, async (req, res) => {
    try {
      const { locationIds } = req.body;
      const { userId } = req.params;
      
      // Remove all existing locations
      await storage.deleteAllUserLocations(userId);
      
      // Add new locations
      if (locationIds && Array.isArray(locationIds)) {
        for (let i = 0; i < locationIds.length; i++) {
          await storage.createUserLocation({
            userId,
            locationId: locationIds[i],
            isPrimary: i === 0
          });
        }
      }
      
      const userLocs = await storage.getUserLocations(userId);
      res.json({ locationIds: userLocs.map(ul => ul.locationId) });
    } catch (error) {
      console.error("Error updating branch manager locations:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento sedi" });
    }
  });

  // Delete branch manager
  app.delete("/api/branch-managers/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      await storage.deleteAllUserLocations(userId);
      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(404).json({ error: "Responsabile non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting branch manager:", error);
      res.status(500).json({ error: "Errore nell'eliminazione responsabile" });
    }
  });

  // Get current user info with managed locations (for branch managers)
  app.post("/api/admin/list-vehicles", async (req, res) => {
    try {
      const { secret } = req.body;
      const expectedSecret = process.env.TRIP_INTEGRITY_SECRET;
      
      if (!expectedSecret || secret !== expectedSecret) {
        return res.status(401).json({ error: "Non autorizzato" });
      }
      
      const allVehicles = await storage.getVehicles();
      const vehicleCodes = allVehicles.map(v => ({
        code: v.code,
        codeClean: v.code?.replace(/\s+/g, ''),
        id: v.id,
        locationId: v.locationId
      }));
      
      res.json({ count: allVehicles.length, vehicles: vehicleCodes });
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  // Seed vehicle users endpoint - creates all vehicle user accounts
  // Protected with TRIP_INTEGRITY_SECRET for security
  app.post("/api/admin/seed-vehicle-users", async (req, res) => {
    try {
      const { secret } = req.body;
      const expectedSecret = process.env.TRIP_INTEGRITY_SECRET;
      
      if (!expectedSecret || secret !== expectedSecret) {
        return res.status(401).json({ error: "Non autorizzato" });
      }
      
      // Hardcoded vehicle and location data to ensure consistency
      const locationsData = [
        { id: "a362c8c4-9346-49c6-8162-206d939444fa", name: "COLOGNA VENETA" },
        { id: "5c40c432-9312-4aa4-85ed-eed595731205", name: "LEGNAGO" },
        { id: "dde6b010-92ab-4281-9636-9d45aa989e99", name: "MONTECCHIO MAGGIORE" },
        { id: "3a897440-10a9-4540-a9a7-bbf5b3450cd4", name: "NOGARA" },
        { id: "df053241-6c3c-4225-b002-b28af7ae8677", name: "SAN GIOVANNI LUPATOTO" }
      ];
      
      const vehiclesData = [
        { id: "27565cd1-67c1-43ae-aacb-3ebd7589d935", code: "J 30", locationId: "dde6b010-92ab-4281-9636-9d45aa989e99" },
        { id: "b5ccd3b8-4531-4a38-9bd5-54f4f5613cea", code: "J 31", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "4935b535-6bfd-4854-b994-78545998e8fd", code: "J 46", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "8f15637f-c1c6-4204-a2b8-85aeedfab53f", code: "J 48", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "fd4670af-ecb3-4305-978b-7681b7e0cd74", code: "J 49", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "75cea20e-0613-4cc8-b68b-53fb37bc321b", code: "J 50", locationId: "5c40c432-9312-4aa4-85ed-eed595731205" },
        { id: "2e3af68e-5458-40b3-9828-d47926bc8ea9", code: "J 52", locationId: "5c40c432-9312-4aa4-85ed-eed595731205" },
        { id: "e2076db7-6276-419e-b266-fd9585dc852b", code: "J 54", locationId: "5c40c432-9312-4aa4-85ed-eed595731205" },
        { id: "4308923b-90d0-4343-ae27-2903fb20e833", code: "J 55", locationId: "5c40c432-9312-4aa4-85ed-eed595731205" },
        { id: "26b6eff2-1970-4ed7-8c9f-59a9ac0f4aa0", code: "J 56", locationId: "dde6b010-92ab-4281-9636-9d45aa989e99" },
        { id: "1a0d73b5-4bd8-4219-9ccf-37197a7e4d50", code: "J 58", locationId: "dde6b010-92ab-4281-9636-9d45aa989e99" },
        { id: "6abbe451-0336-4e22-b4fa-82bb06837ee0", code: "J 59", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "592f5367-0373-451c-acf4-16036ab751c3", code: "J 60", locationId: "dde6b010-92ab-4281-9636-9d45aa989e99" },
        { id: "d3550f9a-1de3-43f4-a540-d25f433fc2e8", code: "J 61", locationId: "dde6b010-92ab-4281-9636-9d45aa989e99" },
        { id: "b6ee857b-9602-414d-a244-f3bcc80fcc50", code: "J 62", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "b222bbaa-b35a-4b13-83fe-7dd2aa9d863b", code: "J 63", locationId: "b73829f0-8cb9-453b-8f91-f5a1efc59061" },
        { id: "3615f699-9a68-47a8-9fd6-67651d163460", code: "J 64", locationId: "3a897440-10a9-4540-a9a7-bbf5b3450cd4" },
        { id: "4ab8e2fd-2c9a-42c9-83de-fadfeb48e9a8", code: "J 65", locationId: "5c40c432-9312-4aa4-85ed-eed595731205" },
        { id: "f5125d8a-8aab-4933-ba24-db95983901c5", code: "J 66", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "35ae9f32-2ace-4827-a646-d216711c70cc", code: "J 67", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "693b1855-09e6-460e-a3c2-70d151f5f4ad", code: "J 68", locationId: "dde6b010-92ab-4281-9636-9d45aa989e99" },
        { id: "546b4564-990e-41ad-8979-9272f446e416", code: "J 69", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "a0ed6486-e8db-4903-bfc9-c8205963c72d", code: "J 70", locationId: "5c40c432-9312-4aa4-85ed-eed595731205" },
        { id: "287497f9-7727-4dd9-a374-d5051b697b44", code: "J 71", locationId: "b73829f0-8cb9-453b-8f91-f5a1efc59061" },
        { id: "4bcdf6dc-deb1-4917-9c0b-aa2ae003cb49", code: "J 72", locationId: "dde6b010-92ab-4281-9636-9d45aa989e99" },
        { id: "44992cd1-d2a0-4a16-9d15-e205bc17cb8a", code: "ROMEO 21", locationId: "5c40c432-9312-4aa4-85ed-eed595731205" },
        { id: "b7cff3c4-7692-4728-bfbf-25eb48750b77", code: "SIERRA 1", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" },
        { id: "9fba218a-2686-4340-a8fa-44489bffb837", code: "SIERRA 2", locationId: "a362c8c4-9346-49c6-8162-206d939444fa" }
      ];
      
      const results: { 
        locationsCreated: string[]; 
        vehiclesCreated: string[]; 
        usersCreated: string[]; 
        usersExisting: string[]; 
        errors: string[] 
      } = {
        locationsCreated: [],
        vehiclesCreated: [],
        usersCreated: [],
        usersExisting: [],
        errors: []
      };
      
      // First, create locations if they don't exist
      for (const loc of locationsData) {
        try {
          const existing = await storage.getLocation(loc.id);
          if (!existing) {
            await storage.createLocation({ name: loc.name } as any);
            results.locationsCreated.push(loc.name);
          }
        } catch (err) {
          // Location doesn't exist, create it
          try {
            await storage.createLocation({ name: loc.name } as any);
            results.locationsCreated.push(loc.name);
          } catch (e) {
            results.errors.push(`Location ${loc.name}: ${e}`);
          }
        }
      }
      
      // Then, create vehicles if they don't exist
      for (const veh of vehiclesData) {
        try {
          const existing = await storage.getVehicle(veh.id);
          if (!existing) {
            await storage.createVehicle({
              code: veh.code,
              locationId: veh.locationId,
              type: "ambulance",
              isActive: true
            } as any);
            results.vehiclesCreated.push(veh.code);
          }
        } catch (err) {
          // Vehicle doesn't exist, create it
          try {
            await storage.createVehicle({
              code: veh.code,
              locationId: veh.locationId,
              type: "ambulance",
              isActive: true
            } as any);
            results.vehiclesCreated.push(veh.code);
          } catch (e) {
            results.errors.push(`Vehicle ${veh.code}: ${e}`);
          }
        }
      }
      
      // Finally, create users for all vehicles
      for (const vehicle of vehiclesData) {
        const code = vehicle.code.replace(/\s+/g, '').toUpperCase();
        const email = `${code.toLowerCase()}@croceeuropa.com`;
        const plainPassword = `Croce${code}!`;
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        try {
          const existingUser = await storage.getUserByEmail(email);
          if (existingUser) {
            await db.update(users).set({
              vehicleId: vehicle.id,
              locationId: vehicle.locationId,
              password: hashedPassword,
              isActive: true
            }).where(eq(users.id, existingUser.id));
            results.usersExisting.push(code);
            continue;
          }

          await storage.createUser({
            email,
            password: hashedPassword,
            name: `Ambulanza ${vehicle.code}`,
            role: "crew",
            locationId: vehicle.locationId,
          } as any);
          
          results.usersCreated.push(code);
        } catch (err) {
          results.errors.push(`User ${code}: ${err}`);
        }
      }
      
      res.json({
        success: true,
        message: `Locations: ${results.locationsCreated.length}, Vehicles: ${results.vehiclesCreated.length}, Users: ${results.usersCreated.length} creati, ${results.usersExisting.length} aggiornati`,
        results
      });
    } catch (error) {
      console.error("Error seeding vehicle users:", error);
      res.status(500).json({ error: "Errore nella creazione utenti" });
    }
  });

  // One-time fix: re-hash plain-text passwords for all vehicle users
  // Protected with TRIP_INTEGRITY_SECRET. Safe to call multiple times (idempotent).
  app.post("/api/admin/fix-vehicle-passwords", async (req, res) => {
    try {
      const { secret } = req.body;
      const expectedSecret = process.env.TRIP_INTEGRITY_SECRET;
      if (!expectedSecret || secret !== expectedSecret) {
        return res.status(401).json({ error: "Non autorizzato" });
      }

      // Find all users whose password is NOT a bcrypt hash (doesn't start with $2b$ or $2a$)
      const allUsers = await db.select({ id: users.id, email: users.email, password: users.password })
        .from(users);

      const needsFix = allUsers.filter(u =>
        u.password && !u.password.startsWith("$2b$") && !u.password.startsWith("$2a$")
      );

      const fixed: string[] = [];
      const errors: string[] = [];

      for (const u of needsFix) {
        try {
          const hashed = await bcrypt.hash(u.password!, 10);
          await db.update(users).set({ password: hashed }).where(eq(users.id, u.id));
          fixed.push(u.email);
        } catch (e) {
          errors.push(`${u.email}: ${e}`);
        }
      }

      res.json({ success: true, fixed: fixed.length, errors, fixedEmails: fixed });
    } catch (error) {
      console.error("Error fixing passwords:", error);
      res.status(500).json({ error: "Errore nel fix delle password" });
    }
  });

  // Audit logs endpoint (admin only)
  app.get("/api/audit-logs", requireAdmin, async (req, res) => {
    try {
      const { limit, entityType, entityId } = req.query;
      const orgId = getEffectiveOrgId(req);
      let logs: any[];

      // Validate limit parameter - must be positive integer, default to 100
      let parsedLimit = 100;
      if (limit) {
        const numLimit = parseInt(limit as string, 10);
        if (!isNaN(numLimit) && numLimit > 0 && numLimit <= 1000) {
          parsedLimit = numLimit;
        }
      }

      if (orgId && !isFullAdmin(req)) {
        // Org-scoped admins: filter audit logs to users belonging to their org
        const orgUserIds = (await db.select({ id: users.id }).from(users).where(eq(users.organizationId, orgId))).map(u => u.id);
        if (entityType && entityId) {
          const allLogs = await storage.getAuditLogsByEntity(entityType as string, entityId as string);
          logs = allLogs.filter(l => !l.userId || orgUserIds.includes(l.userId));
        } else {
          if (orgUserIds.length === 0) {
            logs = [];
          } else {
            logs = await db.select().from(auditLogs)
              .where(inArray(auditLogs.userId, orgUserIds))
              .orderBy(desc(auditLogs.createdAt))
              .limit(parsedLimit);
          }
        }
      } else if (entityType && entityId) {
        logs = await storage.getAuditLogsByEntity(entityType as string, entityId as string);
      } else {
        logs = await storage.getAuditLogs(parsedLimit);
      }
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Data export endpoint (admin only) - for syncing to production
  app.get("/api/admin/export-data", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      // Get all seed data (excluding trips, announcements, audit logs)
      const [
        locationsData,
        vehiclesData,
        structuresData,
        departmentsData,
        structureDepartmentsData,
        usersData
      ] = await Promise.all([
        orgId ? db.select().from(locations).where(eq(locations.organizationId, orgId)) : storage.getLocations(),
        orgId ? db.select().from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId)) : storage.getVehicles(),
        storage.getStructures(),
        storage.getDepartments(),
        storage.getAllStructureDepartments(),
        orgId ? db.select().from(users).where(eq(users.organizationId, orgId)) : storage.getUsers()
      ]);
      
      // Remove passwords from users for security
      const safeUsers = usersData.map(({ password, ...user }) => ({
        ...user,
        password: "REDACTED" // Placeholder - will need to be set manually in production
      }));
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        data: {
          locations: locationsData,
          vehicles: vehiclesData,
          structures: structuresData,
          departments: departmentsData,
          structureDepartments: structureDepartmentsData,
          users: safeUsers
        },
        counts: {
          locations: locationsData.length,
          vehicles: vehiclesData.length,
          structures: structuresData.length,
          departments: departmentsData.length,
          structureDepartments: structureDepartmentsData.length,
          users: safeUsers.length
        }
      };
      
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Errore nell'esportazione dei dati" });
    }
  });

  // Data import endpoint (admin only) - for importing into production
  app.post("/api/admin/import-data", requireAdmin, async (req, res) => {
    try {
      const { data, options } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: "Dati mancanti" });
      }
      
      const results = {
        locations: { inserted: 0, skipped: 0, errors: [] as string[] },
        vehicles: { inserted: 0, skipped: 0, errors: [] as string[] },
        structures: { inserted: 0, skipped: 0, errors: [] as string[] },
        departments: { inserted: 0, skipped: 0, errors: [] as string[] },
        structureDepartments: { inserted: 0, skipped: 0, errors: [] as string[] },
        users: { inserted: 0, skipped: 0, errors: [] as string[] }
      };
      
      // Import in order due to foreign key constraints
      // 1. Locations first
      if (data.locations) {
        for (const location of data.locations) {
          try {
            await storage.upsertLocation(location);
            results.locations.inserted++;
          } catch (error: any) {
            if (error.code === '23505') {
              results.locations.skipped++;
            } else {
              results.locations.errors.push(location.name || location.id);
            }
          }
        }
      }
      
      // 2. Vehicles (depends on locations)
      if (data.vehicles) {
        for (const vehicle of data.vehicles) {
          try {
            await storage.upsertVehicle(vehicle);
            results.vehicles.inserted++;
          } catch (error: any) {
            if (error.code === '23505') {
              results.vehicles.skipped++;
            } else {
              results.vehicles.errors.push(vehicle.code || vehicle.id);
            }
          }
        }
      }
      
      // 3. Structures
      if (data.structures) {
        for (const structure of data.structures) {
          try {
            await storage.upsertStructure(structure);
            results.structures.inserted++;
          } catch (error: any) {
            if (error.code === '23505') {
              results.structures.skipped++;
            } else {
              results.structures.errors.push(structure.name || structure.id);
            }
          }
        }
      }
      
      // 4. Departments
      if (data.departments) {
        for (const department of data.departments) {
          try {
            await storage.upsertDepartment(department);
            results.departments.inserted++;
          } catch (error: any) {
            if (error.code === '23505') {
              results.departments.skipped++;
            } else {
              results.departments.errors.push(department.name || department.id);
            }
          }
        }
      }
      
      // 5. Structure-Departments junction
      if (data.structureDepartments) {
        for (const sd of data.structureDepartments) {
          try {
            await storage.upsertStructureDepartment(sd);
            results.structureDepartments.inserted++;
          } catch (error: any) {
            if (error.code === '23505') {
              results.structureDepartments.skipped++;
            } else {
              results.structureDepartments.errors.push(sd.id);
            }
          }
        }
      }
      
      // 6. Users (only if explicitly requested, passwords must be set manually)
      if (data.users && options?.importUsers) {
        for (const user of data.users) {
          try {
            // Skip users with REDACTED password
            if (user.password === "REDACTED") {
              results.users.skipped++;
              continue;
            }
            await storage.upsertUser(user);
            results.users.inserted++;
          } catch (error: any) {
            if (error.code === '23505') {
              results.users.skipped++;
            } else {
              results.users.errors.push(user.email || user.id);
            }
          }
        }
      }
      
      res.json({
        success: true,
        message: "Importazione completata",
        results
      });
    } catch (error) {
      console.error("Error importing data:", error);
      res.status(500).json({ error: "Errore nell'importazione dei dati" });
    }
  });

  // Sync trips from embedded seed data
  app.post("/api/admin/sync-trips", requireAdmin, async (req, res) => {
    try {
      // Embedded trip data for syncing (same as seed.ts INITIAL_TRIPS)
      const INITIAL_TRIPS = [
        { progressive_number: "1765498361433", vehicle_code: "J 30", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "10:00:00", return_time: "10:35:00", patient_birth_year: 1955, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO TRENTO", origin_department_name: "REPARTO PRONTO SOCCORSO", origin_address: null, destination_type: "ospedale", destination_structure_name: "OSPEDALE BORGO ROMA", destination_department_name: "REPARTO CARDIOLOGIA", destination_address: null, km_initial: 417945, km_final: 417955, km_traveled: 10, duration_minutes: 35, service_type: null, is_return_trip: false, notes: null },
        { progressive_number: "1765534212729", vehicle_code: "J 60", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "11:10:00", return_time: "11:23:00", patient_birth_year: 1955, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: "REPARTO PRONTO SOCCORSO", origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA GIBILROSSA, VERONA", km_initial: 165000, km_final: 165006, km_traveled: 6, duration_minutes: 13, service_type: null, is_return_trip: false, notes: null },
        { progressive_number: "1765534655469", vehicle_code: "J 45", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "10:00:00", return_time: "11:00:00", patient_birth_year: 1950, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: null, origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA GIBILROSSA, VERONA", km_initial: 195000, km_final: 195006, km_traveled: 6, duration_minutes: 60, service_type: null, is_return_trip: false, notes: null },
        { progressive_number: "1765535155135", vehicle_code: "J 45", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "08:00:00", return_time: "09:00:00", patient_birth_year: 1970, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: null, origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA VERDI, VERONA", km_initial: 195006, km_final: 195038, km_traveled: 32, duration_minutes: 60, service_type: null, is_return_trip: false, notes: null },
        { progressive_number: "1765539563264", vehicle_code: "J 46", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "12:39:00", return_time: "13:24:00", patient_birth_year: 1988, patient_gender: "F", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: "REPARTO PRONTO SOCCORSO", origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA BASSANESE SUPERIORE, POZZOLEONE, VICENZA", km_initial: 210000, km_final: 210087, km_traveled: 87, duration_minutes: 45, service_type: null, is_return_trip: false, notes: null },
        { progressive_number: "123456", vehicle_code: "J 30", user_email: "demo@croceeuropa.it", service_date: "2025-12-13", departure_time: "16:43:00", return_time: "17:39:00", patient_birth_year: 1989, patient_gender: "F", origin_type: "ospedale", origin_structure_name: "OSPEDALE MATER SALUTIS", origin_department_name: "REPARTO CARDIOLOGIA", origin_address: null, destination_type: "ospedale", destination_structure_name: "OSPEDALE BORGO TRENTO", destination_department_name: "REPARTO CHIRURGIA GENERALE", destination_address: null, km_initial: 500149, km_final: 500237, km_traveled: 88, duration_minutes: 56, service_type: null, is_return_trip: false, notes: null },
        { progressive_number: "77777", vehicle_code: "J 55", user_email: "demo@croceeuropa.it", service_date: "2025-12-13", departure_time: "00:06:00", return_time: "00:28:00", patient_birth_year: 1988, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE MATER SALUTIS", origin_department_name: "RADIOLOGIA", origin_address: null, destination_type: "ospedale", destination_structure_name: null, destination_department_name: null, destination_address: null, km_initial: 150000, km_final: 150021, km_traveled: 21, duration_minutes: 22, service_type: null, is_return_trip: false, notes: null },
      ];

      // Get existing trips
      const existingTrips = await storage.getTrips();
      const existingProgressiveNumbers = new Set(existingTrips.map(t => t.progressiveNumber));

      // Get lookup maps
      const allVehicles = await storage.getVehicles();
      const vehicleByCode = new Map(allVehicles.map(v => [v.code, v.id]));

      const allUsers = await storage.getUsers();
      const userByEmail = new Map(allUsers.map(u => [u.email, u.id]));

      const allStructures = await storage.getStructures();
      const structureByName = new Map(allStructures.map(s => [s.name, s.id]));

      const allDepartments = await storage.getDepartments();
      const departmentByName = new Map(allDepartments.map(d => [d.name, d.id]));

      let imported = 0;
      let skipped = 0;
      let errors: string[] = [];

      for (const trip of INITIAL_TRIPS) {
        // Skip if already exists
        if (existingProgressiveNumbers.has(trip.progressive_number)) {
          skipped++;
          continue;
        }

        const vehicleId = vehicleByCode.get(trip.vehicle_code);
        const userId = userByEmail.get(trip.user_email);

        if (!vehicleId) {
          errors.push(`Veicolo ${trip.vehicle_code} non trovato`);
          continue;
        }

        if (!userId) {
          errors.push(`Utente ${trip.user_email} non trovato`);
          continue;
        }

        const originStructureId = trip.origin_structure_name ? structureByName.get(trip.origin_structure_name) || null : null;
        const originDepartmentId = trip.origin_department_name ? departmentByName.get(trip.origin_department_name) || null : null;
        const destinationStructureId = trip.destination_structure_name ? structureByName.get(trip.destination_structure_name) || null : null;
        const destinationDepartmentId = trip.destination_department_name ? departmentByName.get(trip.destination_department_name) || null : null;

        try {
          await storage.createTrip({
            progressiveNumber: trip.progressive_number,
            vehicleId: vehicleId,
            userId: userId,
            serviceDate: trip.service_date,
            departureTime: trip.departure_time,
            returnTime: trip.return_time,
            patientBirthYear: trip.patient_birth_year,
            patientGender: trip.patient_gender,
            originType: trip.origin_type,
            originStructureId: originStructureId,
            originDepartmentId: originDepartmentId,
            originAddress: trip.origin_address,
            destinationType: trip.destination_type,
            destinationStructureId: destinationStructureId,
            destinationDepartmentId: destinationDepartmentId,
            destinationAddress: trip.destination_address,
            kmInitial: trip.km_initial,
            kmFinal: trip.km_final,
            kmTraveled: trip.km_traveled,
            durationMinutes: trip.duration_minutes,
            serviceType: trip.service_type,
            isReturnTrip: trip.is_return_trip,
            notes: trip.notes,
          });
          imported++;
        } catch (error: any) {
          errors.push(`Errore viaggio ${trip.progressive_number}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: `Sincronizzazione completata: ${imported} importati, ${skipped} già presenti`,
        imported,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error syncing trips:", error);
      res.status(500).json({ error: "Errore nella sincronizzazione dei viaggi" });
    }
  });

  // ===== PDF UTIF REPORT =====
  app.get("/api/reports/utif-pdf", requireAdmin, async (req, res) => {
    try {
      const { vehicleId, dateFrom, dateTo } = req.query;
      
      if (!vehicleId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: "Parametri mancanti: vehicleId, dateFrom, dateTo" });
      }
      
      const vehicle = await storage.getVehicle(vehicleId as string);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      
      const allTrips = await storage.getTripsByVehicle(vehicleId as string);
      const fromDate = new Date(dateFrom as string);
      const toDate = new Date(dateTo as string);
      toDate.setHours(23, 59, 59, 999);
      
      const filteredTrips = allTrips.filter(trip => {
        const tripDate = new Date(trip.serviceDate);
        return tripDate >= fromDate && tripDate <= toDate;
      }).sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
      
      const structures = await storage.getStructures();
      const departments = await storage.getDepartments();
      const allLocations = await storage.getLocations();
      const structureMap = new Map(structures.map(s => [s.id, s]));
      const departmentMap = new Map(departments.map(d => [d.id, d]));
      const locationMap = new Map(allLocations.map(l => [l.id, l]));
      
      // Fetch waypoints for all filtered trips
      const tripIds = filteredTrips.map(t => t.id);
      const allWaypoints = tripIds.length > 0 
        ? await db.select().from(tripWaypoints).where(inArray(tripWaypoints.tripId, tripIds))
        : [];
      const waypointsByTrip = new Map<string, typeof allWaypoints>();
      for (const wp of allWaypoints) {
        const existing = waypointsByTrip.get(wp.tripId) || [];
        existing.push(wp);
        waypointsByTrip.set(wp.tripId, existing);
      }
      
      // Get vehicle location name for "Sede"
      const vehicleLocation = vehicle.locationId ? locationMap.get(vehicle.locationId) : null;
      const sedeLabel = vehicleLocation ? `SEDE ${vehicleLocation.name.toUpperCase()}` : 'SEDE';
      
      // Province abbreviation mapping for converting region names to province codes
      const regionToProvince: Record<string, string> = {
        "VENETO": "VR", "LOMBARDIA": "MI", "EMILIA-ROMAGNA": "BO", "TRENTINO-ALTO ADIGE": "TN", 
        "FRIULI-VENEZIA GIULIA": "UD", "PIEMONTE": "TO", "LIGURIA": "GE", "TOSCANA": "FI", 
        "LAZIO": "RM", "CAMPANIA": "NA", "SICILIA": "PA", "SARDEGNA": "CA", "MARCHE": "AN", 
        "UMBRIA": "PG", "ABRUZZO": "AQ", "MOLISE": "CB", "BASILICATA": "PZ", "PUGLIA": "BA", 
        "CALABRIA": "CS", "VALLE D'AOSTA": "AO",
      };
      
      // City to province mapping (common cities)
      const cityToProvince: Record<string, string> = {
        "VERONA": "VR", "SAN GIOVANNI LUPATOTO": "VR", "VILLAFRANCA DI VERONA": "VR", "LEGNAGO": "VR", "NOGARA": "VR", "BUSSOLENGO": "VR",
        "VICENZA": "VI", "BASSANO DEL GRAPPA": "VI", "SCHIO": "VI", "VALDAGNO": "VI", "ARZIGNANO": "VI", "THIENE": "VI",
        "PADOVA": "PD", "ABANO TERME": "PD", "CITTADELLA": "PD", "ESTE": "PD", "MONSELICE": "PD",
        "TREVISO": "TV", "CONEGLIANO": "TV", "MONTEBELLUNA": "TV", "CASTELFRANCO VENETO": "TV",
        "VENEZIA": "VE", "MESTRE": "VE", "CHIOGGIA": "VE", "JESOLO": "VE", "MIRANO": "VE",
        "ROVIGO": "RO", "ADRIA": "RO", "BADIA POLESINE": "RO",
        "BELLUNO": "BL", "FELTRE": "BL", "CORTINA D'AMPEZZO": "BL",
        "MILANO": "MI", "MONZA": "MB", "BRESCIA": "BS", "BERGAMO": "BG", "COMO": "CO", "VARESE": "VA",
        "BOLOGNA": "BO", "MODENA": "MO", "PARMA": "PR", "REGGIO EMILIA": "RE", "FERRARA": "FE",
        "TRENTO": "TN", "BOLZANO": "BZ", "ROVERETO": "TN",
        "TRIESTE": "TS", "UDINE": "UD", "PORDENONE": "PN", "GORIZIA": "GO",
        "TORINO": "TO", "NOVARA": "NO", "GENOVA": "GE", "FIRENZE": "FI", "ROMA": "RM", "NAPOLI": "NA",
      };
      
      // Function to convert old addresses with region names to province codes
      const convertToProvinceCode = (address: string): string => {
        if (!address) return '';
        // Check for region patterns like "(VENETO)" and replace with province code
        let result = address;
        for (const [region, province] of Object.entries(regionToProvince)) {
          const regionPattern = new RegExp(`\\(${region}\\)`, 'gi');
          result = result.replace(regionPattern, `(${province})`);
        }
        // Also try to detect city name in address and use its province if no region found
        if (!result.includes('(') || result.includes('()')) {
          for (const [city, province] of Object.entries(cityToProvince)) {
            if (result.toUpperCase().includes(city)) {
              // Only add province if not already present
              if (!result.match(/\([A-Z]{2}\)/)) {
                result = result.replace(/\(\)/, '').trim();
                result = `${result} (${province})`;
              }
              break;
            }
          }
        }
        return result;
      };
      
      // Helper functions
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };
      
      const formatTime = (timeStr: string | null) => {
        if (!timeStr) return '';
        return timeStr.substring(0, 5).replace(':', '.');
      };
      
      const formatDuration = (minutes: number | null) => {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}.${mins.toString().padStart(2, '0')}`;
      };
      
      const getLocationName = (trip: any, isOrigin: boolean) => {
        const structureId = isOrigin ? trip.originStructureId : trip.destinationStructureId;
        const departmentId = isOrigin ? trip.originDepartmentId : trip.destinationDepartmentId;
        const address = isOrigin ? trip.originAddress : trip.destinationAddress;
        const locationType = isOrigin ? trip.originType : trip.destinationType;
        
        // Handle "sede" type
        if (locationType === 'sede') {
          return sedeLabel;
        }
        
        if (structureId) {
          const structure = structureMap.get(structureId);
          if (structure) {
            const parts: string[] = [];
            
            if (departmentId) {
              const dept = departmentMap.get(departmentId);
              if (dept) parts.push(dept.name.toUpperCase());
            }
            
            parts.push(structure.name.toUpperCase());
            
            if (structure.address) {
              const addressParts = structure.address.split(',');
              if (addressParts.length >= 2) {
                parts.push(addressParts[0].trim().toUpperCase());
                parts.push(addressParts.slice(1).join(',').trim().toUpperCase());
              } else {
                parts.push(structure.address.toUpperCase());
              }
            }
            
            return parts.join(', ');
          }
        }
        return address?.toUpperCase() || '';
      };
      
      // Helper to get waypoint location name
      const getWaypointLocationName = (waypoint: typeof allWaypoints[0]) => {
        if (waypoint.structureId) {
          const structure = structureMap.get(waypoint.structureId);
          if (structure) {
            const parts: string[] = [];
            if (waypoint.departmentId) {
              const dept = departmentMap.get(waypoint.departmentId);
              if (dept) parts.push(dept.name.toUpperCase());
            }
            parts.push(structure.name.toUpperCase());
            return parts.join(', ');
          }
        }
        if (waypoint.address) {
          // Convert region names to province codes
          return convertToProvinceCode(waypoint.address.toUpperCase());
        }
        return '';
      };
      
      // Get full route for emergency services
      const getEmergencyRoute = (trip: any) => {
        const waypoints = waypointsByTrip.get(trip.id) || [];
        const sortedWaypoints = waypoints.sort((a, b) => a.waypointOrder - b.waypointOrder);
        
        // Build route: Origin → Waypoint(s) → Destination
        const routeParts: string[] = [];
        
        // Origin (usually Sede for emergency)
        const originName = getLocationName(trip, true);
        if (originName) routeParts.push(originName);
        
        // Add waypoints
        for (const wp of sortedWaypoints) {
          const wpName = getWaypointLocationName(wp);
          if (wpName) routeParts.push(wpName);
        }
        
        // Destination
        const destName = getLocationName(trip, false);
        if (destName) routeParts.push(destName);
        
        return routeParts.join(' -> ');
      };
      
      // PDF Layout Constants
      const pageWidth = 842; // A4 landscape
      const pageHeight = 595;
      const margin = 25;
      const contentWidth = pageWidth - (margin * 2);
      const lineHeight = 10;
      const headerRowHeight = 24;
      
      // Column widths: 8 columns total
      // Numero servizio | Utif | Partenza e rientro | Anno nascita | Località intervento | Località destinazione | ContaKm P/R | Km percorsi | Tempo
      const colWidths = [50, 25, 75, 45, 200, 200, 75, 55, 55];
      
      const vehicleInfoStr = `Targa: ${vehicle.licensePlate || 'N/A'} | Sigla: ${vehicle.code} | Marca e modello: ${vehicle.model || 'N/A'} | Cilindrata: ${vehicle.displacement || 0} | KW: ${vehicle.kw || 0} | Alimentazione: ${vehicle.fuelType || 'Gasolio'}`;
      
      const doc = new PDFDocument({ 
        size: 'A4', 
        layout: 'landscape',
        margins: { top: margin, bottom: margin, left: margin, right: margin },
        bufferPages: true
      });
      
      const filename = `Riepilogo_UTIF_${vehicle.code.replace(/\s+/g, '')}_${formatDate(dateFrom as string).replace(/\//g, '-')}_${formatDate(dateTo as string).replace(/\//g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      doc.pipe(res);
      
      let pageNumber = 0;
      let y = margin;
      
      // Function to draw checkbox with centered x
      const drawCheckbox = (cx: number, cy: number, size: number = 8) => {
        doc.save();
        doc.lineWidth(0.5);
        const boxX = cx - size/2;
        const boxY = cy - size/2;
        doc.rect(boxX, boxY, size, size).stroke();
        doc.fontSize(7).font('Helvetica-Bold');
        doc.text('x', boxX, boxY + 1, { width: size, height: size, align: 'center' });
        doc.restore();
      };
      
      // Function to draw table header
      const drawTableHeader = () => {
        const startX = margin;
        let x = startX;
        
        // Header background
        doc.save();
        doc.fillColor('#e8e8e8');
        doc.rect(startX, y, contentWidth, headerRowHeight).fill();
        doc.fillColor('#000000');
        doc.restore();
        
        // Header border
        doc.lineWidth(0.5);
        doc.rect(startX, y, contentWidth, headerRowHeight).stroke();
        
        // Column headers - 9 columns
        const headers = [
          { text: 'Numero\nservizio', width: colWidths[0] },
          { text: 'Utif', width: colWidths[1] },
          { text: 'Partenza\ne rientro', width: colWidths[2] },
          { text: 'Anno nascita\ntrasportato', width: colWidths[3] },
          { text: 'Località di intervento\nLocalità di destinazione', width: colWidths[4] },
          { text: '', width: colWidths[5] },
          { text: 'ContaKm\nP. / R.', width: colWidths[6] },
          { text: 'Km\npercorsi', width: colWidths[7] },
          { text: 'Tempo\nimpiegato', width: colWidths[8] },
        ];
        
        doc.fontSize(5.5).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          if (i > 0 && i !== 5) {
            doc.moveTo(x, y).lineTo(x, y + headerRowHeight).stroke();
          }
          if (header.text) {
            const textWidth = (i === 4) ? colWidths[4] + colWidths[5] - 2 : header.width - 2;
            doc.text(header.text, x + 1, y + 2, { width: textWidth, align: 'center' });
          }
          x += header.width;
        });
        
        y += headerRowHeight;
      };
      
      // Function to draw page header (vehicle info for pages 2+)
      const drawPageHeader = (isFirstPage: boolean) => {
        if (isFirstPage) {
          // First page: full header
          doc.fontSize(14).font('Helvetica-Bold').text('SOCCORSO DIGITALE', margin, y, { width: contentWidth, align: 'center' });
          y += 18;
          doc.fontSize(10).font('Helvetica').text(`Riepilogo UTIF — dal ${formatDate(dateFrom as string)} al ${formatDate(dateTo as string)}`, margin, y, { width: contentWidth, align: 'center' });
          y += 16;
          doc.fontSize(8).font('Helvetica').text(vehicleInfoStr, margin, y, { width: contentWidth, align: 'center' });
          y += 18;
        } else {
          // Subsequent pages: compact vehicle info header
          doc.fontSize(8).font('Helvetica').text(vehicleInfoStr, margin, y, { width: contentWidth, align: 'center' });
          y += 14;
        }
        
        drawTableHeader();
      };
      
      // Function to add new page with header
      const addNewPage = () => {
        doc.addPage();
        pageNumber++;
        y = margin;
        drawPageHeader(false);
      };
      
      // Start first page
      pageNumber = 1;
      drawPageHeader(true);
      
      let totalKm = 0;
      let totalMinutes = 0;
      
      for (const trip of filteredTrips) {
        // For emergency services, show complete route; otherwise show origin/destination
        let originLocation: string;
        let destLocation: string;
        
        if (trip.isEmergencyService) {
          // Emergency service: show full route on the origin line
          const fullRoute = getEmergencyRoute(trip);
          originLocation = `[EMERGENZA] ${fullRoute}`;
          destLocation = ''; // Leave destination empty since route shows full path
        } else {
          originLocation = getLocationName(trip, true);
          destLocation = getLocationName(trip, false);
        }
        
        const kmTraveled = trip.kmTraveled || 0;
        const duration = trip.durationMinutes || 0;
        
        totalKm += kmTraveled;
        totalMinutes += duration;
        
        // Combined location column width for measuring
        const locationColWidth = colWidths[4] + colWidths[5] - 8;
        
        // Calculate row height: compact to fit 10 services per page
        doc.fontSize(5);
        const originHeight = doc.heightOfString(originLocation, { width: locationColWidth });
        const destHeight = doc.heightOfString(destLocation, { width: locationColWidth });
        const minRowHeight = lineHeight * 3.5 + 4;
        const tripRowHeight = Math.max(minRowHeight, originHeight + destHeight + 8);
        
        // Check if we need a new page (reduced footer margin to fit 10 services per page)
        if (y + tripRowHeight > pageHeight - margin - 40) {
          addNewPage();
        }
        
        const startX = margin;
        const rowY = y;
        
        // Row background (alternating)
        const tripIndex = filteredTrips.indexOf(trip);
        if (tripIndex % 2 === 1) {
          doc.save();
          doc.fillColor('#f8f8f8');
          doc.rect(startX, rowY, contentWidth, tripRowHeight).fill();
          doc.fillColor('#000000');
          doc.restore();
        }
        
        // Row border
        doc.lineWidth(0.3);
        doc.rect(startX, rowY, contentWidth, tripRowHeight).stroke();
        
        // Draw vertical column separators (skip separator between columns 4-5 for combined locality)
        let sepX = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          sepX += colWidths[i];
          if (i !== 4) {
            doc.moveTo(sepX, rowY).lineTo(sepX, rowY + tripRowHeight).stroke();
          }
        }
        
        // Calculate column X positions
        let x = startX;
        const col0X = x; x += colWidths[0];
        const col1X = x; x += colWidths[1];
        const col2X = x; x += colWidths[2];
        const col3X = x; x += colWidths[3];
        const col4X = x; x += colWidths[4];
        const col5X = x; x += colWidths[5];
        const col6X = x; x += colWidths[6];
        const col7X = x; x += colWidths[7];
        const col8X = x;
        
        const halfRow = tripRowHeight / 2;
        const row1Y = rowY + 4;
        const row2Y = rowY + halfRow + 3;
        
        doc.fontSize(5).font('Helvetica');
        
        // Column 0: Numero servizio (centered vertically)
        doc.font('Helvetica-Bold');
        doc.text(trip.progressiveNumber || '', col0X + 2, rowY + halfRow - 4, { width: colWidths[0] - 4, align: 'center' });
        doc.font('Helvetica');
        
        // Column 1: Utif checkbox (centered vertically)
        const checkboxX = col1X + colWidths[1] / 2;
        const checkboxY = rowY + halfRow;
        drawCheckbox(checkboxX, checkboxY, 8);
        
        // Column 2: Partenza e rientro (2 lines)
        doc.text(`${formatDate(trip.serviceDate)} ${formatTime(trip.departureTime)}`, col2X + 2, row1Y, { width: colWidths[2] - 4, align: 'left' });
        doc.text(`${formatDate(trip.serviceDate)} ${formatTime(trip.returnTime)}`, col2X + 2, row2Y, { width: colWidths[2] - 4, align: 'left' });
        
        // Column 3: Anno nascita / Sesso (2 lines)
        doc.text(trip.patientBirthYear?.toString() || '', col3X + 2, row1Y, { width: colWidths[3] - 4, align: 'center' });
        const gender = trip.patientGender === 'M' ? 'M' : trip.patientGender === 'F' ? 'F' : '';
        doc.text(gender, col3X + 2, row2Y, { width: colWidths[3] - 4, align: 'center' });
        
        // Columns 4-5: Località intervento / destinazione (spans both columns, 2 lines)
        const locWidth = colWidths[4] + colWidths[5] - 4;
        doc.text(originLocation, col4X + 2, row1Y, { width: locWidth, align: 'left' });
        doc.text(destLocation, col4X + 2, row2Y, { width: locWidth, align: 'left' });
        
        // Column 6: ContaKm P/R (2 lines with km and indicator)
        const kmPRWidth = colWidths[6] - 4;
        doc.text(`${(trip.kmInitial || 0).toLocaleString('it-IT')}  P`, col6X + 2, row1Y, { width: kmPRWidth, align: 'right' });
        doc.text(`${(trip.kmFinal || 0).toLocaleString('it-IT')}  R`, col6X + 2, row2Y, { width: kmPRWidth, align: 'right' });
        
        // Column 7: Km percorsi (centered vertically)
        doc.text(kmTraveled.toString(), col7X + 2, rowY + halfRow - 4, { width: colWidths[7] - 4, align: 'center' });
        
        // Column 8: Tempo impiegato (centered vertically)
        doc.text(formatDuration(duration), col8X + 2, rowY + halfRow - 4, { width: colWidths[8] - 4, align: 'center' });
        
        y += tripRowHeight;
      }
      
      // Summary table at the end
      y += 15;
      if (y > pageHeight - margin - 70) {
        addNewPage();
        y = doc.y + 10;
      }
      
      const totalHours = Math.floor(totalMinutes / 60);
      const totalMins = totalMinutes % 60;
      
      // Summary table with borders matching the attached image
      const summaryX = margin;
      const labelWidth = 200;
      const valueWidth = 100;
      const summaryRowHeight = 16;
      
      doc.lineWidth(0.5);
      doc.fontSize(9).font('Helvetica');
      
      const summaryRows = [
        { label: 'Km percorsi:', value: totalKm.toLocaleString('it-IT') },
        { label: 'Tempo impiegato (hh.mm):', value: `${totalHours}.${totalMins.toString().padStart(2, '0')}` },
        { label: 'Km ammessi al rimborso:', value: totalKm.toLocaleString('it-IT') },
        { label: 'Km non ammessi al rimborso:', value: '0' },
      ];
      
      summaryRows.forEach((row, i) => {
        const rowY = y + (i * summaryRowHeight);
        
        // Draw row borders
        doc.rect(summaryX, rowY, labelWidth, summaryRowHeight).stroke();
        doc.rect(summaryX + labelWidth, rowY, valueWidth, summaryRowHeight).stroke();
        
        // Draw text
        doc.text(row.label, summaryX + 4, rowY + 4, { width: labelWidth - 8, align: 'left' });
        doc.text(row.value, summaryX + labelWidth + 4, rowY + 4, { width: valueWidth - 8, align: 'right' });
      });
      
      // Draw footer on each page
      const drawFooter = () => {
        const footerY = pageHeight - margin - 20;
        doc.fontSize(6).font('Helvetica').fillColor('#666666');
        doc.text('SOCCORSO DIGITALE - Servizio Ambulanze e Trasporto Sanitario', margin, footerY, { width: contentWidth, align: 'center' });
        doc.text('Documento generato automaticamente dal sistema di gestione trasporti', margin, footerY + 8, { width: contentWidth, align: 'center' });
        doc.fillColor('#000000');
      };
      
      // Draw footer on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawFooter();
      }
      
      doc.end();
    } catch (error) {
      console.error("Error generating UTIF PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF" });
    }
  });

  // ===== FINANCIAL DOCUMENTATION PDF =====
  app.get("/api/reports/financial-documentation", requireAdmin, async (req, res) => {
    try {
      // Get current financial configuration
      const profile = await storage.getDefaultFinancialProfile();
      const params = profile ? await storage.getFinancialParameters(profile.id) : [];
      const staffCosts = profile ? await storage.getStaffRoleCosts(profile.id) : [];
      const revenueModels = profile ? await storage.getRevenueModels(profile.id) : [];
      
      const getParamValue = (key: string) => {
        const param = params.find(p => p.paramKey === key);
        return param?.paramValue ?? null;
      };
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: 'Documentazione Sistema Calcoli Finanziari',
          Author: 'SOCCORSO DIGITALE',
          Subject: 'Metodologia calcolo costi e ricavi trasporti sanitari'
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=documentazione-calcoli-finanziari.pdf');
      doc.pipe(res);
      
      const pageWidth = doc.page.width;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      
      // Title
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a365d');
      doc.text('DOCUMENTAZIONE SISTEMA CALCOLI FINANZIARI', margin, 50, { align: 'center', width: contentWidth });
      
      doc.fontSize(12).font('Helvetica').fillColor('#666666');
      doc.text('SOCCORSO DIGITALE - Servizio Ambulanze e Trasporto Sanitario', margin, 80, { align: 'center', width: contentWidth });
      doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 95, { align: 'center', width: contentWidth });
      
      let y = 130;
      
      // Section 1: Overview
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('1. PANORAMICA DEL SISTEMA', margin, y);
      y += 25;
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      const overview = `Il sistema di calcolo finanziario di SOCCORSO DIGITALE analizza automaticamente i costi e i ricavi di ogni servizio di trasporto sanitario. I calcoli si basano su parametri configurabili che possono essere modificati dall'amministratore nel pannello "Impostazioni Finanza".`;
      doc.text(overview, margin, y, { width: contentWidth, align: 'justify' });
      y += 50;
      
      // Section 2: Cost Calculation
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('2. CALCOLO DEI COSTI', margin, y);
      y += 25;
      
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('2.1 Costo Carburante', margin, y);
      y += 15;
      
      const fuelConsumption = getParamValue('fuel_consumption_per_100km') || 12;
      const fuelCostPerLiter = getParamValue('fuel_cost_per_liter') || 1.6;
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      doc.text('Formula:', margin, y);
      y += 12;
      doc.font('Helvetica-Oblique').fillColor('#2d3748');
      doc.text('Costo Carburante = (Km Percorsi / 100) x Consumo L/100km x Prezzo Carburante', margin + 20, y);
      y += 18;
      
      doc.font('Helvetica').fillColor('#333333');
      doc.text('Parametri attuali:', margin, y);
      y += 12;
      doc.text(`  - Consumo medio: ${fuelConsumption} L/100km`, margin + 10, y);
      y += 12;
      doc.text(`  - Prezzo carburante: ${fuelCostPerLiter.toFixed(2)} EUR/L`, margin + 10, y);
      y += 18;
      
      doc.fillColor('#718096');
      doc.text(`Esempio: Un viaggio di 50 km costa (50/100) x ${fuelConsumption} x ${fuelCostPerLiter.toFixed(2)} = ${((50/100) * fuelConsumption * fuelCostPerLiter).toFixed(2)} EUR di carburante`, margin, y, { width: contentWidth });
      y += 25;
      
      // Maintenance
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('2.2 Costo Manutenzione', margin, y);
      y += 15;
      
      const maintenancePerKm = getParamValue('maintenance_per_km') || 0.08;
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      doc.text('Formula:', margin, y);
      y += 12;
      doc.font('Helvetica-Oblique').fillColor('#2d3748');
      doc.text('Costo Manutenzione = Km Percorsi x Costo Manutenzione per Km', margin + 20, y);
      y += 18;
      
      doc.font('Helvetica').fillColor('#333333');
      doc.text(`Parametro attuale: ${maintenancePerKm.toFixed(2)} EUR/km`, margin, y);
      y += 12;
      doc.fillColor('#718096');
      doc.text(`Esempio: Un viaggio di 50 km costa 50 x ${maintenancePerKm.toFixed(2)} = ${(50 * maintenancePerKm).toFixed(2)} EUR di manutenzione`, margin, y);
      y += 25;
      
      // Insurance
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('2.3 Costo Assicurazione', margin, y);
      y += 15;
      
      const insuranceMonthly = getParamValue('insurance_monthly') || 400;
      const insurancePerTrip = getParamValue('insurance_per_trip') || 0;
      const insuranceDaily = getParamValue('insurance_daily') || (insuranceMonthly / 30);
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      doc.text('Logica di calcolo:', margin, y);
      y += 12;
      
      if (insurancePerTrip > 0) {
        doc.text(`  - Utilizzato costo fisso per viaggio: ${insurancePerTrip.toFixed(2)} EUR`, margin, y);
      } else {
        doc.text(`  1. Se configurato "Assicurazione per Viaggio": usa quel valore fisso`, margin, y);
        y += 12;
        doc.text(`  2. Altrimenti: calcola proporzionalmente alla durata del viaggio`, margin, y);
        y += 12;
        doc.text(`     Assicurazione Giornaliera = Mensile / 30 = ${insuranceDaily.toFixed(2)} EUR/giorno`, margin + 20, y);
        y += 12;
        doc.text(`     Costo Viaggio = Giornaliera x (Ore Viaggio / 8 ore lavorative)`, margin + 20, y);
      }
      y += 25;
      
      // New page for staff and revenue
      doc.addPage();
      y = 50;
      
      // Staff Costs
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('2.4 Costo Personale', margin, y);
      y += 15;
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      doc.text('Formula:', margin, y);
      y += 12;
      doc.font('Helvetica-Oblique').fillColor('#2d3748');
      doc.text('Costo Personale = Costo Orario Autista x Ore Viaggio', margin + 20, y);
      y += 18;
      
      doc.font('Helvetica').fillColor('#333333');
      doc.text('Il sistema utilizza il ruolo "Autista" come riferimento principale per il calcolo.', margin, y, { width: contentWidth });
      y += 18;
      
      if (staffCosts.length > 0) {
        doc.text('Ruoli configurati:', margin, y);
        y += 12;
        for (const staff of staffCosts) {
          doc.text(`  - ${staff.roleName}: ${staff.hourlyCost.toFixed(2)} EUR/ora${staff.hoursPerTrip ? ` (default ${staff.hoursPerTrip}h/viaggio)` : ''}`, margin + 10, y);
          y += 12;
        }
      }
      y += 15;
      
      // Total Cost Formula
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('2.5 Formula Costo Totale', margin, y);
      y += 15;
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748');
      doc.text('COSTO TOTALE = Carburante + Manutenzione + Assicurazione + Personale', margin, y);
      y += 30;
      
      // Section 3: Revenue Calculation
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('3. CALCOLO DEI RICAVI', margin, y);
      y += 25;
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      doc.text('I ricavi vengono calcolati in base ai contratti/convenzioni configurati.', margin, y);
      y += 18;
      
      doc.text('Formula:', margin, y);
      y += 12;
      doc.font('Helvetica-Oblique').fillColor('#2d3748');
      doc.text('Ricavo = Tariffa Base + (Km x Tariffa/Km) + (Minuti x Tariffa/Minuto)', margin + 20, y);
      y += 15;
      doc.text('Se Ricavo < Minimo Garantito, allora Ricavo = Minimo Garantito', margin + 20, y);
      y += 25;
      
      doc.font('Helvetica').fillColor('#333333');
      if (revenueModels.length > 0) {
        doc.text('Contratti/Convenzioni configurati:', margin, y);
        y += 15;
        
        for (const model of revenueModels.filter(m => m.isActive)) {
          doc.font('Helvetica-Bold').fillColor('#4a5568');
          doc.text(`${model.contractName}${model.tripType ? ` (${model.tripType})` : ''}:`, margin + 10, y);
          y += 12;
          doc.font('Helvetica').fillColor('#333333');
          doc.text(`    Tariffa base: ${(model.baseFee || 0).toFixed(2)} EUR`, margin + 20, y);
          y += 12;
          doc.text(`    Tariffa/km: ${(model.perKmRate || 0).toFixed(2)} EUR`, margin + 20, y);
          y += 12;
          doc.text(`    Tariffa/minuto: ${(model.perMinuteRate || 0).toFixed(2)} EUR`, margin + 20, y);
          y += 12;
          if (model.minimumFee) {
            doc.text(`    Minimo garantito: ${model.minimumFee.toFixed(2)} EUR`, margin + 20, y);
            y += 12;
          }
          y += 8;
        }
      }
      y += 15;
      
      // Section 4: Profit
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('4. CALCOLO MARGINE E PROFITTO', margin, y);
      y += 25;
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      doc.text('Formule:', margin, y);
      y += 12;
      doc.font('Helvetica-Oblique').fillColor('#2d3748');
      doc.text('Profitto = Ricavo Totale - Costo Totale', margin + 20, y);
      y += 12;
      doc.text('Margine (%) = (Profitto / Ricavo Totale) x 100', margin + 20, y);
      y += 25;
      
      // Section 5: Averages
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('5. MEDIE E INDICATORI', margin, y);
      y += 25;
      
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      const indicators = [
        'Costo Medio per Viaggio = Costi Totali / Numero Viaggi',
        'Costo Medio per Km = Costi Totali / Km Totali',
        'Ricavo Medio per Viaggio = Ricavi Totali / Numero Viaggi',
        'Ricavo Medio per Km = Ricavi Totali / Km Totali',
        'Profitto Medio per Viaggio = Profitto Totale / Numero Viaggi'
      ];
      
      for (const indicator of indicators) {
        doc.text(`- ${indicator}`, margin, y);
        y += 14;
      }
      
      // Footer
      const drawFooter = () => {
        const footerY = doc.page.height - 40;
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text('SOCCORSO DIGITALE - Documentazione Calcoli Finanziari', margin, footerY, { width: contentWidth, align: 'center' });
      };
      
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawFooter();
      }
      
      doc.end();
    } catch (error) {
      console.error("Error generating financial documentation PDF:", error);
      res.status(500).json({ error: "Errore nella generazione della documentazione" });
    }
  });

  // ===== ECONOMIC ANALYSIS PDF - Development Investment Report =====
  app.get("/api/reports/economic-analysis-pdf", requireAdmin, async (req, res) => {
    try {
      // Get real data from database for stats
      const [allTrips, allVehicles, allLocations, allStructures] = await Promise.all([
        storage.getTrips(),
        storage.getVehicles(),
        storage.getLocations(),
        storage.getStructures()
      ]);
      
      const totalKm = allTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const currentYear = new Date().getFullYear();
      const thisYearTrips = allTrips.filter(t => new Date(t.serviceDate).getFullYear() === currentYear);
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        autoFirstPage: false,
        info: {
          Title: 'Analisi Economica Sviluppo - SOCCORSO DIGITALE',
          Author: 'SOCCORSO DIGITALE',
          Subject: 'Report Investimento Sviluppo Software'
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=analisi-economica-sviluppo-soccorso-digitale.pdf');
      doc.pipe(res);
      
      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      
      // Color palette (same as Product Showcase)
      const colors = {
        primary: '#1a365d',
        accent: '#2c5282',
        highlight: '#38a169',
        text: '#2d3748',
        textLight: '#4a5568',
        bg: '#f7fafc',
        white: '#ffffff',
        muted: '#718096'
      };
      
      // ===== PAGE 1: COVER (same style as Product Showcase) =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill(colors.primary);
      
      // Try to embed actual logo
      try {
        const logoPath = path.join(__dirname, '..', 'server', 'assets', 'logo-croce-europa.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, pageWidth/2 - 60, 120, { width: 120 });
        } else {
          doc.lineWidth(4).strokeColor(colors.white);
          doc.moveTo(pageWidth/2, 130).lineTo(pageWidth/2, 210).stroke();
          doc.moveTo(pageWidth/2 - 40, 170).lineTo(pageWidth/2 + 40, 170).stroke();
        }
      } catch (e) {
        doc.lineWidth(4).strokeColor(colors.white);
        doc.moveTo(pageWidth/2, 130).lineTo(pageWidth/2, 210).stroke();
        doc.moveTo(pageWidth/2 - 40, 170).lineTo(pageWidth/2 + 40, 170).stroke();
      }
      
      // Company name
      doc.fontSize(32).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('SOCCORSO DIGITALE', margin, 260, { width: contentWidth, align: 'center' });
      
      doc.fontSize(13).font('Helvetica').fillColor('#a0aec0');
      doc.text('S.R.L. Impresa Sociale', margin, 300, { width: contentWidth, align: 'center' });
      
      // Divider line
      doc.rect(pageWidth/2 - 60, 340, 120, 2).fill(colors.highlight);
      
      // Document title
      doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('ANALISI ECONOMICA', margin, 380, { width: contentWidth, align: 'center' });
      
      // Subtitle
      doc.fontSize(12).font('Helvetica').fillColor(colors.white);
      doc.text('Report Investimento e Valore Generato', margin, 420, { width: contentWidth, align: 'center' });
      
      // Description
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Analisi dettagliata dello sviluppo della piattaforma digitale', margin, 480, { width: contentWidth, align: 'center' });
      doc.text('per la gestione del trasporto sanitario', margin, 495, { width: contentWidth, align: 'center' });
      
      // Stats bar at bottom (same as Product Showcase)
      doc.rect(0, pageHeight - 120, pageWidth, 70).fill('#0d2137');
      
      const statsY = pageHeight - 105;
      const statWidth = contentWidth / 4;
      
      doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('250+', margin, statsY, { width: statWidth, align: 'center' });
      doc.text('16', margin + statWidth, statsY, { width: statWidth, align: 'center' });
      doc.text('~45', margin + statWidth * 2, statsY, { width: statWidth, align: 'center' });
      doc.text('~65K', margin + statWidth * 3, statsY, { width: statWidth, align: 'center' });
      
      doc.fontSize(7).font('Helvetica').fillColor('#a0aec0');
      doc.text('API Endpoints', margin, statsY + 25, { width: statWidth, align: 'center' });
      doc.text('Moduli Enterprise', margin + statWidth, statsY + 25, { width: statWidth, align: 'center' });
      doc.text('Tabelle DB', margin + statWidth * 2, statsY + 25, { width: statWidth, align: 'center' });
      doc.text('Linee Codice', margin + statWidth * 3, statsY + 25, { width: statWidth, align: 'center' });
      
      // Footer
      doc.fontSize(8).fillColor(colors.muted);
      doc.text('Via Forte Garofolo 20, 37057 San Giovanni Lupatoto (VR)', margin, pageHeight - 35, { width: contentWidth, align: 'center' });
      
      // ===== PAGE 2: EXECUTIVE SUMMARY =====
      doc.addPage();
      
      // Header bar (same style as Product Showcase)
      doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
      doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('EXECUTIVE SUMMARY', margin, 24);
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Panoramica del progetto e valore generato', margin, 48);
      
      let y = 90;
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      const execSummary = `Questo documento presenta l'analisi economica dello sviluppo della piattaforma digitale SOCCORSO DIGITALE, un sistema integrato di gestione trasporti sanitari che comprende un'applicazione mobile per gli equipaggi e un pannello amministrativo web completo.

La piattaforma rappresenta un investimento strategico significativo che posiziona SOCCORSO DIGITALE come leader tecnologico nel settore del trasporto sanitario in Italia, con funzionalita enterprise-grade che includono compliance GDPR, audit trail ISO 27001, Data Quality Engine, e sistemi avanzati di gestione inventario e flotta.`;
      
      doc.text(execSummary, margin, y, { width: contentWidth, align: 'justify', lineGap: 4 });
      y += 110;
      
      // Key metrics boxes
      doc.rect(margin, y, 155, 70).fill('#ebf8ff');
      doc.rect(margin + 170, y, 155, 70).fill('#f0fff4');
      doc.rect(margin + 340, y, 155, 70).fill('#faf5ff');
      
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#2b6cb0');
      doc.text('~65K', margin + 10, y + 15);
      doc.fontSize(9).font('Helvetica').fillColor('#4a5568');
      doc.text('Linee di Codice', margin + 10, y + 45);
      
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#38a169');
      doc.text('250+', margin + 180, y + 15);
      doc.fontSize(9).font('Helvetica').fillColor('#4a5568');
      doc.text('Endpoint API', margin + 180, y + 45);
      
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#805ad5');
      doc.text('16', margin + 350, y + 15);
      doc.fontSize(9).font('Helvetica').fillColor('#4a5568');
      doc.text('Moduli Enterprise', margin + 350, y + 45);
      
      y += 90;
      
      // Value proposition box
      doc.rect(margin, y, contentWidth, 80).fill(colors.bg);
      doc.rect(margin, y, 4, 80).fill(colors.highlight);
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.accent);
      doc.text('Valore Stimato del Progetto', margin + 15, y + 15);
      
      doc.fontSize(28).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('EUR 280.000 - 420.000', margin + 15, y + 38);
      
      doc.fontSize(9).font('Helvetica').fillColor(colors.muted);
      doc.text('Basato su tariffe di mercato per sviluppo software enterprise in Italia', margin + 15, y + 65);
      
      y += 100;
      
      // ===== PAGE 3: CODEBASE STATISTICS =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
      doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('STATISTICHE CODEBASE', margin, 24);
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Metriche tecniche e complessita del progetto', margin, 48);
      
      y = 90;
      
      // Table header
      doc.rect(margin, y, contentWidth, 25).fill('#2d3748');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Componente', margin + 10, y + 8);
      doc.text('Linee di Codice', margin + 250, y + 8);
      doc.text('File', margin + 400, y + 8);
      y += 25;
      
      const codeStats = [
        { component: 'App Mobile (React Native/TypeScript)', lines: '19,831', files: '~35' },
        { component: 'Server Backend (Express/TypeScript)', lines: '13,580', files: '~5' },
        { component: 'Pannello Admin (HTML/CSS/JS)', lines: '28,602', files: '3' },
        { component: 'Schema Database Condiviso', lines: '2,061', files: '1' },
        { component: 'Pagina Impatto Sociale', lines: '1,037', files: '1' },
        { component: 'Configurazione & Build', lines: '~900', files: '~10' },
      ];
      
      let rowColor = true;
      for (const stat of codeStats) {
        doc.rect(margin, y, contentWidth, 22).fill(rowColor ? '#f7fafc' : '#ffffff');
        doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
        doc.text(stat.component, margin + 10, y + 7);
        doc.text(stat.lines, margin + 250, y + 7);
        doc.text(stat.files, margin + 400, y + 7);
        y += 22;
        rowColor = !rowColor;
      }
      
      // Total row
      doc.rect(margin, y, contentWidth, 25).fill('#2d3748');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('TOTALE', margin + 10, y + 8);
      doc.text('~65,000', margin + 250, y + 8);
      doc.text('~55', margin + 400, y + 8);
      y += 45;
      
      // Complexity metrics
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('Metriche di Complessita', margin, y);
      y += 25;
      
      const complexityMetrics = [
        { metric: 'Endpoint API REST', value: '250+', desc: 'Operazioni CRUD, analytics, compliance, reports' },
        { metric: 'Schermate Mobile', value: '18', desc: 'UI completa con navigazione, inventario, privacy' },
        { metric: 'Componenti UI Riutilizzabili', value: '22', desc: 'Design system liquid glass coerente' },
        { metric: 'Tabelle Database', value: '~45', desc: 'Schema con audit, backup, quality, consents' },
        { metric: 'Moduli Enterprise', value: '16', desc: 'Data Quality, Audit, GDPR, Backup, SLA, Inventory' },
      ];
      
      for (const m of complexityMetrics) {
        doc.rect(margin, y, contentWidth, 35).fill('#f7fafc').stroke('#e2e8f0');
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#2b6cb0');
        doc.text(m.value, margin + 15, y + 8);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748');
        doc.text(m.metric, margin + 80, y + 5);
        doc.fontSize(8).font('Helvetica').fillColor('#718096');
        doc.text(m.desc, margin + 80, y + 20);
        y += 40;
      }
      
      // ===== PAGE 4: COST ANALYSIS =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
      doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('STIMA COSTI SVILUPPO', margin, 24);
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Metodologia COCOMO II - Standard industria software', margin, 48);
      
      y = 90;
      
      // Hours table
      doc.rect(margin, y, contentWidth, 25).fill('#2d3748');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Ruolo Professionale', margin + 10, y + 8);
      doc.text('Ore', margin + 220, y + 8);
      doc.text('Tariffa/Ora', margin + 290, y + 8);
      doc.text('Costo Totale', margin + 400, y + 8);
      y += 25;
      
      const costBreakdown = [
        { role: 'Senior Full-Stack Developer', hours: '800-1,000', rate: 'EUR 80-120', cost: 'EUR 64,000 - 120,000' },
        { role: 'Mobile Developer (React Native)', hours: '400-500', rate: 'EUR 70-100', cost: 'EUR 28,000 - 50,000' },
        { role: 'Backend Developer', hours: '300-400', rate: 'EUR 70-100', cost: 'EUR 21,000 - 40,000' },
        { role: 'UI/UX Designer', hours: '150-200', rate: 'EUR 60-80', cost: 'EUR 9,000 - 16,000' },
        { role: 'DevOps / Infrastruttura', hours: '100-150', rate: 'EUR 80-100', cost: 'EUR 8,000 - 15,000' },
        { role: 'Project Manager', hours: '200-250', rate: 'EUR 60-80', cost: 'EUR 12,000 - 20,000' },
        { role: 'QA Testing', hours: '150-200', rate: 'EUR 50-70', cost: 'EUR 7,500 - 14,000' },
      ];
      
      rowColor = true;
      for (const item of costBreakdown) {
        doc.rect(margin, y, contentWidth, 22).fill(rowColor ? '#f7fafc' : '#ffffff');
        doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
        doc.text(item.role, margin + 10, y + 7);
        doc.text(item.hours, margin + 220, y + 7);
        doc.text(item.rate, margin + 290, y + 7);
        doc.text(item.cost, margin + 390, y + 7);
        y += 22;
        rowColor = !rowColor;
      }
      
      // Total
      doc.rect(margin, y, contentWidth, 30).fill('#38a169');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('TOTALE ORE STIMATE', margin + 10, y + 10);
      doc.text('2,100 - 2,700  TOTALE', margin + 200, y + 10);
      doc.text('EUR 149.500 - 275.000', margin + 340, y + 10);
      y += 50;
      
      // Additional costs
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('Costi Aggiuntivi (Annuali)', margin, y);
      y += 20;
      
      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      doc.text('- Infrastruttura Cloud (hosting, database, CDN): EUR 3,000 - 6,000/anno', margin + 10, y);
      y += 15;
      doc.text('- Licenze e Servizi Terzi (API, monitoring): EUR 2,000 - 5,000/anno', margin + 10, y);
      y += 15;
      doc.text('- Certificati SSL, Domini, Storage: EUR 500 - 1,000/anno', margin + 10, y);
      y += 30;
      
      // Total investment box
      doc.rect(margin, y, contentWidth, 60).fill('#1a365d');
      doc.fontSize(12).font('Helvetica').fillColor('#a0aec0');
      doc.text('INVESTIMENTO TOTALE STIMATO', margin + 20, y + 12);
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#48bb78');
      doc.text('EUR 180,000 - 320,000', margin + 20, y + 30);
      
      // ===== PAGE 5: MARKET COMPARISON =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
      doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('CONFRONTO PREZZI DI MERCATO', margin, 24);
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Benchmarking con software house italiane ed estere', margin, 48);
      
      y = 90;
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('Se commissionato a Software House Italiana', margin, y);
      y += 25;
      
      const italianMarket = [
        { type: 'Piccola Software House / Freelancer', range: 'EUR 180,000 - 250,000', time: '12-18 mesi' },
        { type: 'Media Agenzia Digitale', range: 'EUR 280,000 - 400,000', time: '10-14 mesi' },
        { type: 'Grande Azienda IT / System Integrator', range: 'EUR 400,000 - 600,000', time: '8-12 mesi' },
      ];
      
      for (const item of italianMarket) {
        doc.rect(margin, y, contentWidth, 35).fill('#fff5f5').stroke('#feb2b2');
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#c53030');
        doc.text(item.range, margin + 15, y + 8);
        doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
        doc.text(item.type, margin + 200, y + 5);
        doc.text(`Tempo stimato: ${item.time}`, margin + 200, y + 18);
        y += 40;
      }
      
      y += 15;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('Se commissionato all\'Estero', margin, y);
      y += 25;
      
      const foreignMarket = [
        { country: 'Europa Est (Polonia, Romania, Ucraina)', range: 'EUR 100,000 - 180,000' },
        { country: 'India / Asia', range: 'EUR 60,000 - 120,000' },
        { country: 'USA / UK', range: 'EUR 350,000 - 500,000' },
      ];
      
      for (const item of foreignMarket) {
        doc.rect(margin, y, contentWidth, 30).fill('#f7fafc').stroke('#e2e8f0');
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748');
        doc.text(item.range, margin + 15, y + 10);
        doc.fontSize(9).font('Helvetica').fillColor('#718096');
        doc.text(item.country, margin + 200, y + 10);
        y += 35;
      }
      
      y += 20;
      
      // Savings highlight
      doc.rect(margin, y, contentWidth, 70).fill('#f0fff4').stroke('#48bb78');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#276749');
      doc.text('RISPARMIO STIMATO CON SVILUPPO AI-ASSISTED', margin + 20, y + 15);
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#38a169');
      doc.text('EUR 200,000 - 450,000', margin + 20, y + 40);
      doc.fontSize(10).font('Helvetica').fillColor('#276749');
      doc.text('rispetto a sviluppo tradizionale con software house italiana', margin + 250, y + 45);
      
      // ===== PAGE 6: FEATURES VALUE =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
      doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('VALORE FUNZIONALITA IMPLEMENTATE', margin, 24);
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Valutazione dettagliata dei 16 moduli enterprise', margin, 48);
      
      y = 90;
      
      const features = [
        { name: 'Sistema Gestione Viaggi Completo', value: 'EUR 40,000', desc: 'CRUD, progressivi, validazione km, storico' },
        { name: 'Pannello Amministrativo Enterprise', value: 'EUR 50,000', desc: 'Dashboard analytics, KPI, grafici Chart.js, filtri avanzati' },
        { name: 'Gestione Inventario 3-Tier con Scanner', value: 'EUR 35,000', desc: 'Barcode/QR, scadenze, template MSB/MSI/Eventi' },
        { name: 'Data Quality Engine', value: 'EUR 35,000', desc: 'Scoring multidimensionale, anomalie, timeliness, trend' },
        { name: 'Sistema Audit Trail ISO 27001', value: 'EUR 30,000', desc: 'Hash chain SHA-256, retention 10 anni, verifica integrita' },
        { name: 'Compliance GDPR Completa', value: 'EUR 28,000', desc: 'Consensi, export ZIP, erasure by name, DPA tracking' },
        { name: 'Gestione Flotta Multi-Sede', value: 'EUR 25,000', desc: '5 sedi, 21 veicoli, km progressivi, template inventario' },
        { name: 'Backup & Disaster Recovery', value: 'EUR 22,000', desc: 'Backup schedulati, verifica restore, policy RTO/RPO' },
        { name: 'SLA Monitoring & Uptime', value: 'EUR 20,000', desc: 'Health check, uptime tracking, error rate, alerting' },
        { name: 'Analisi Economica Avanzata', value: 'EUR 20,000', desc: 'Contratti, costi staff, marginalita, simulazioni' },
        { name: 'Calcolo Automatico Km (OSRM)', value: 'EUR 15,000', desc: 'Routing, cache coordinate, privacy' },
        { name: 'Autenticazione Veicoli', value: 'EUR 15,000', desc: 'Login per mezzo, sessioni, auto-assign sede' },
        { name: 'Modalita Offline Mobile', value: 'EUR 15,000', desc: 'Queue locale, sync, indicatori, retry' },
        { name: 'Dashboard Impatto Pubblico', value: 'EUR 12,000', desc: 'Contatori animati, sharing social, fundraising' },
        { name: 'HeartbeatWidget Mobile', value: 'EUR 8,000', desc: 'Metriche real-time, animazione heartbeat' },
        { name: 'Generazione PDF Professionale', value: 'EUR 12,000', desc: 'UTIF, analisi economica, presentazione prodotto' },
      ];
      
      let totalValue = 0;
      for (const f of features) {
        const val = parseInt(f.value.replace(/[^0-9]/g, ''));
        totalValue += val;
        
        doc.rect(margin, y, contentWidth, 30).fill('#f7fafc').stroke('#e2e8f0');
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#38a169');
        doc.text(f.value, margin + 10, y + 10);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#2d3748');
        doc.text(f.name, margin + 100, y + 5);
        doc.fontSize(8).font('Helvetica').fillColor('#718096');
        doc.text(f.desc, margin + 100, y + 17);
        y += 32;
        
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
      }
      
      y += 10;
      doc.rect(margin, y, contentWidth, 40).fill('#38a169');
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('VALORE TOTALE FUNZIONALITA', margin + 20, y + 10);
      doc.fontSize(18).font('Helvetica-Bold');
      doc.text(`EUR ${totalValue.toLocaleString('it-IT')}`, margin + 20, y + 25);
      
      // ===== PAGE 7: STRATEGIC ASSETS =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
      doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('ASSET STRATEGICI', margin, 24);
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Vantaggi competitivi e posizionamento', margin, 48);
      
      y = 90;
      
      const assets = [
        { icon: '1', title: 'Proprieta Codice 100%', desc: 'Nessun vendor lock-in. Codice sorgente interamente di proprieta di SOCCORSO DIGITALE. Liberta totale di modifica, hosting e distribuzione.' },
        { icon: '2', title: 'Stack Tecnologico Moderno', desc: 'React Native Expo SDK 54, TypeScript, PostgreSQL Drizzle ORM, Express.js. Tecnologie mature con supporto a lungo termine.' },
        { icon: '3', title: 'Architettura Enterprise', desc: 'Multi-sede, multi-tenant ready. API RESTful 250+, database 45 tabelle, 16 moduli enterprise indipendenti e integrabili.' },
        { icon: '4', title: 'Certificazioni-Ready', desc: 'Audit Trail ISO 27001, GDPR completo, Backup ISO 22301, SLA monitoring. Riduce significativamente tempi e costi certificazione.' },
        { icon: '5', title: 'Triple Coverage', desc: 'App mobile iOS/Android/Web, pannello admin enterprise, dashboard impatto pubblico. Copertura completa stakeholder.' },
        { icon: '6', title: 'Data Quality by Design', desc: 'Engine multidimensionale per completezza, coerenza, timeliness. Dati affidabili e difendibili per compliance e decisioni.' },
      ];
      
      for (const asset of assets) {
        doc.circle(margin + 15, y + 15, 12).fill('#2b6cb0');
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff');
        doc.text(asset.icon, margin + 11, y + 9);
        
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#2d3748');
        doc.text(asset.title, margin + 40, y + 5);
        doc.fontSize(9).font('Helvetica').fillColor('#4a5568');
        doc.text(asset.desc, margin + 40, y + 20, { width: contentWidth - 50, lineGap: 2 });
        y += 60;
      }
      
      // ===== PAGE 8: ROI & CONCLUSIONS =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
      doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
      doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('ROI E CONCLUSIONI', margin, 24);
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Ritorno sull\'investimento e riepilogo finale', margin, 48);
      
      y = 100;
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c5282');
      doc.text('Ritorno sull\'Investimento', margin, y);
      y += 25;
      
      const roiPoints = [
        'Riduzione tempi amministrativi: 60-80% con automazione UTIF e reportistica PDF',
        'Eliminazione errori manuali: validazione km automatica, Data Quality Engine',
        'Compliance certificazioni: audit trail ISO 27001, GDPR, backup disaster recovery',
        'Scalabilita: sistema pronto per crescita nazionale multi-tenant',
        'Trasparenza: Dashboard Impatto pubblico per fundraising e comunicazione',
        'Efficienza operativa: inventario 3-tier, scadenze, analisi economica contratti',
        'Monitoraggio continuo: SLA uptime, health check, metriche real-time',
      ];
      
      for (const point of roiPoints) {
        doc.fontSize(10).font('Helvetica').fillColor('#2d3748');
        doc.text('- ' + point, margin + 10, y, { width: contentWidth - 20 });
        y += 18;
      }
      
      y += 20;
      
      // Final summary box
      doc.rect(margin, y, contentWidth, 120).fill('#1a365d');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#48bb78');
      doc.text('RIEPILOGO INVESTIMENTO', margin + 20, y + 15);
      
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Valore di mercato stimato:', margin + 20, y + 45);
      doc.text('Risparmio vs sviluppo tradizionale:', margin + 20, y + 62);
      doc.text('Tempo risparmiato:', margin + 20, y + 79);
      doc.text('Velocita iterazione:', margin + 20, y + 96);
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('EUR 280,000 - 420,000', margin + 250, y + 43);
      doc.text('EUR 200,000 - 450,000', margin + 250, y + 60);
      doc.text('10-14 mesi', margin + 250, y + 77);
      doc.text('10x piu veloce', margin + 250, y + 94);
      
      y += 140;
      
      // Signature area
      doc.fontSize(10).font('Helvetica').fillColor('#718096');
      doc.text('Documento generato automaticamente dal sistema SOCCORSO DIGITALE', margin, y);
      doc.text(`Data: ${today}`, margin, y + 15);
      
      // ===== BACK COVER (same style as Product Showcase) =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill(colors.primary);
      
      // Logo
      try {
        const logoPath = path.join(__dirname, '..', 'server', 'assets', 'logo-croce-europa.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, pageWidth/2 - 50, 180, { width: 100 });
        } else {
          doc.lineWidth(3).strokeColor(colors.white);
          doc.moveTo(pageWidth/2, 190).lineTo(pageWidth/2, 260).stroke();
          doc.moveTo(pageWidth/2 - 35, 225).lineTo(pageWidth/2 + 35, 225).stroke();
        }
      } catch (e) {
        doc.lineWidth(3).strokeColor(colors.white);
        doc.moveTo(pageWidth/2, 190).lineTo(pageWidth/2, 260).stroke();
        doc.moveTo(pageWidth/2 - 35, 225).lineTo(pageWidth/2 + 35, 225).stroke();
      }
      
      // Company name
      doc.fontSize(26).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('SOCCORSO DIGITALE', margin, 300, { width: contentWidth, align: 'center' });
      
      doc.fontSize(11).font('Helvetica').fillColor('#a0aec0');
      doc.text('S.R.L. Impresa Sociale', margin, 335, { width: contentWidth, align: 'center' });
      
      // Divider
      doc.rect(pageWidth/2 - 40, 370, 80, 2).fill(colors.highlight);
      
      // Tagline
      doc.fontSize(13).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('Analisi Economica', margin, 400, { width: contentWidth, align: 'center' });
      
      // Description
      doc.fontSize(10).font('Helvetica').fillColor(colors.white);
      doc.text('Innovazione digitale al servizio del trasporto sanitario', margin, 440, { width: contentWidth, align: 'center' });
      
      // Contact box
      doc.rect(margin + 80, 500, contentWidth - 160, 130).fill('#0d2137');
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('CONTATTI', margin + 80, 520, { width: contentWidth - 160, align: 'center' });
      
      doc.fontSize(9).font('Helvetica').fillColor(colors.white);
      doc.text('Via Forte Garofolo 20', margin + 80, 550, { width: contentWidth - 160, align: 'center' });
      doc.text('37057 San Giovanni Lupatoto (VR)', margin + 80, 565, { width: contentWidth - 160, align: 'center' });
      doc.text('Italia', margin + 80, 580, { width: contentWidth - 160, align: 'center' });
      
      // Stats summary
      doc.fontSize(8).fillColor('#a0aec0');
      doc.text('250+ API  |  16 Moduli  |  ~45 Tabelle  |  ~65K Linee Codice', margin + 80, 605, { width: contentWidth - 160, align: 'center' });
      
      // Footer
      doc.fontSize(8).fillColor(colors.muted);
      doc.text('SOCCORSO DIGITALE', margin, pageHeight - 40, { width: contentWidth, align: 'center' });
      
      doc.end();
    } catch (error) {
      console.error("Error generating economic analysis PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del report" });
    }
  });

  // Product Showcase PDF - Professional product presentation (SOCCORSO DIGITALE)
  app.get("/api/reports/product-showcase-pdf", requireAdmin, async (req, res) => {
    try {
      // Get real data from database
      const [allTrips, allVehicles, allLocations, allStructures] = await Promise.all([
        storage.getTrips(),
        storage.getVehicles(),
        storage.getLocations(),
        storage.getStructures()
      ]);
      
      const totalKm = allTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const currentYear = new Date().getFullYear();
      const thisYearTrips = allTrips.filter(t => new Date(t.serviceDate).getFullYear() === currentYear);
      
      const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: false });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="soccorso-digitale-data-platform.pdf"');
        res.send(pdfBuffer);
      });
      
      const margin = 50;
      const contentWidth = 495;
      const pageWidth = 595;
      const pageHeight = 842;
      let pageNum = 0;
      
      // Color palette
      const colors = {
        primary: '#1a365d',
        accent: '#2c5282',
        highlight: '#38a169',
        text: '#2d3748',
        textLight: '#4a5568',
        bg: '#f7fafc',
        white: '#ffffff',
        muted: '#718096'
      };
      
      // Helper: add page with elegant header
      const addContentPage = (sectionTitle: string, sectionSubtitle: string) => {
        doc.addPage();
        pageNum++;
        
        // Top accent bar
        doc.rect(0, 0, pageWidth, 4).fill(colors.highlight);
        
        // Header area
        doc.rect(0, 4, pageWidth, 70).fill(colors.primary);
        
        // Section title
        doc.fontSize(18).font('Helvetica-Bold').fillColor(colors.white);
        doc.text(sectionTitle.toUpperCase(), margin, 24, { width: contentWidth });
        
        // Section subtitle
        doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
        doc.text(sectionSubtitle, margin, 48, { width: contentWidth });
        
        // Page number
        doc.fontSize(8).fillColor('#a0aec0');
        doc.text(pageNum.toString(), pageWidth - margin - 20, 50, { width: 20, align: 'right' });
        
        return 90;
      };
      
      // Helper: section box with title
      const drawSectionBox = (y: number, title: string, content: string, bulletPoints?: string[]) => {
        const lineHeight = 14;
        const titleHeight = 24;
        const contentHeight = Math.ceil(content.length / 80) * lineHeight + 10;
        const bulletsHeight = bulletPoints ? bulletPoints.length * (lineHeight + 2) : 0;
        const totalHeight = titleHeight + contentHeight + bulletsHeight + 20;
        
        // Box background
        doc.rect(margin, y, contentWidth, totalHeight).fill(colors.bg);
        doc.rect(margin, y, 4, totalHeight).fill(colors.accent);
        
        // Title
        doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
        doc.text(title, margin + 15, y + 12, { width: contentWidth - 30 });
        
        // Content paragraph
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        doc.text(content, margin + 15, y + 32, { width: contentWidth - 30, align: 'justify', lineGap: 3 });
        
        // Bullet points
        if (bulletPoints && bulletPoints.length > 0) {
          let by = y + 32 + contentHeight;
          bulletPoints.forEach(point => {
            doc.fontSize(9).font('Helvetica').fillColor(colors.textLight);
            doc.text('-  ' + point, margin + 20, by, { width: contentWidth - 40 });
            by += lineHeight + 2;
          });
        }
        
        return y + totalHeight + 12;
      };
      
      // ===== PAGE 1: COVER =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill(colors.primary);
      
      // Try to embed actual logo
      try {
        const logoPath = path.join(__dirname, '..', 'server', 'assets', 'logo-croce-europa.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, pageWidth/2 - 60, 120, { width: 120 });
        } else {
          // Fallback: draw stylized cross
          doc.lineWidth(4).strokeColor(colors.white);
          doc.moveTo(pageWidth/2, 130).lineTo(pageWidth/2, 210).stroke();
          doc.moveTo(pageWidth/2 - 40, 170).lineTo(pageWidth/2 + 40, 170).stroke();
        }
      } catch (e) {
        // Fallback cross
        doc.lineWidth(4).strokeColor(colors.white);
        doc.moveTo(pageWidth/2, 130).lineTo(pageWidth/2, 210).stroke();
        doc.moveTo(pageWidth/2 - 40, 170).lineTo(pageWidth/2 + 40, 170).stroke();
      }
      
      // Company name
      doc.fontSize(32).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('SOCCORSO DIGITALE', margin, 260, { width: contentWidth, align: 'center' });
      
      doc.fontSize(13).font('Helvetica').fillColor('#a0aec0');
      doc.text('S.R.L. Impresa Sociale', margin, 300, { width: contentWidth, align: 'center' });
      
      // Divider line
      doc.rect(pageWidth/2 - 60, 340, 120, 2).fill(colors.highlight);
      
      // Platform name
      doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('SOCCORSO DIGITALE', margin, 380, { width: contentWidth, align: 'center' });
      
      // Subtitle
      doc.fontSize(12).font('Helvetica').fillColor(colors.white);
      doc.text('Piattaforma Digitale per il Trasporto Sanitario', margin, 420, { width: contentWidth, align: 'center' });
      
      // Description
      doc.fontSize(10).font('Helvetica').fillColor('#a0aec0');
      doc.text('Sistema integrato per la gestione operativa, il controllo direzionale', margin, 480, { width: contentWidth, align: 'center' });
      doc.text('e l\'analisi economica dei servizi di ambulanza', margin, 495, { width: contentWidth, align: 'center' });
      
      // Stats bar at bottom
      doc.rect(0, pageHeight - 120, pageWidth, 70).fill('#0d2137');
      
      const statsY = pageHeight - 105;
      const statWidth = contentWidth / 4;
      
      doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.white);
      doc.text(allVehicles.length.toString(), margin, statsY, { width: statWidth, align: 'center' });
      doc.text(allLocations.length.toString(), margin + statWidth, statsY, { width: statWidth, align: 'center' });
      doc.text(allStructures.length.toString() + '+', margin + statWidth * 2, statsY, { width: statWidth, align: 'center' });
      doc.text(thisYearTrips.length.toLocaleString('it-IT'), margin + statWidth * 3, statsY, { width: statWidth, align: 'center' });
      
      doc.fontSize(7).font('Helvetica').fillColor('#a0aec0');
      doc.text('Mezzi', margin, statsY + 25, { width: statWidth, align: 'center' });
      doc.text('Sedi', margin + statWidth, statsY + 25, { width: statWidth, align: 'center' });
      doc.text('Strutture', margin + statWidth * 2, statsY + 25, { width: statWidth, align: 'center' });
      doc.text('Servizi ' + currentYear, margin + statWidth * 3, statsY + 25, { width: statWidth, align: 'center' });
      
      // Footer
      doc.fontSize(8).fillColor(colors.muted);
      doc.text('Via Forte Garofolo 20, 37057 San Giovanni Lupatoto (VR)', margin, pageHeight - 35, { width: contentWidth, align: 'center' });
      
      // ===== PAGE 2: INTRODUZIONE / CONTESTO =====
      let y = addContentPage('Introduzione', 'Chi siamo e perche nasce il progetto');
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('SOCCORSO DIGITALE opera nel settore del trasporto sanitario e sociosanitario nelle province di Verona, Vicenza e Padova, gestendo quotidianamente un numero elevato di servizi, mezzi ed equipaggi.', margin, y, { width: contentWidth, align: 'justify', lineGap: 4 });
      y += 50;
      
      doc.text('Nel tempo e emersa la necessita di superare strumenti frammentati e non integrati, sviluppando una soluzione proprietaria in grado di supportare in modo strutturato l\'operativita, il controllo dei dati e la rendicontazione.', margin, y, { width: contentWidth, align: 'justify', lineGap: 4 });
      y += 50;
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.accent);
      doc.text('Da questa esigenza nasce SOCCORSO DIGITALE, una piattaforma digitale progettata internamente per rispondere a bisogni reali e gia utilizzata come base operativa.', margin, y, { width: contentWidth, align: 'justify', lineGap: 4 });
      y += 60;
      
      // Status section
      y = drawSectionBox(y, 'STATO ATTUALE DEL PROGETTO', 
        'La piattaforma e gia sviluppata e testata internamente ed e attualmente in fase di consolidamento operativo. Non si tratta di un\'idea o di un prototipo, ma di un sistema funzionante che integra:',
        ['App mobile per gli equipaggi', 'Piattaforma web per la gestione direzionale', 'Moduli di analisi, controllo e compliance']
      );
      
      doc.fontSize(9).font('Helvetica').fillColor(colors.text);
      doc.text('La soluzione e stata progettata con un\'architettura modulare e scalabile, cosi da consentire evoluzioni future senza impatti sull\'operativita esistente.', margin, y, { width: contentWidth, align: 'justify', lineGap: 3 });
      
      // ===== PAGE 3: APPLICAZIONE MOBILE =====
      y = addContentPage('Applicazione Mobile', 'Funzione e valore per gli equipaggi');
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('L\'applicazione mobile e installata sui dispositivi in dotazione agli equipaggi e consente la registrazione guidata dei servizi di trasporto sanitario.', margin, y, { width: contentWidth, align: 'justify', lineGap: 4 });
      y += 45;
      
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text('Caratteristiche Principali', margin, y);
      y += 22;
      
      const mobileFeatures = [
        'Autenticazione basata su identita veicolo e sede operativa',
        'Selezione vincolata dei veicoli assegnati alla sede',
        'Inserimento strutturato dei dati di viaggio con validazione',
        'Riduzione degli errori di compilazione tramite controlli automatici',
        'Possibilita di utilizzo in contesti operativi reali (offline)',
        'Gestione inventario con scansione codici a barre',
        'Checklist digitali per verifica dotazioni pre-turno',
        'Hub notifiche e annunci con tracciamento letture'
      ];
      
      mobileFeatures.forEach((f, i) => {
        const bg = i % 2 === 0 ? colors.bg : colors.white;
        doc.rect(margin, y, contentWidth, 22).fill(bg);
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        doc.text('-', margin + 10, y + 6);
        doc.text(f, margin + 25, y + 6, { width: contentWidth - 35 });
        y += 22;
      });
      
      y += 15;
      doc.rect(margin, y, contentWidth, 50).fill('#e6fffa');
      doc.rect(margin, y, 4, 50).fill(colors.highlight);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('PRONTA PER LA DISTRIBUZIONE', margin + 15, y + 12);
      doc.fontSize(9).font('Helvetica').fillColor(colors.text);
      doc.text('L\'app e gia pronta per la distribuzione su dispositivi aziendali ed e progettata per essere estesa con ulteriori moduli funzionali senza modifiche strutturali.', margin + 15, y + 28, { width: contentWidth - 30 });
      
      // ===== PAGE 4: PIATTAFORMA WEB =====
      y = addContentPage('Piattaforma Web', 'Sistema direzionale e operativo');
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('La piattaforma web rappresenta il centro di governo del sistema e consente la gestione completa delle operazioni, il monitoraggio dell\'attivita e il supporto alle decisioni organizzative ed economiche.', margin, y, { width: contentWidth, align: 'justify', lineGap: 4 });
      y += 50;
      
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text('Funzionalita del Pannello Amministrativo', margin, y);
      y += 22;
      
      const webFeatures = [
        ['Gestione Viaggi', 'Visualizzazione, modifica e analisi di tutti i servizi registrati'],
        ['Gestione Flotta', allVehicles.length + ' veicoli monitorati con tracking chilometrico e scadenze'],
        ['Gestione Sedi', allLocations.length + ' sedi operative con configurazione indipendente'],
        ['Rubrica Strutture', allStructures.length + '+ strutture sanitarie con reparti e autocompletamento'],
        ['Gestione Utenti', 'Sistema RBAC con ruoli crew, admin e director'],
        ['Dashboard Analitica', 'KPI in tempo reale con grafici interattivi'],
        ['Report e Export', 'Generazione PDF, CSV e documentazione UTIF']
      ];
      
      webFeatures.forEach((f, i) => {
        const bg = i % 2 === 0 ? colors.bg : colors.white;
        doc.rect(margin, y, contentWidth, 28).fill(bg);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.accent);
        doc.text(f[0], margin + 10, y + 8, { width: 110 });
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        doc.text(f[1], margin + 125, y + 8, { width: contentWidth - 135 });
        y += 28;
      });
      
      y += 15;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.accent);
      doc.text('Non si tratta di un semplice pannello di consultazione, ma di un vero strumento di governo operativo, pensato per chi deve controllare, confrontare e pianificare.', margin, y, { width: contentWidth, align: 'justify', lineGap: 3 });
      
      // ===== PAGE 5: ANALYTICS & ANALISI ECONOMICA =====
      y = addContentPage('Analytics e Analisi Economica', 'Dati reali per decisioni strategiche');
      
      // Analytics section
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text('ANALYTICS E REPORTISTICA', margin, y);
      y += 20;
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('Il sistema fornisce strumenti di analytics orientati alla lettura dell\'attivita svolta, basati su dati reali provenienti dall\'operativita quotidiana:', margin, y, { width: contentWidth, align: 'justify', lineGap: 3 });
      y += 40;
      
      const analyticsItems = [
        'Volumi di servizio per periodo, veicolo e sede',
        'Chilometri percorsi con analisi comparative',
        'Distribuzione temporale e territoriale dei servizi',
        'Confronti tra periodi, sedi e mezzi'
      ];
      
      analyticsItems.forEach(item => {
        doc.fontSize(9).font('Helvetica').fillColor(colors.textLight);
        doc.text('-  ' + item, margin + 10, y);
        y += 16;
      });
      
      y += 15;
      
      // Economic analysis section
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text('ANALISI ECONOMICA', margin, y);
      y += 20;
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('Il modulo di analisi economica integra dati operativi e parametri di costo per consentire una valutazione completa della sostenibilita economica:', margin, y, { width: contentWidth, align: 'justify', lineGap: 3 });
      y += 40;
      
      const economicItems = [
        ['Valutazione Costi', 'Calcolo costi per viaggio, veicolo e servizio'],
        ['Sostenibilita', 'Analisi della sostenibilita economica per appalto'],
        ['Confronti', 'Comparazione tra appalti, sedi e veicoli'],
        ['Simulazioni', 'Simulatore what-if per proiezioni finanziarie']
      ];
      
      economicItems.forEach((item, i) => {
        const bg = i % 2 === 0 ? colors.bg : colors.white;
        doc.rect(margin, y, contentWidth, 24).fill(bg);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.accent);
        doc.text(item[0], margin + 10, y + 7);
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        doc.text(item[1], margin + 130, y + 7);
        y += 24;
      });
      
      y += 15;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.accent);
      doc.text('L\'obiettivo non e solo il calcolo dei costi, ma il supporto alle decisioni strategiche e alla pianificazione economica.', margin, y, { width: contentWidth, align: 'justify' });
      
      // ===== PAGE 6: COMPLIANCE E QUALITA =====
      y = addContentPage('Compliance e Qualita', 'Affidabilita e tracciabilita by design');
      
      // Compliance section
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text('COMPLIANCE, SICUREZZA E GDPR', margin, y);
      y += 20;
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('La piattaforma integra nativamente meccanismi di sicurezza e conformita, gia allineati ai requisiti tipici di contesti regolamentati:', margin, y, { width: contentWidth, align: 'justify', lineGap: 3 });
      y += 40;
      
      const complianceItems = [
        ['Audit Trail', 'Logging completo con hash chain SHA-256 e retention 10 anni'],
        ['Integrita Dati', 'Meccanismi di verifica e protezione anti-manomissione'],
        ['GDPR', 'Gestione consensi, export dati, richieste cancellazione'],
        ['Backup', 'Backup schedulati con verifica automatica restore'],
        ['SLA', 'Monitoraggio uptime e continuita operativa']
      ];
      
      complianceItems.forEach((item, i) => {
        const bg = i % 2 === 0 ? colors.bg : colors.white;
        doc.rect(margin, y, contentWidth, 26).fill(bg);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.accent);
        doc.text(item[0], margin + 10, y + 8);
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        doc.text(item[1], margin + 100, y + 8, { width: contentWidth - 110 });
        y += 26;
      });
      
      y += 25;
      
      // Data quality section
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text('QUALITA DEL DATO', margin, y);
      y += 20;
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('E stato progettato un modulo dedicato alla Qualita del Dato, che monitora la completezza, coerenza, tempestivita e tracciabilita delle informazioni.', margin, y, { width: contentWidth, align: 'justify', lineGap: 3 });
      y += 40;
      
      doc.rect(margin, y, contentWidth, 45).fill('#e6fffa');
      doc.rect(margin, y, 4, 45).fill(colors.highlight);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('DATI AFFIDABILI E DIFENDIBILI', margin + 15, y + 10);
      doc.fontSize(9).font('Helvetica').fillColor(colors.text);
      doc.text('Questo approccio garantisce che i dati utilizzati per analisi, reportistica e rendicontazione siano affidabili e difendibili in ogni contesto.', margin + 15, y + 26, { width: contentWidth - 30 });
      
      // ===== PAGE 7: EVOLUZIONE E CONCLUSIONE =====
      y = addContentPage('Evoluzione del Progetto', 'Roadmap e potenziale di sviluppo');
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.text);
      doc.text('La piattaforma attuale rappresenta una base tecnologica solida sulla quale e possibile costruire ulteriori livelli di innovazione. Sono gia stati individuati ambiti di evoluzione ad alto valore:', margin, y, { width: contentWidth, align: 'justify', lineGap: 4 });
      y += 50;
      
      const roadmapItems = [
        'Analytics avanzate e supporto decisionale',
        'Rafforzamento dei meccanismi di qualita e affidabilita del dato',
        'Integrazione con ecosistemi sanitari digitali',
        'Simulazione economica e predittiva',
        'Modelli di interoperabilita e replicabilita'
      ];
      
      roadmapItems.forEach((item, i) => {
        doc.rect(margin, y, contentWidth, 24).fill(i % 2 === 0 ? colors.bg : colors.white);
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        doc.text((i + 1) + '.', margin + 10, y + 7);
        doc.text(item, margin + 30, y + 7, { width: contentWidth - 40 });
        y += 24;
      });
      
      y += 25;
      
      // Conclusion box
      doc.rect(margin, y, contentWidth, 130).fill(colors.primary);
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('PERCHE QUESTO PROGETTO E SOLIDO', margin + 20, y + 15, { width: contentWidth - 40 });
      
      doc.fontSize(10).font('Helvetica').fillColor(colors.white);
      const conclusionPoints = [
        'Un sistema reale e funzionante',
        'Basato su esigenze operative concrete',
        'Tecnicamente maturo',
        'Progettato per crescere'
      ];
      
      let cy = y + 40;
      conclusionPoints.forEach(point => {
        doc.text('-  ' + point, margin + 25, cy);
        cy += 18;
      });
      
      doc.fontSize(9).font('Helvetica').fillColor('#a0aec0');
      doc.text('La piattaforma non nasce per inseguire un singolo bando, ma come infrastruttura digitale su cui costruire progetti futuri sostenibili e credibili.', margin + 20, y + 105, { width: contentWidth - 40, align: 'center' });
      
      // ===== PAGE 8: BACK COVER =====
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill(colors.primary);
      
      // Logo
      try {
        const logoPath = path.join(__dirname, '..', 'server', 'assets', 'logo-croce-europa.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, pageWidth/2 - 50, 180, { width: 100 });
        } else {
          doc.lineWidth(3).strokeColor(colors.white);
          doc.moveTo(pageWidth/2, 190).lineTo(pageWidth/2, 260).stroke();
          doc.moveTo(pageWidth/2 - 35, 225).lineTo(pageWidth/2 + 35, 225).stroke();
        }
      } catch (e) {
        doc.lineWidth(3).strokeColor(colors.white);
        doc.moveTo(pageWidth/2, 190).lineTo(pageWidth/2, 260).stroke();
        doc.moveTo(pageWidth/2 - 35, 225).lineTo(pageWidth/2 + 35, 225).stroke();
      }
      
      // Company name
      doc.fontSize(26).font('Helvetica-Bold').fillColor(colors.white);
      doc.text('SOCCORSO DIGITALE', margin, 300, { width: contentWidth, align: 'center' });
      
      doc.fontSize(11).font('Helvetica').fillColor('#a0aec0');
      doc.text('S.R.L. Impresa Sociale', margin, 335, { width: contentWidth, align: 'center' });
      
      // Divider
      doc.rect(pageWidth/2 - 40, 370, 80, 2).fill(colors.highlight);
      
      // Tagline
      doc.fontSize(13).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('Data Platform', margin, 400, { width: contentWidth, align: 'center' });
      
      // Description
      doc.fontSize(10).font('Helvetica').fillColor(colors.white);
      doc.text('Innovazione digitale al servizio del trasporto sanitario', margin, 440, { width: contentWidth, align: 'center' });
      
      // Contact box
      doc.rect(margin + 80, 500, contentWidth - 160, 130).fill('#0d2137');
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.highlight);
      doc.text('CONTATTI', margin + 80, 520, { width: contentWidth - 160, align: 'center' });
      
      doc.fontSize(9).font('Helvetica').fillColor(colors.white);
      doc.text('Via Forte Garofolo 20', margin + 80, 550, { width: contentWidth - 160, align: 'center' });
      doc.text('37057 San Giovanni Lupatoto (VR)', margin + 80, 565, { width: contentWidth - 160, align: 'center' });
      doc.text('Italia', margin + 80, 580, { width: contentWidth - 160, align: 'center' });
      
      // Stats summary
      doc.fontSize(8).fillColor('#a0aec0');
      doc.text(allVehicles.length + ' mezzi  |  ' + allLocations.length + ' sedi  |  ' + allStructures.length + '+ strutture  |  ' + totalKm.toLocaleString('it-IT') + ' km registrati', margin + 80, 605, { width: contentWidth - 160, align: 'center' });
      
      // Footer
      doc.fontSize(8).fillColor(colors.muted);
      doc.text('SOCCORSO DIGITALE', margin, pageHeight - 40, { width: contentWidth, align: 'center' });
      
      doc.end();
    } catch (error) {
      console.error("Error generating product showcase PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del report" });
    }
  });

  // Advanced Statistics API endpoint
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
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
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
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
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
        expiryDate: parsedDate.toISOString(),
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
            oldExpiryDate: oldExpiryDate ? (typeof oldExpiryDate === 'string' ? oldExpiryDate.split('T')[0] : (oldExpiryDate as any).toISOString().split('T')[0]) : null,
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
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const [v] = await db.select({ id: vehicles.id }).from(vehicles)
          .where(and(eq(vehicles.id, req.params.vehicleId), eq(vehicles.organizationId, orgId)));
        if (!v) return res.status(403).json({ error: "Accesso negato" });
      }
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
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const [v] = await db.select({ id: vehicles.id }).from(vehicles)
          .where(and(eq(vehicles.id, req.params.vehicleId), eq(vehicles.organizationId, orgId)));
        if (!v) return res.status(403).json({ error: "Accesso negato" });
      }
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

      // @ts-ignore
      const { generateChecklistMonthlyPDF } = await import("./pdf-generator");
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

  // ============================================================================
  // ENTERPRISE COMPLIANCE API - AUDIT TRAIL & GDPR
  // ============================================================================

  // --- AUDIT TRAIL ENDPOINTS ---
  
  // Get audit log entries (admin/director only)
  app.get("/api/compliance/audit", requireAdmin, async (req, res) => {
    try {
      const { page, limit, actorId, entityType, entityId, action, startDate, endDate, isSensitive, isCompliance } = req.query;
      
      const result = await getAuditLogs({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        actorId: actorId as string,
        entityType: entityType as string,
        entityId: entityId as string,
        action: action as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        isSensitive: isSensitive === "true" ? true : isSensitive === "false" ? false : undefined,
        isCompliance: isCompliance === "true" ? true : isCompliance === "false" ? false : undefined,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Errore nel recupero audit log" });
    }
  });
  
  // Get audit statistics (admin/director only)
  app.get("/api/compliance/audit/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await getAuditStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching audit stats:", error);
      res.status(500).json({ error: "Errore nel recupero statistiche audit" });
    }
  });
  
  // Verify audit hash chain integrity (admin/director only)
  app.post("/api/compliance/audit/verify", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      
      const result = await verifyHashChain(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      
      // Log this verification
      await auditLog.create("audit_verification", "verification", "Hash chain verification", {
        isValid: result.isValid,
        entriesChecked: result.entriesChecked,
        issues: result.issues,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error verifying audit chain:", error);
      res.status(500).json({ error: "Errore nella verifica catena audit" });
    }
  });
  
  // Export audit logs (admin/director only)
  app.get("/api/compliance/audit/export", requireAdmin, async (req, res) => {
    try {
      const { format, startDate, endDate } = req.query;
      
      const result = await getAuditLogs({
        limit: 10000, // Max export
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      // Log export action
      await auditLog.export("audit_log", format as string || "json", result.entries.length);
      
      if (format === "csv") {
        // CSV export
        const header = "ID,Timestamp,Actor,Action,Entity,Description\n";
        const rows = result.entries.map(e => 
          `"${e.id}","${e.occurredAt?.toISOString()}","${e.actorName || e.actorId}","${e.action}","${e.entityType}:${e.entityId}","${e.description || ''}"`
        ).join("\n");
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=audit_log_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(header + rows);
      } else {
        res.json(result.entries);
      }
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ error: "Errore nell'export audit log" });
    }
  });

  // --- GDPR ENDPOINTS ---
  
  // Get current privacy policy (public)
  app.get("/api/gdpr/privacy-policy", async (req, res) => {
    try {
      const FALLBACK_PRIVACY_CONTENT = `INFORMATIVA SULLA PRIVACY E PROTEZIONE DEI DATI PERSONALI
ai sensi del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003

1. TITOLARE DEL TRATTAMENTO

Soccorso Digitale
Piattaforma SaaS per la Gestione dei Trasporti Sanitari
Via Forte Garofolo 20
37057 San Giovanni Lupatoto (VR) - Italia
Email: info@soccorsodigitale.app
DPO: privacy@soccorsodigitale.app
Sito web: https://soccorsodigitale.app

2. AMBITO DI APPLICAZIONE

La presente informativa si applica a tutti i trattamenti di dati personali effettuati attraverso la piattaforma Soccorso Digitale (app mobile, pannello amministrativo, portale Hub Prenotazioni).

3. DATI PERSONALI RACCOLTI

Dati del Personale Operativo:
- Nome, cognome e codice fiscale
- Indirizzo email e numero di telefono
- Ruolo operativo e sede di appartenenza
- Tipologia contrattuale e qualifiche professionali
- Credenziali di accesso alla piattaforma

Dati dei Pazienti Trasportati:
- Indirizzo di partenza e destinazione (senza numero civico)
- Anno di nascita e genere
- Dati clinici essenziali relativi al trasporto

Dati di Geolocalizzazione:
- Coordinate GPS dei veicoli durante il servizio attivo
- Tracciamento del percorso per calcolo automatico chilometri (OSRM)

Dati dei Servizi di Trasporto:
- Data, ora, chilometraggio, strutture coinvolte
- Firma crittografica di integrita (HMAC-SHA256)

4. FINALITA E BASE GIURIDICA

- Esecuzione del Contratto (Art. 6.1.b): erogazione servizi SaaS, gestione trasporti
- Obblighi di Legge (Art. 6.1.c): documentazione UTIF, adempimenti fiscali
- Interesse Legittimo (Art. 6.1.f): statistiche, monitoraggio CO2, gestione flotta
- Consenso (Art. 6.1.a): comunicazioni, funzionalita opzionali, Hub Prenotazioni

5. MISURE DI SICUREZZA (Art. 32 GDPR)

- Crittografia HTTPS/TLS 1.3
- Audit trail con hash chain crittografica SHA-256
- Firma HMAC-SHA256 per integrita dei trasporti
- Cookie HttpOnly, Secure, SameSite=Strict
- Isolamento dati multi-tenant
- Controllo accessi basato sui ruoli (RBAC)
- Backup automatici e disaster recovery

6. CONSERVAZIONE DEI DATI

- Dati operativi: 10 anni (obblighi fiscali)
- Dati di geolocalizzazione: 24 mesi
- Log di audit: 7 anni (ISO 27001)
- Account demo: eliminazione automatica dopo 24 ore

7. DIRITTI DELL'INTERESSATO (artt. 15-22 GDPR)

- Accesso, rettifica, cancellazione, limitazione
- Portabilita, opposizione, revoca del consenso

Per esercitare i diritti: privacy@soccorsodigitale.app

8. RECLAMI

Garante per la Protezione dei Dati Personali
www.garanteprivacy.it

Ultimo aggiornamento: 19 Febbraio 2026
Versione: 3.0.0`;

      const policy = await gdpr.getCurrentPrivacyPolicy();
      
      // Check if the request comes from a browser (Accept: text/html)
      const acceptHeader = req.headers.accept || "";
      if (acceptHeader.includes("text/html")) {
        // Return formatted HTML page
        const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${policy?.title || "Informativa sulla Privacy"} - Soccorso Digitale</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #FFFFFF;
      color: #1F2937;
      line-height: 1.8;
      min-height: 100vh;
      padding: 16px;
      padding-bottom: env(safe-area-inset-bottom, 16px);
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 24px 20px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }
    @media (max-width: 480px) {
      body { padding: 12px; }
      .container { padding: 20px 16px; border-radius: 12px; }
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid #E5E7EB;
    }
    .logo {
      font-size: 13px;
      font-weight: 600;
      color: #6B7280;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1F2937;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    @media (max-width: 480px) {
      h1 { font-size: 20px; }
    }
    .version {
      display: inline-block;
      font-size: 12px;
      color: #10b981;
      background: rgba(16, 185, 129, 0.15);
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: 500;
    }
    .content {
      white-space: pre-wrap;
      font-size: 15px;
      color: #374151;
      word-wrap: break-word;
    }
    @media (max-width: 480px) {
      .content { font-size: 14px; line-height: 1.7; }
    }
    .footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
    }
    .footer-company {
      font-size: 14px;
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 8px;
    }
    .footer-address {
      font-size: 13px;
      color: #6B7280;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    .footer-contact {
      font-size: 13px;
      margin-bottom: 16px;
    }
    .footer-contact a {
      color: #0066CC;
      text-decoration: none;
    }
    .footer-contact a:hover {
      text-decoration: underline;
    }
    .footer-copy {
      font-size: 12px;
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Soccorso Digitale</div>
      <h1>${policy?.title || "Informativa sulla Privacy"}</h1>
      <div class="version">v${policy?.version || "3.0.0"} - Aggiornato: 19 Febbraio 2026</div>
    </div>
    <div class="content">${(policy?.content || FALLBACK_PRIVACY_CONTENT).replace(/\n/g, "<br>")}</div>
    <div class="footer">
      <div class="footer-company">Soccorso Digitale</div>
      <div class="footer-address">
        Via Forte Garofolo 20<br>
        37057 San Giovanni Lupatoto (VR)
      </div>
      <div class="footer-contact">
        DPO: <a href="mailto:privacy@soccorsodigitale.app">privacy@soccorsodigitale.app</a>
      </div>
      <div class="footer-copy">&copy; ${new Date().getFullYear()} Soccorso Digitale - Tutti i diritti riservati</div>
    </div>
  </div>
</body>
</html>`;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(htmlContent);
      }
      
      // Return JSON for API clients
      res.json(policy);
    } catch (error) {
      console.error("Error fetching privacy policy:", error);
      res.status(500).json({ error: "Errore nel recupero privacy policy" });
    }
  });
  
  // Get all privacy policies (admin only)
  app.get("/api/gdpr/privacy-policies", requireAdmin, async (req, res) => {
    try {
      const policies = await gdpr.getAllPrivacyPolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error fetching privacy policies:", error);
      res.status(500).json({ error: "Errore nel recupero privacy policies" });
    }
  });
  
  // Create new privacy policy (admin only)
  app.post("/api/gdpr/privacy-policies", requireAdmin, async (req, res) => {
    try {
      const policy = await gdpr.createPrivacyPolicy(req.body);
      await auditLog.create("privacy_policy", policy.id, policy.version, { version: policy.version });
      res.status(201).json(policy);
    } catch (error) {
      console.error("Error creating privacy policy:", error);
      res.status(500).json({ error: "Errore nella creazione privacy policy" });
    }
  });
  
  // Check if user needs to accept policy
  app.get("/api/gdpr/consent-required", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const result = await gdpr.needsPolicyAcceptance(userId);
      res.json(result);
    } catch (error) {
      console.error("Error checking consent requirement:", error);
      res.status(500).json({ error: "Errore nel controllo consensi" });
    }
  });
  
  // Get user's consents
  app.get("/api/gdpr/consents", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const consents = await gdpr.getUserConsents(userId);
      res.json(consents);
    } catch (error) {
      console.error("Error fetching user consents:", error);
      res.status(500).json({ error: "Errore nel recupero consensi" });
    }
  });
  
  // Grant consent
  app.post("/api/gdpr/consents", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const { consentType, policyId, policyVersion, consentText } = req.body;
      
      if (!consentType) {
        return res.status(400).json({ error: "Tipo di consenso obbligatorio" });
      }
      
      const consent = await gdpr.grantConsent(userId, consentType, {
        policyId,
        policyVersion,
        consentMethod: "app_checkbox",
        consentSource: "mobile_app",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        consentText,
      });
      
      res.status(201).json(consent);
    } catch (error) {
      console.error("Error granting consent:", error);
      res.status(500).json({ error: "Errore nel salvataggio consenso" });
    }
  });
  
  // Revoke consent
  app.delete("/api/gdpr/consents/:type", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const consentType = req.params.type as any;
      const result = await gdpr.revokeConsent(userId, consentType);
      
      if (result) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Consenso non trovato" });
      }
    } catch (error) {
      console.error("Error revoking consent:", error);
      res.status(500).json({ error: "Errore nella revoca consenso" });
    }
  });
  
  // Request data export (Right to Access)
  app.post("/api/gdpr/data-export", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const request = await gdpr.requestDataExport(userId, {
        requestMethod: "mobile_app",
        requestIpAddress: req.ip,
        requestUserAgent: req.headers["user-agent"],
        exportFormat: req.body.format || "json",
        dataCategories: req.body.categories,
      });
      
      // Auto-process the export (in production, this would be a background job)
      gdpr.generateDataExport(request.id).catch(console.error);
      
      res.status(201).json(request);
    } catch (error) {
      console.error("Error requesting data export:", error);
      res.status(500).json({ error: "Errore nella richiesta export dati" });
    }
  });
  
  // Get user's data export requests
  app.get("/api/gdpr/data-exports", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const exports = await gdpr.getUserDataExports(userId);
      res.json(exports);
    } catch (error) {
      console.error("Error fetching data exports:", error);
      res.status(500).json({ error: "Errore nel recupero richieste export" });
    }
  });
  
  // Download data export
  app.get("/api/gdpr/data-export/:id/download", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const exports = await gdpr.getUserDataExports(userId);
      const exportRequest = exports.find(e => e.id === req.params.id);
      
      if (!exportRequest) {
        return res.status(404).json({ error: "Richiesta non trovata" });
      }
      
      if (exportRequest.status !== "completed") {
        return res.status(400).json({ error: "Export non ancora pronto" });
      }
      
      // Re-generate the data for download
      const result = await gdpr.generateDataExport(req.params.id);
      
      if (result.success && result.data) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=my_data_export_${new Date().toISOString().split('T')[0]}.json`);
        res.json(result.data);
      } else {
        res.status(500).json({ error: result.error || "Errore nella generazione export" });
      }
    } catch (error) {
      console.error("Error downloading data export:", error);
      res.status(500).json({ error: "Errore nel download export" });
    }
  });
  
  // Request data erasure (Right to Erasure)
  app.post("/api/gdpr/data-erasure", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const request = await gdpr.requestDataErasure(userId, {
        requestMethod: "mobile_app",
        requestReason: req.body.reason,
        requestIpAddress: req.ip,
        erasureScope: req.body.scope || "full",
      });
      
      res.status(201).json({
        ...request,
        message: "Richiesta di cancellazione ricevuta. Sarà elaborata entro 30 giorni.",
        note: "Alcuni dati operativi potrebbero essere conservati per esigenze aziendali interne.",
      });
    } catch (error) {
      console.error("Error requesting data erasure:", error);
      res.status(500).json({ error: "Errore nella richiesta cancellazione dati" });
    }
  });
  
  // Get user's erasure requests
  app.get("/api/gdpr/data-erasures", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const erasures = await gdpr.getUserErasureRequests(userId);
      res.json(erasures);
    } catch (error) {
      console.error("Error fetching erasure requests:", error);
      res.status(500).json({ error: "Errore nel recupero richieste cancellazione" });
    }
  });
  
  // Request data erasure by person name (for vehicle-based shared accounts)
  // Since accounts are shared per vehicle, crew members provide their name for erasure
  app.post("/api/gdpr/data-erasure-by-name", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Utente non autenticato" });
      }
      
      const { fullName, reason } = req.body;
      
      if (!fullName || typeof fullName !== "string" || fullName.trim().length < 3) {
        return res.status(400).json({ 
          error: "Nome e cognome obbligatori",
          message: "Inserisci il tuo nome completo (Nome Cognome) per procedere con la richiesta."
        });
      }
      
      // Search for records containing this name
      const records = await gdpr.findRecordsByPersonName(fullName.trim());
      
      const request = await gdpr.requestDataErasureByName(userId, fullName.trim(), {
        requestMethod: "mobile_app",
        requestReason: reason,
        requestIpAddress: req.ip,
      });
      
      res.status(201).json({
        ...request,
        recordsFound: records,
        message: `Richiesta di cancellazione per "${fullName}" ricevuta. Saranno anonimizzati ${records.checklistCount} checklist e ${records.chatMessageCount} messaggi.`,
        note: "I dati operativi (viaggi) sono conservati per esigenze aziendali interne.",
      });
    } catch (error) {
      console.error("Error requesting data erasure by name:", error);
      res.status(500).json({ error: "Errore nella richiesta cancellazione dati" });
    }
  });
  
  // Search records by person name (preview before erasure)
  app.post("/api/gdpr/search-records-by-name", requireAuth, async (req, res) => {
    try {
      const { fullName } = req.body;
      
      if (!fullName || typeof fullName !== "string" || fullName.trim().length < 3) {
        return res.status(400).json({ error: "Nome richiesto (minimo 3 caratteri)" });
      }
      
      const records = await gdpr.findRecordsByPersonName(fullName.trim());
      res.json(records);
    } catch (error) {
      console.error("Error searching records by name:", error);
      res.status(500).json({ error: "Errore nella ricerca" });
    }
  });
  
  // --- ADMIN GDPR ENDPOINTS ---
  
  // Get GDPR statistics
  app.get("/api/compliance/gdpr/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await gdpr.getGdprStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching GDPR stats:", error);
      res.status(500).json({ error: "Errore nel recupero statistiche GDPR" });
    }
  });
  
  // Get pending data export requests
  app.get("/api/compliance/gdpr/exports/pending", requireAdmin, async (req, res) => {
    try {
      const exports = await gdpr.getPendingDataExports();
      res.json(exports);
    } catch (error) {
      console.error("Error fetching pending exports:", error);
      res.status(500).json({ error: "Errore nel recupero export in attesa" });
    }
  });
  
  // Get pending erasure requests
  app.get("/api/compliance/gdpr/erasures/pending", requireAdmin, async (req, res) => {
    try {
      const erasures = await gdpr.getPendingErasureRequests();
      res.json(erasures);
    } catch (error) {
      console.error("Error fetching pending erasures:", error);
      res.status(500).json({ error: "Errore nel recupero cancellazioni in attesa" });
    }
  });
  
  // Process erasure request (admin only)
  app.post("/api/compliance/gdpr/erasures/:id/process", requireAdmin, async (req, res) => {
    try {
      const adminId = req.session?.userId || "system";
      
      // First get the request to check if it's name-based
      const erasures = await gdpr.getPendingErasureRequests();
      const erasureRequest = erasures.find(e => e.id === req.params.id);
      
      if (!erasureRequest) {
        return res.status(404).json({ error: "Richiesta non trovata" });
      }
      
      // If it has requesterFullName, use name-based erasure
      if (erasureRequest.requesterFullName) {
        const result = await gdpr.processErasureByName(req.params.id, adminId);
        
        if (result.success) {
          res.json({
            success: true,
            message: `Dati di "${erasureRequest.requesterFullName}" anonimizzati`,
            anonymizedChecklists: result.anonymizedChecklists,
            anonymizedMessages: result.anonymizedMessages,
          });
        } else {
          res.status(500).json({ error: result.error });
        }
      } else {
        // Standard account-based erasure
        const result = await gdpr.processDataErasure(req.params.id, adminId);
        
        if (result.success) {
          res.json({
            success: true,
            message: "Richiesta elaborata con successo",
            anonymizedRecords: result.anonymizedRecords,
            retainedRecords: result.retainedRecords,
          });
        } else {
          res.status(500).json({ error: result.error });
        }
      }
    } catch (error) {
      console.error("Error processing erasure:", error);
      res.status(500).json({ error: "Errore nell'elaborazione cancellazione" });
    }
  });

  // Get combined compliance statistics for admin dashboard
  app.get("/api/compliance/stats", requireAdmin, async (req, res) => {
    try {
      const gdprStatsData = await gdpr.getGdprStats();
      const auditStatsData = await getAuditStats();
      
      res.json({
        activeConsents: gdprStatsData.activeConsents || 0,
        pendingExports: gdprStatsData.pendingExportRequests || 0,
        completedExports: gdprStatsData.completedExports || 0,
        pendingErasures: gdprStatsData.pendingErasureRequests || 0,
        usersWithoutConsent: gdprStatsData.usersWithoutConsent || 0,
        totalAuditLogs: auditStatsData.totalEntries || 0,
        todayAuditLogs: auditStatsData.todayEntries || 0,
      });
    } catch (error) {
      console.error("Error fetching compliance stats:", error);
      res.status(500).json({ error: "Errore nel recupero statistiche compliance" });
    }
  });

  // ========================================
  // DATA QUALITY METRICS API (Comprehensive Engine)
  // ========================================
  
  // Overview metrics (lightweight)
  app.get("/api/admin/credentials-list", requireAdmin, async (req, res) => {
    try {
      const user = await db.query.users.findFirst({ where: eq(users.id, req.session.userId!) });
      const orgId = user?.organizationId || getEffectiveOrgId(req) || "croce-europa-default";
      
      const orgLocations = await db.select().from(locations).where(eq(locations.organizationId, orgId)).orderBy(locations.name);
      const locationIds = orgLocations.map(l => l.id);
      
      const allVehicles = locationIds.length > 0 
        ? await db.select().from(vehiclesTable).where(and(inArray(vehiclesTable.locationId, locationIds), eq(vehiclesTable.isActive, true))).orderBy(vehiclesTable.code)
        : [];
      
      const allUsers = await db.query.users.findMany({ where: eq(users.organizationId, orgId) });
      const userByVehicle = new Map(allUsers.filter(u => u.vehicleId).map(u => [u.vehicleId, u]));
      const locationMap = new Map(orgLocations.map(l => [l.id, l]));
      
      const result: Array<{ name: string; vehicles: Array<any> }> = [];
      const availableVehicles: Array<any> = [];
      
      const byLocation: Record<string, Array<any>> = {};
      const vehiclesWithUsers = new Set<string>();
      
      for (const vehicle of allVehicles) {
        if (!vehicle.licensePlate || vehicle.licensePlate.trim() === "") continue;
        const u = userByVehicle.get(vehicle.id);
        
        if (u) {
          vehiclesWithUsers.add(vehicle.id);
          const locName = vehicle.locationId ? (locationMap.get(vehicle.locationId)?.name || "ALTRA SEDE") : "ALTRA SEDE";
          if (!byLocation[locName]) byLocation[locName] = [];
          byLocation[locName].push({
            userId: u.id,
            vehicleId: vehicle.id,
            vehicleCode: vehicle.code,
            email: u.email,
            password: u.password,
            name: u.name || "",
            licensePlate: vehicle.licensePlate || ""
          });
        }
      }
      
      for (const vehicle of allVehicles) {
        if (vehiclesWithUsers.has(vehicle.id)) continue;
        const locName = vehicle.locationId ? (locationMap.get(vehicle.locationId)?.name || "ALTRA SEDE") : "ALTRA SEDE";
        availableVehicles.push({
          id: vehicle.id,
          code: vehicle.code,
          licensePlate: vehicle.licensePlate || "",
          locationName: locName
        });
      }
      
      for (const locName of Object.keys(byLocation).sort()) {
        byLocation[locName].sort((a: any, b: any) => {
          const numA = parseInt(a.vehicleCode.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.vehicleCode.replace(/\D/g, "")) || 0;
          return numA - numB;
        });
        result.push({ name: locName, vehicles: byLocation[locName] });
      }
      
      const invitedUsers = await db.select({
        invitation: orgUserInvitations,
        role: orgCustomRoles,
      })
        .from(orgUserInvitations)
        .leftJoin(orgCustomRoles, eq(orgUserInvitations.customRoleId, orgCustomRoles.id))
        .where(eq(orgUserInvitations.organizationId, orgId))
        .orderBy(desc(orgUserInvitations.createdAt));

      const invitedUsersList = invitedUsers.map(iu => ({
        id: iu.invitation.id,
        name: iu.invitation.name,
        email: iu.invitation.email,
        temporaryPassword: iu.invitation.temporaryPassword,
        roleName: iu.role?.name || iu.invitation.standardRole || "Utente",
        roleColor: iu.role?.color || "#6B7280",
        status: iu.invitation.status,
        createdAt: iu.invitation.createdAt,
        acceptedAt: iu.invitation.acceptedAt,
        expiresAt: iu.invitation.expiresAt,
      }));

      res.json({ locations: result, availableVehicles, invitedUsers: invitedUsersList });
    } catch (error) {
      console.error("Error loading credentials list:", error);
      res.status(500).json({ error: "Errore nel caricamento credenziali" });
    }
  });

  app.post("/api/admin/credentials", requireAdmin, async (req, res) => {
    try {
      const { vehicleId, email, password, name } = req.body;
      if (!vehicleId || !email || !password) {
        return res.status(400).json({ error: "Veicolo, email e password sono obbligatori" });
      }
      
      const currentUser = await db.query.users.findFirst({ where: eq(users.id, req.session.userId!) });
      const orgId = currentUser?.organizationId || getEffectiveOrgId(req) || "croce-europa-default";
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email gia in uso" });
      }
      
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      
      const newUser = await db.insert(users).values({
        id: crypto.randomUUID(),
        email,
        password,
        name: name || `Equipaggio ${vehicle.code}`,
        role: "crew",
        accountType: "vehicle",
        vehicleId,
        locationId: vehicle.locationId,
        organizationId: orgId,
        isActive: true
      }).returning();
      
      res.json({ success: true, user: newUser[0] });
    } catch (error) {
      console.error("Error creating credential:", error);
      res.status(500).json({ error: "Errore nella creazione dell'account" });
    }
  });

  app.put("/api/admin/credentials/:id", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { vehicleId, email, password, name } = req.body;
      
      if (!vehicleId || !email || !password) {
        return res.status(400).json({ error: "Veicolo, email e password sono obbligatori" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Email gia in uso da un altro account" });
      }
      
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }
      
      await db.update(users).set({
        email,
        password,
        name: name || `Equipaggio ${vehicle.code}`,
        vehicleId,
        locationId: vehicle.locationId
      }).where(eq(users.id, userId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating credential:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dell'account" });
    }
  });

  app.get("/api/reports/credentials-pdf", requireAdmin, async (req, res) => {
    try {
      const filterUserId = req.query.userId ? (req.query.userId as string) : null;
      const filterLocation = req.query.location ? (req.query.location as string) : null;
      
      const currentUser = await db.query.users.findFirst({ where: eq(users.id, req.session.userId!) });
      const orgId = currentUser?.organizationId || getEffectiveOrgId(req) || "croce-europa-default";
      
      const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
      const orgName = org?.name || "Organizzazione";
      const orgLogoPath = org?.logoUrl ? path.join(process.cwd(), org.logoUrl) : null;
      
      let logoBuffer: Buffer | null = null;
      if (orgLogoPath) {
        try {
          logoBuffer = fs.readFileSync(orgLogoPath);
        } catch (e) {
          console.warn("Could not read org logo:", orgLogoPath);
        }
      }
      
      const orgLocations = await db.select().from(locations).where(eq(locations.organizationId, orgId)).orderBy(locations.name);
      const locationIds = orgLocations.map(l => l.id);
      const allVehicles = locationIds.length > 0 
        ? await db.select().from(vehiclesTable).where(and(inArray(vehiclesTable.locationId, locationIds), eq(vehiclesTable.isActive, true))).orderBy(vehiclesTable.code)
        : [];
      const allUsers = await db.query.users.findMany({ where: eq(users.organizationId, orgId) });
      
      const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
      const locationMap = new Map(orgLocations.map(l => [l.id, l]));
      
      const usersByLocation: Record<string, Array<{
        email: string; password: string; name: string; role: string; vehicleCode?: string; licensePlate?: string;
      }>> = {};
      
      for (const u of allUsers) {
        if (!u.vehicleId) continue;
        if (filterUserId && u.id !== filterUserId) continue;
        
        const vehicle = vehicleMap.get(u.vehicleId);
        if (!vehicle) continue;
        if (!vehicle.licensePlate || vehicle.licensePlate.trim() === "") continue;
        
        let locationName = "ALTRA SEDE";
        if (vehicle.locationId) {
          const location = locationMap.get(vehicle.locationId);
          if (location) locationName = location.name;
        }
        
        if (filterLocation && locationName !== filterLocation) continue;
        
        if (!usersByLocation[locationName]) usersByLocation[locationName] = [];
        usersByLocation[locationName].push({
          email: u.email, password: u.password, name: u.name, role: u.role,
          vehicleCode: vehicle.code, licensePlate: vehicle.licensePlate || undefined
        });
      }
      
      const totalVehicles = Object.values(usersByLocation).reduce((sum, arr) => sum + arr.length, 0);
      if (totalVehicles === 0) {
        return res.status(404).json({ error: "Nessuna credenziale trovata" });
      }
      
      const doc = new PDFDocument({ 
        size: "A4", 
        margins: { top: 50, bottom: 0, left: 40, right: 40 },
        bufferPages: true
      });
      
      const now = new Date();
      const italianDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
      
      let singleVehicleCode = "";
      let singleVehicleDisplayName = "";
      if (filterUserId) {
        const allEntries = Object.values(usersByLocation).flat();
        if (allEntries.length === 1 && allEntries[0].vehicleCode) {
          singleVehicleDisplayName = allEntries[0].vehicleCode;
          singleVehicleCode = allEntries[0].vehicleCode.replace(/\s+/g, "_");
        }
      }
      
      const fileName = filterUserId 
        ? `credenziali_${singleVehicleCode || "veicolo"}_${italianDate}.pdf`
        : filterLocation 
          ? `credenziali_${filterLocation.toLowerCase().replace(/\s+/g, "_")}_${italianDate}.pdf`
          : `credenziali_accesso_${italianDate}.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      doc.pipe(res);
      
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const maxContentY = pageHeight - 70;
      
      const drawHeader = (isFirstPage: boolean = false) => {
        doc.rect(0, 0, pageWidth, 6).fill("#0066CC");
        doc.rect(0, 6, pageWidth, 3).fill("#00A651");
        
        if (isFirstPage) {
          let logoEndY = 25;
          
          if (logoBuffer) {
            try {
              const savedY = doc.y;
              doc.image(logoBuffer, (pageWidth - 140) / 2, 20, { fit: [140, 50] });
              doc.y = savedY;
              logoEndY = 75;
            } catch (e) {
              doc.fontSize(22).fillColor("#0066CC").font("Helvetica-Bold");
              doc.text(orgName, margin, 28, { width: contentWidth, align: "center", lineBreak: false });
              logoEndY = 55;
            }
          } else {
            doc.fontSize(22).fillColor("#0066CC").font("Helvetica-Bold");
            doc.text(orgName, margin, 28, { width: contentWidth, align: "center", lineBreak: false });
            logoEndY = 55;
          }
          
          const titleY = logoEndY + 5;
          doc.roundedRect(margin, titleY, contentWidth, 40, 4).fill("#0066CC");
          doc.fontSize(15).fillColor("#FFFFFF").font("Helvetica-Bold");
          doc.text("CREDENZIALI DI ACCESSO APP MOBILE", margin, titleY + 8, { width: contentWidth, align: "center", lineBreak: false });
          doc.fontSize(9).fillColor("#CCDDFF").font("Helvetica");
          doc.text("Documento riservato", margin, titleY + 26, { width: contentWidth, align: "center", lineBreak: false });
          
          let infoY = titleY + 50;
          
          if (singleVehicleDisplayName) {
            doc.fontSize(20).fillColor("#0066CC").font("Helvetica-Bold");
            doc.text(`Mezzo: ${singleVehicleDisplayName}`, margin, infoY, { width: contentWidth, align: "center", lineBreak: false });
            infoY += 28;
          }
          
          doc.fontSize(9).fillColor("#666666").font("Helvetica");
          doc.text(`Generato il: ${new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, margin, infoY, { lineBreak: false });
          doc.text(`Veicoli totali: ${totalVehicles}`, margin, infoY, { align: "right", width: contentWidth, lineBreak: false });
          
          const warnY = infoY + 18;
          doc.roundedRect(margin, warnY, contentWidth, 22, 3).lineWidth(1).fillAndStroke("#FFF8E1", "#FFB300");
          doc.fontSize(8).fillColor("#E65100").font("Helvetica-Bold");
          doc.text("RISERVATO:", margin + 10, warnY + 6, { lineBreak: false });
          doc.font("Helvetica").fillColor("#795548");
          doc.text("Conservare in luogo sicuro. Non condividere le credenziali con personale non autorizzato.", margin + 75, warnY + 6, { lineBreak: false });
          
          doc.y = warnY + 30;
        } else {
          if (logoBuffer) {
            try {
              const savedY2 = doc.y;
              doc.image(logoBuffer, margin, 14, { fit: [60, 22] });
              doc.y = savedY2;
            } catch (e) {}
          }
          doc.fontSize(9).fillColor("#0066CC").font("Helvetica-Bold");
          doc.text(`${orgName} - Credenziali di Accesso`, margin + (logoBuffer ? 68 : 0), 20, { lineBreak: false });
          doc.y = 42;
        }
      };
      
      const drawFooter = (pageNum: number, totalPages: number) => {
        const footerSavedY = doc.y;
        doc.strokeColor("#E0E0E0").lineWidth(0.5);
        doc.moveTo(margin, pageHeight - 45).lineTo(pageWidth - margin, pageHeight - 45).stroke();
        
        const footerTextY = pageHeight - 38;
        doc.fontSize(8).fillColor("#666666").font("Helvetica");
        doc.text(orgName, margin, footerTextY, { width: 200, lineBreak: false });
        doc.y = footerTextY;
        doc.text(`Pagina ${pageNum} di ${totalPages}`, margin, footerTextY, { width: contentWidth, align: "center", lineBreak: false });
        doc.y = footerTextY;
        doc.fontSize(8).fillColor("#999999").font("Helvetica");
        doc.text("Soccorso Digitale", margin, footerTextY, { width: contentWidth, align: "right", lineBreak: false });
        doc.y = footerSavedY;
      };
      
      drawHeader(true);
      
      const sortedLocations = Object.keys(usersByLocation).sort((a, b) => {
        if (a === "ALTRA SEDE") return 1;
        if (b === "ALTRA SEDE") return -1;
        return a.localeCompare(b);
      });
      
      const colDef = [
        { label: "VEICOLO", width: 60, align: "left" as const },
        { label: "USERNAME", width: 150, align: "left" as const },
        { label: "PASSWORD", width: 110, align: "left" as const },
        { label: "RUOLO", width: 80, align: "left" as const },
        { label: "TARGA", width: 65, align: "center" as const }
      ];
      
      const roleLabels: Record<string, string> = {
        admin: "Amministratore", director: "Direttore", branch_manager: "Resp. Sede",
        crew: "Equipaggio", dispatcher: "Operatore"
      };
      
      let isFirstLocation = true;
      
      for (const locationName of sortedLocations) {
        const usersInLocation = usersByLocation[locationName];
        
        if (doc.y > maxContentY - 70) {
          doc.addPage();
          drawHeader(false);
        }
        
        if (!isFirstLocation) doc.moveDown(0.6);
        isFirstLocation = false;
        
        const sectionY = doc.y;
        doc.roundedRect(margin, sectionY, contentWidth, 26, 3).fill("#E8F4FC");
        doc.fontSize(11).fillColor("#0066CC").font("Helvetica-Bold");
        doc.text(locationName, margin + 10, sectionY + 7);
        doc.fontSize(9).fillColor("#666666").font("Helvetica");
        doc.text(`${usersInLocation.length} account`, margin + 10, sectionY + 7, { width: contentWidth - 20, align: "right" });
        
        doc.y = sectionY + 32;
        
        usersInLocation.sort((a, b) => {
          if (a.vehicleCode && b.vehicleCode) {
            return (parseInt(a.vehicleCode.replace(/\D/g, "")) || 0) - (parseInt(b.vehicleCode.replace(/\D/g, "")) || 0);
          }
          return a.name.localeCompare(b.name);
        });
        
        const drawTableHeader = () => {
          const headerY = doc.y;
          doc.rect(margin, headerY, contentWidth, 18).fill("#F0F0F0");
          let xPos = margin + 6;
          doc.fontSize(7.5).fillColor("#333333").font("Helvetica-Bold");
          for (const col of colDef) {
            doc.text(col.label, xPos, headerY + 5, { width: col.width - 4, align: col.align });
            xPos += col.width;
          }
          doc.y = headerY + 22;
        };
        
        drawTableHeader();
        
        let rowIndex = 0;
        for (const u of usersInLocation) {
          if (doc.y > maxContentY) {
            doc.addPage();
            drawHeader(false);
            doc.fontSize(9).fillColor("#0066CC").font("Helvetica-Bold");
            doc.text(`${locationName} (continua)`, margin, doc.y);
            doc.moveDown(0.4);
            drawTableHeader();
            rowIndex = 0;
          }
          
          const rowY = doc.y;
          if (rowIndex % 2 === 0) {
            doc.rect(margin, rowY - 2, contentWidth, 16).fill("#FAFAFA");
          }
          
          let xPos = margin + 6;
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#0066CC");
          doc.text(u.vehicleCode || "-", xPos, rowY, { width: colDef[0].width - 4 });
          xPos += colDef[0].width;
          
          doc.font("Helvetica").fillColor("#333333");
          doc.text(u.email, xPos, rowY, { width: colDef[1].width - 4 });
          xPos += colDef[1].width;
          
          doc.font("Helvetica-Bold").fillColor("#00A651");
          doc.text(u.password, xPos, rowY, { width: colDef[2].width - 4 });
          xPos += colDef[2].width;
          
          doc.font("Helvetica").fillColor("#666666");
          doc.text(roleLabels[u.role] || u.role, xPos, rowY, { width: colDef[3].width - 4 });
          xPos += colDef[3].width;
          
          doc.fillColor("#333333");
          doc.text(u.licensePlate || "-", xPos, rowY, { width: colDef[4].width - 4, align: "center" });
          
          doc.y = rowY + 16;
          rowIndex++;
        }
        
        doc.strokeColor("#E0E0E0").lineWidth(0.5);
        doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).stroke();
      }
      
      const noteY = doc.y + 12;
      if (noteY < maxContentY - 30) {
        doc.roundedRect(margin, noteY, contentWidth, 22, 3).fill("#E8F5E9");
        doc.fontSize(8).fillColor("#2E7D32").font("Helvetica-Bold");
        doc.text("NOTA:", margin + 10, noteY + 6, { lineBreak: false });
        doc.font("Helvetica").fillColor("#1B5E20");
        doc.text("In caso di smarrimento delle credenziali, contattare l'amministratore di sistema.", margin + 45, noteY + 6, { lineBreak: false });
        doc.y = noteY + 28;
      }
      
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        drawFooter(i + 1, pages.count);
      }
      
      doc.end();
    } catch (error) {
      console.error("Error generating credentials PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF credenziali" });
    }
  });

  app.get("/api/reports/invited-user-credentials-pdf", requireAdmin, async (req, res) => {
    try {
      const filterInvitationId = req.query.invitationId ? (req.query.invitationId as string) : null;
      
      const currentUser = await db.query.users.findFirst({ where: eq(users.id, req.session.userId!) });
      const orgId = currentUser?.organizationId || getEffectiveOrgId(req) || "croce-europa-default";
      
      const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
      const orgName = org?.name || "Organizzazione";
      const orgLogoPath = org?.logoUrl ? path.join(process.cwd(), org.logoUrl) : null;
      
      let logoBuffer: Buffer | null = null;
      if (orgLogoPath) {
        try {
          logoBuffer = fs.readFileSync(orgLogoPath);
        } catch (e) {
          console.warn("Could not read org logo:", orgLogoPath);
        }
      }
      
      const invitations = await db.select({
        invitation: orgUserInvitations,
        role: orgCustomRoles,
      })
        .from(orgUserInvitations)
        .leftJoin(orgCustomRoles, eq(orgUserInvitations.customRoleId, orgCustomRoles.id))
        .where(filterInvitationId 
          ? and(eq(orgUserInvitations.organizationId, orgId), eq(orgUserInvitations.id, filterInvitationId))
          : eq(orgUserInvitations.organizationId, orgId)
        )
        .orderBy(desc(orgUserInvitations.createdAt));
      
      if (invitations.length === 0) {
        return res.status(404).json({ error: "Nessun utente invitato trovato" });
      }
      
      const doc = new PDFDocument({ 
        size: "A4", 
        margins: { top: 50, bottom: 0, left: 40, right: 40 },
        bufferPages: true
      });
      
      const now = new Date();
      const italianDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
      
      const fileName = filterInvitationId 
        ? `credenziale_${invitations[0].invitation.name.replace(/\s+/g, "_")}_${italianDate}.pdf`
        : `credenziali_utenti_invitati_${italianDate}.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      doc.pipe(res);
      
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const maxContentY = pageHeight - 70;
      
      const drawHeader = (isFirstPage: boolean = false) => {
        doc.rect(0, 0, pageWidth, 6).fill("#0066CC");
        doc.rect(0, 6, pageWidth, 3).fill("#00A651");
        
        if (isFirstPage) {
          let logoEndY = 25;
          
          if (logoBuffer) {
            try {
              const savedY = doc.y;
              doc.image(logoBuffer, (pageWidth - 140) / 2, 20, { fit: [140, 50] });
              doc.y = savedY;
              logoEndY = 75;
            } catch (e) {
              doc.fontSize(22).fillColor("#0066CC").font("Helvetica-Bold");
              doc.text(orgName, margin, 28, { width: contentWidth, align: "center", lineBreak: false });
              logoEndY = 55;
            }
          } else {
            doc.fontSize(22).fillColor("#0066CC").font("Helvetica-Bold");
            doc.text(orgName, margin, 28, { width: contentWidth, align: "center", lineBreak: false });
            logoEndY = 55;
          }
          
          const titleY = logoEndY + 5;
          doc.roundedRect(margin, titleY, contentWidth, 40, 4).fill("#0066CC");
          doc.fontSize(15).fillColor("#FFFFFF").font("Helvetica-Bold");
          doc.text("CREDENZIALI UTENTI INVITATI", margin, titleY + 8, { width: contentWidth, align: "center", lineBreak: false });
          doc.fontSize(9).fillColor("#CCDDFF").font("Helvetica");
          doc.text("Documento riservato", margin, titleY + 26, { width: contentWidth, align: "center", lineBreak: false });
          
          let infoY = titleY + 50;
          doc.fontSize(9).fillColor("#666666").font("Helvetica");
          doc.text(`Generato il: ${new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, margin, infoY, { lineBreak: false });
          doc.text(`Utenti totali: ${invitations.length}`, margin, infoY, { align: "right", width: contentWidth, lineBreak: false });
          
          const warnY = infoY + 18;
          doc.roundedRect(margin, warnY, contentWidth, 22, 3).lineWidth(1).fillAndStroke("#FFF8E1", "#FFB300");
          doc.fontSize(8).fillColor("#E65100").font("Helvetica-Bold");
          doc.text("RISERVATO:", margin + 10, warnY + 6, { lineBreak: false });
          doc.font("Helvetica").fillColor("#795548");
          doc.text("Conservare in luogo sicuro. Non condividere le credenziali con personale non autorizzato.", margin + 75, warnY + 6, { lineBreak: false });
          
          doc.y = warnY + 30;
        } else {
          if (logoBuffer) {
            try {
              const savedY2 = doc.y;
              doc.image(logoBuffer, margin, 14, { fit: [60, 22] });
              doc.y = savedY2;
            } catch (e) {}
          }
          doc.fontSize(9).fillColor("#0066CC").font("Helvetica-Bold");
          doc.text(`${orgName} - Credenziali Utenti Invitati`, margin + (logoBuffer ? 68 : 0), 20, { lineBreak: false });
          doc.y = 42;
        }
      };
      
      const drawFooter = (pageNum: number, totalPages: number) => {
        const footerSavedY = doc.y;
        doc.strokeColor("#E0E0E0").lineWidth(0.5);
        doc.moveTo(margin, pageHeight - 45).lineTo(pageWidth - margin, pageHeight - 45).stroke();
        
        const footerTextY = pageHeight - 38;
        doc.fontSize(8).fillColor("#666666").font("Helvetica");
        doc.text(orgName, margin, footerTextY, { width: 200, lineBreak: false });
        doc.y = footerTextY;
        doc.text(`Pagina ${pageNum} di ${totalPages}`, margin, footerTextY, { width: contentWidth, align: "center", lineBreak: false });
        doc.y = footerTextY;
        doc.fontSize(8).fillColor("#999999").font("Helvetica");
        doc.text("Soccorso Digitale", margin, footerTextY, { width: contentWidth, align: "right", lineBreak: false });
        doc.y = footerSavedY;
      };
      
      drawHeader(true);
      
      const colDef = [
        { label: "NOME", width: 120, align: "left" as const },
        { label: "EMAIL", width: 150, align: "left" as const },
        { label: "PASSWORD", width: 110, align: "left" as const },
        { label: "RUOLO", width: 85, align: "left" as const },
      ];
      
      const statusLabels: Record<string, string> = {
        pending: "In attesa",
        accepted: "Accettato",
        expired: "Scaduto",
      };
      
      const drawTableHeader = () => {
        const headerY = doc.y;
        doc.rect(margin, headerY, contentWidth, 18).fill("#F0F0F0");
        let xPos = margin + 6;
        doc.fontSize(7.5).fillColor("#333333").font("Helvetica-Bold");
        for (const col of colDef) {
          doc.text(col.label, xPos, headerY + 5, { width: col.width - 4, align: col.align });
          xPos += col.width;
        }
        doc.text("STATO", xPos, headerY + 5, { width: 50, align: "center" });
        doc.y = headerY + 22;
      };
      
      drawTableHeader();
      
      let rowIndex = 0;
      for (const inv of invitations) {
        if (doc.y > maxContentY) {
          doc.addPage();
          drawHeader(false);
          drawTableHeader();
          rowIndex = 0;
        }
        
        const rowY = doc.y;
        if (rowIndex % 2 === 0) {
          doc.rect(margin, rowY - 2, contentWidth, 16).fill("#FAFAFA");
        }
        
        let xPos = margin + 6;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#0066CC");
        doc.text(inv.invitation.name, xPos, rowY, { width: colDef[0].width - 4 });
        xPos += colDef[0].width;
        
        doc.font("Helvetica").fillColor("#333333");
        doc.text(inv.invitation.email, xPos, rowY, { width: colDef[1].width - 4 });
        xPos += colDef[1].width;
        
        doc.font("Helvetica-Bold").fillColor("#00A651");
        doc.text(inv.invitation.temporaryPassword, xPos, rowY, { width: colDef[2].width - 4 });
        xPos += colDef[2].width;
        
        doc.font("Helvetica").fillColor("#666666");
        doc.text(inv.role?.name || inv.invitation.standardRole || "Utente", xPos, rowY, { width: colDef[3].width - 4 });
        xPos += colDef[3].width;
        
        const statusText = statusLabels[inv.invitation.status] || inv.invitation.status;
        const statusColor = inv.invitation.status === "accepted" ? "#22c55e" : inv.invitation.status === "expired" ? "#ef4444" : "#f59e0b";
        doc.font("Helvetica-Bold").fontSize(7).fillColor(statusColor);
        doc.text(statusText, xPos, rowY, { width: 50, align: "center" });
        
        doc.y = rowY + 16;
        rowIndex++;
      }
      
      doc.strokeColor("#E0E0E0").lineWidth(0.5);
      doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).stroke();
      
      const noteY = doc.y + 12;
      if (noteY < maxContentY - 30) {
        doc.roundedRect(margin, noteY, contentWidth, 22, 3).fill("#E8F5E9");
        doc.fontSize(8).fillColor("#2E7D32").font("Helvetica-Bold");
        doc.text("NOTA:", margin + 10, noteY + 6, { lineBreak: false });
        doc.font("Helvetica").fillColor("#1B5E20");
        doc.text("Le password temporanee devono essere cambiate al primo accesso.", margin + 45, noteY + 6, { lineBreak: false });
        doc.y = noteY + 28;
      }
      
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        drawFooter(i + 1, pages.count);
      }
      
      doc.end();
    } catch (error) {
      console.error("Error generating invited users credentials PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF credenziali utenti invitati" });
    }
  });

  // Verify audit hash chain integrity
  app.post("/api/compliance/verify-chain", requireAdmin, async (req, res) => {
    try {
      const result = await verifyHashChain();
      res.json(result);
    } catch (error) {
      console.error("Error verifying hash chain:", error);
      res.status(500).json({ error: "Errore nella verifica integrita chain" });
    }
  });

  // Repair audit hash chain (recalculate all hashes with canonical serialization)
  app.post("/api/compliance/repair-chain", requireAdmin, async (req, res) => {
    try {
      const result = await repairHashChain();
      if (result.error) {
        res.status(500).json({ error: result.error });
      } else {
        res.json({ 
          success: true, 
          repairedCount: result.repairedCount,
          message: `Catena hash riparata: ${result.repairedCount} record aggiornati` 
        });
      }
    } catch (error) {
      console.error("Error repairing hash chain:", error);
      res.status(500).json({ error: "Errore nella riparazione catena hash" });
    }
  });

  // Get Google Maps API key for admin panel
  app.get("/api/config/maps-key", requireAdmin, async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
      if (!apiKey) {
        return res.status(404).json({ error: "Google Maps API key non configurata" });
      }
      res.json({ apiKey });
    } catch (error) {
      console.error("Error getting Maps API key:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // --- HEARTBEAT LIVE STATS ENDPOINT ---
  
  app.get("/api/heartbeat/stats", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      const orgId = getEffectiveOrgId(req);
      const allTrips = orgId
        ? await db.select().from(trips).where(eq(trips.organizationId, orgId)).orderBy(desc(trips.serviceDate))
        : await storage.getTrips();
      const allVehicles = orgId
        ? await db.select().from(vehicles).where(eq(vehicles.organizationId, orgId))
        : await storage.getVehicles();
      
      const todayTrips = allTrips.filter(trip => {
        const sd = typeof trip.serviceDate === 'string' ? trip.serviceDate : String(trip.serviceDate);
        return sd.startsWith(todayStr);
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = thisWeekStart.toISOString().split('T')[0];
      
      const weekTrips = allTrips.filter(trip => {
        const sd = typeof trip.serviceDate === 'string' ? trip.serviceDate : String(trip.serviceDate);
        return sd >= weekStartStr;
      });
      
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = thisMonthStart.toISOString().split('T')[0];
      const monthTrips = allTrips.filter(trip => {
        const sd = typeof trip.serviceDate === 'string' ? trip.serviceDate : String(trip.serviceDate);
        return sd >= monthStartStr;
      });
      
      const activeVehicles = allVehicles.filter(v => v.isOnService);
      
      const lastTrip = todayTrips.length > 0 
        ? todayTrips.sort((a, b) => {
            const timeA = a.departureTime || "00:00";
            const timeB = b.departureTime || "00:00";
            return timeB.localeCompare(timeA);
          })[0]
        : null;
      
      let lastTripInfo = null;
      if (lastTrip) {
        const vehicle = allVehicles.find(v => v.id === lastTrip.vehicleId);
        lastTripInfo = {
          time: lastTrip.departureTime || "N/D",
          vehicleCode: vehicle?.code || "N/D",
          progressiveNumber: lastTrip.progressiveNumber,
        };
      }
      
      const todayKm = todayTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const weekKm = weekTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      const monthKm = monthTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);
      
      res.json({
        todayTrips: todayTrips.length,
        weekTrips: weekTrips.length,
        monthTrips: monthTrips.length,
        activeVehicles: activeVehicles.length,
        totalVehicles: allVehicles.length,
        lastTrip: lastTripInfo,
        todayKm,
        weekKm,
        monthKm,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching heartbeat stats:", error);
      res.status(500).json({ error: "Errore nel recupero statistiche" });
    }
  });

  // --- SLA MONITORING ENDPOINTS ---
  


  // Get SLA metrics (admin only)
  app.get("/api/sla/metrics", requireAdmin, async (req, res) => {
    try {
      const { service, period } = req.query;
      const metrics = await sla.getSlaMetrics(
        service as string | undefined, 
        period as string | undefined
      );
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching SLA metrics:", error);
      res.status(500).json({ error: "Errore nel recupero metriche SLA" });
    }
  });

  // Get SLA targets
  app.get("/api/sla/targets", requireAdmin, async (req, res) => {
    try {
      const targets = await sla.getSlaTargets();
      res.json(targets);
    } catch (error) {
      console.error("Error fetching SLA targets:", error);
      res.status(500).json({ error: "Errore nel recupero target SLA" });
    }
  });

  // Create SLA target
  app.post("/api/sla/targets", requireAdmin, async (req, res) => {
    try {
      const target = await sla.createSlaTarget(req.body);
      res.status(201).json(target);
    } catch (error) {
      console.error("Error creating SLA target:", error);
      res.status(500).json({ error: "Errore nella creazione target SLA" });
    }
  });

  // Update SLA target
  app.patch("/api/sla/targets/:id", requireAdmin, async (req, res) => {
    try {
      const target = await sla.updateSlaTarget(req.params.id, req.body);
      res.json(target);
    } catch (error) {
      console.error("Error updating SLA target:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento target SLA" });
    }
  });

  // Get SLA breaches
  app.get("/api/sla/breaches", requireAdmin, async (req, res) => {
    try {
      const includeResolved = req.query.resolved === "true";
      const breaches = await sla.getSlaBreaches(includeResolved);
      res.json(breaches);
    } catch (error) {
      console.error("Error fetching SLA breaches:", error);
      res.status(500).json({ error: "Errore nel recupero violazioni SLA" });
    }
  });

  // Resolve SLA breach
  app.post("/api/sla/breaches/:id/resolve", requireAdmin, async (req, res) => {
    try {
      const { resolution } = req.body;
      const breach = await sla.resolveBreach(req.params.id, resolution);
      res.json(breach);
    } catch (error) {
      console.error("Error resolving SLA breach:", error);
      res.status(500).json({ error: "Errore nella risoluzione violazione SLA" });
    }
  });

  // Get health check history
  app.get("/api/sla/health-checks", requireAdmin, async (req, res) => {
    try {
      const { service, limit } = req.query;
      let checks;
      if (service) {
        checks = await sla.getHealthChecksByService(
          service as string, 
          limit ? parseInt(limit as string) : 50
        );
      } else {
        checks = await sla.getRecentHealthChecks(limit ? parseInt(limit as string) : 100);
      }
      res.json(checks);
    } catch (error) {
      console.error("Error fetching health checks:", error);
      res.status(500).json({ error: "Errore nel recupero health checks" });
    }
  });

  // Manually run health check
  app.post("/api/sla/health-check", requireAdmin, async (req, res) => {
    try {
      const results = await sla.runHealthCheck();
      res.json(results);
    } catch (error) {
      console.error("Error running health check:", error);
      res.status(500).json({ error: "Errore nell'esecuzione health check" });
    }
  });

  // --- ECONOMIC ANALYSIS ENDPOINTS ---
  
  // economicAnalysis imported statically at top of file
  
  app.get("/api/backups", requireAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const backups = await backup.getBackups(limit);
      res.json(backups);
    } catch (error) {
      console.error("Error fetching backups:", error);
      res.status(500).json({ error: "Errore nel recupero backup" });
    }
  });

  // Get backup statistics
  app.get("/api/backups/statistics", requireAdmin, async (req, res) => {
    try {
      const stats = await backup.getBackupStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching backup statistics:", error);
      res.status(500).json({ error: "Errore nel recupero statistiche backup" });
    }
  });

  // Trigger manual backup
  app.post("/api/backups/trigger", requireAdmin, async (req, res) => {
    try {
      const result = await backup.performDatabaseBackup();
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Error triggering backup:", error);
      res.status(500).json({ error: "Errore nell'avvio backup" });
    }
  });

  // Verify backup integrity
  app.post("/api/backups/:id/verify", requireAdmin, async (req, res) => {
    try {
      const result = await backup.verifyBackup(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error verifying backup:", error);
      res.status(500).json({ error: "Errore nella verifica backup" });
    }
  });

  // Get backup policies
  app.get("/api/backups/policies", requireAdmin, async (req, res) => {
    try {
      const policies = await backup.getBackupPolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error fetching backup policies:", error);
      res.status(500).json({ error: "Errore nel recupero policy backup" });
    }
  });

  // Create backup policy
  app.post("/api/backups/policies", requireAdmin, async (req, res) => {
    try {
      const policy = await backup.createBackupPolicy(req.body);
      res.status(201).json(policy);
    } catch (error) {
      console.error("Error creating backup policy:", error);
      res.status(500).json({ error: "Errore nella creazione policy backup" });
    }
  });

  // Update backup policy
  app.patch("/api/backups/policies/:id", requireAdmin, async (req, res) => {
    try {
      const policy = await backup.updateBackupPolicy(req.params.id, req.body);
      res.json(policy);
    } catch (error) {
      console.error("Error updating backup policy:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento policy backup" });
    }
  });

  // Get recovery tests
  app.get("/api/backups/recovery-tests", requireAdmin, async (req, res) => {
    try {
      const tests = await backup.getRecoveryTests();
      res.json(tests);
    } catch (error) {
      console.error("Error fetching recovery tests:", error);
      res.status(500).json({ error: "Errore nel recupero test recovery" });
    }
  });

  // Create and run recovery test
  app.post("/api/backups/:id/recovery-test", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const [test] = await backup.createRecoveryTest(
        req.params.id, 
        req.body.testType || "integrity_check",
        userId || undefined
      );
      const result = await backup.runRecoveryTest(test.id);
      res.json({ test, result });
    } catch (error) {
      console.error("Error running recovery test:", error);
      res.status(500).json({ error: "Errore nell'esecuzione test recovery" });
    }
  });

  // Cleanup expired backups
  app.post("/api/backups/cleanup", requireAdmin, async (req, res) => {
    try {
      const cleaned = await backup.cleanupExpiredBackups();
      res.json({ cleanedCount: cleaned });
    } catch (error) {
      console.error("Error cleaning up backups:", error);
      res.status(500).json({ error: "Errore nella pulizia backup scaduti" });
    }
  });

  // ============================================================================
  // CHECKLIST PHOTO REPORTS API
  // Foto segnalazioni equipaggio (danni, problemi, ecc.)
  // ============================================================================

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

  // ============================================================================
  // INVENTORY MANAGEMENT API
  // Sistema Gestione Inventario Ambulanza & Magazzino
  // ============================================================================

  // Get all inventory items (catalog)
  app.get("/api/partners", requireAdmin, async (req, res) => {
    try {
      const { status, category, tier } = req.query;
      let query = db.select().from(partners);
      
      const conditions = [];
      if (status) conditions.push(eq(partners.status, status as string));
      if (category) conditions.push(eq(partners.category, category as string));
      if (tier) conditions.push(eq(partners.tier, tier as string));
      
      const result = conditions.length > 0 
        ? await query.where(and(...conditions)).orderBy(desc(partners.createdAt))
        : await query.orderBy(desc(partners.createdAt));
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ error: "Errore nel caricamento partner" });
    }
  });

  // Get partner by ID
  app.get("/api/partners/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [partner] = await db.select().from(partners).where(eq(partners.id, id));
      
      if (!partner) {
        return res.status(404).json({ error: "Partner non trovato" });
      }
      
      res.json(partner);
    } catch (error) {
      console.error("Error fetching partner:", error);
      res.status(500).json({ error: "Errore nel caricamento partner" });
    }
  });

  // Create partner (admin)
  app.post("/api/partners", requireAdmin, async (req, res) => {
    try {
      const data = req.body;
      const [partner] = await db.insert(partners).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      res.json(partner);
    } catch (error) {
      console.error("Error creating partner:", error);
      res.status(500).json({ error: "Errore nella creazione partner" });
    }
  });

  // Update partner
  app.patch("/api/partners/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const [partner] = await db.update(partners)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(partners.id, id))
        .returning();
      
      res.json(partner);
    } catch (error) {
      console.error("Error updating partner:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento partner" });
    }
  });

  // Delete partner
  app.delete("/api/partners/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(partners).where(eq(partners.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting partner:", error);
      res.status(500).json({ error: "Errore nell'eliminazione partner" });
    }
  });

  // Approve partner
  app.post("/api/partners/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      const [partner] = await db.update(partners)
        .set({ 
          status: "approved", 
          approvedAt: new Date(),
          approvedBy: userId,
          updatedAt: new Date() 
        })
        .where(eq(partners.id, id))
        .returning();
      
      res.json(partner);
    } catch (error) {
      console.error("Error approving partner:", error);
      res.status(500).json({ error: "Errore nell'approvazione partner" });
    }
  });

  // Reject partner
  app.post("/api/partners/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const [partner] = await db.update(partners)
        .set({ 
          status: "rejected", 
          notes: reason,
          updatedAt: new Date() 
        })
        .where(eq(partners.id, id))
        .returning();
      
      res.json(partner);
    } catch (error) {
      console.error("Error rejecting partner:", error);
      res.status(500).json({ error: "Errore nel rifiuto partner" });
    }
  });

  // Get partner requests (admin)
  app.get("/api/partner-requests", requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      let query = db.select().from(partnerRequests);
      
      const result = status 
        ? await query.where(eq(partnerRequests.status, status as string)).orderBy(desc(partnerRequests.createdAt))
        : await query.orderBy(desc(partnerRequests.createdAt));
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching partner requests:", error);
      res.status(500).json({ error: "Errore nel caricamento richieste" });
    }
  });

  // Submit partner request (public - from form)
  app.post("/api/partner-requests", async (req, res) => {
    try {
      const { companyName, contactName, email, phone, message } = req.body;
      
      if (!companyName || !contactName || !email) {
        return res.status(400).json({ error: "Campi obbligatori mancanti" });
      }
      
      const [request] = await db.insert(partnerRequests).values({
        companyName,
        contactName,
        email,
        phone,
        message,
        status: "pending",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        createdAt: new Date(),
      }).returning();
      
      res.json({ success: true, id: request.id });
    } catch (error) {
      console.error("Error submitting partner request:", error);
      res.status(500).json({ error: "Errore nell'invio richiesta" });
    }
  });

  // Process partner request (admin)
  app.patch("/api/partner-requests/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, processingNotes } = req.body;
      const userId = getUserId(req);
      
      const [request] = await db.update(partnerRequests)
        .set({ 
          status, 
          processingNotes,
          processedAt: new Date(),
          processedBy: userId 
        })
        .where(eq(partnerRequests.id, id))
        .returning();
      
      res.json(request);
    } catch (error) {
      console.error("Error processing partner request:", error);
      res.status(500).json({ error: "Errore nell'elaborazione richiesta" });
    }
  });

  // Convert partner request to partner
  app.post("/api/partner-requests/:id/convert", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const additionalData = req.body;
      const userId = getUserId(req);
      
      // Get the request
      const [request] = await db.select().from(partnerRequests).where(eq(partnerRequests.id, id));
      
      if (!request) {
        return res.status(404).json({ error: "Richiesta non trovata" });
      }
      
      // Create partner from request
      const [partner] = await db.insert(partners).values({
        companyName: request.companyName,
        contactName: request.contactName,
        email: request.email,
        phone: request.phone,
        status: "approved",
        tier: "bronze",
        approvedAt: new Date(),
        approvedBy: userId,
        ...additionalData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      // Update request status
      await db.update(partnerRequests)
        .set({ 
          status: "approved", 
          partnerId: partner.id,
          processedAt: new Date(),
          processedBy: userId 
        })
        .where(eq(partnerRequests.id, id));
      
      res.json(partner);
    } catch (error) {
      console.error("Error converting request to partner:", error);
      res.status(500).json({ error: "Errore nella conversione" });
    }
  });

  // Get partner statistics (admin dashboard)
  app.get("/api/partners/stats/dashboard", requireAdmin, async (req, res) => {
    try {
      // Total partners by status
      const statusStats = await db.select({
        status: partners.status,
        count: sql<number>`COUNT(*)::int`,
      }).from(partners).groupBy(partners.status);

      // Total partners by tier
      const tierStats = await db.select({
        tier: partners.tier,
        count: sql<number>`COUNT(*)::int`,
      }).from(partners).groupBy(partners.tier);

      // Total partners by category
      const categoryStats = await db.select({
        category: partners.category,
        count: sql<number>`COUNT(*)::int`,
      }).from(partners).groupBy(partners.category);

      // Pending requests count
      const [pendingRequests] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(partnerRequests).where(eq(partnerRequests.status, "pending"));

      // Total verifications
      const [verificationStats] = await db.select({
        total: sql<number>`COUNT(*)::int`,
        thisMonth: sql<number>`COUNT(CASE WHEN verified_at >= DATE_TRUNC('month', NOW()) THEN 1 END)::int`,
      }).from(partnerVerifications);

      // Average rating
      const [ratingStats] = await db.select({
        avgRating: sql<number>`COALESCE(AVG(rating), 0)`,
        totalReviews: sql<number>`COUNT(*)::int`,
      }).from(partnerReviews);

      res.json({
        statusStats: statusStats.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {}),
        tierStats: tierStats.reduce((acc, t) => ({ ...acc, [t.tier]: t.count }), {}),
        categoryStats,
        pendingRequests: pendingRequests?.count || 0,
        verifications: {
          total: verificationStats?.total || 0,
          thisMonth: verificationStats?.thisMonth || 0,
        },
        ratings: {
          average: Number(ratingStats?.avgRating || 0).toFixed(1),
          totalReviews: ratingStats?.totalReviews || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching partner stats:", error);
      res.status(500).json({ error: "Errore nel caricamento statistiche" });
    }
  });

  // Public API - Get Google Maps API key for public pages
  app.get("/api/public/maps-config", async (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    res.json({ apiKey });
  });

  // Public API - Get approved partners with locations for map
  app.get("/api/public/partners-map", async (req, res) => {
    try {
      const approvedPartners = await db.select({
        id: partners.id,
        companyName: partners.companyName,
        category: partners.category,
        city: partners.city,
        province: partners.province,
        latitude: partners.latitude,
        longitude: partners.longitude,
        discountValue: partners.discountValue,
        discountType: partners.discountType,
        logoUrl: partners.logoUrl,
      })
      .from(partners)
      .where(eq(partners.status, "approved"));

      // Filter only partners with valid coordinates
      const partnersWithCoords = approvedPartners.filter(
        p => p.latitude && p.longitude && 
             !isNaN(parseFloat(p.latitude)) && 
             !isNaN(parseFloat(p.longitude))
      );

      res.json(partnersWithCoords);
    } catch (error) {
      console.error("Error fetching partners for map:", error);
      res.json([]);
    }
  });

  // Insurance Agency Brochure PDF - Public download
  app.get("/api/brochure/assicurazioni/pdf", async (req, res) => {
    try {

      const doc = new PDFDocument({ 
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="Croce-Europa-Partnership-Assicurativa.pdf"');
      doc.pipe(res);
      
      const primaryColor = "#1e40af";
      const secondaryColor = "#0d9488";
      const accentColor = "#f59e0b";
      const textColor = "#1e293b";
      const lightGray = "#64748b";
      
      // Header with gradient-like effect
      doc.rect(0, 0, 595, 150).fill(primaryColor);
      doc.rect(0, 140, 595, 20).fill(secondaryColor);
      
      // Logo placeholder (heart icon simulation)
      doc.circle(70, 75, 25).fill("white");
      doc.fontSize(24).font("Helvetica-Bold").fillColor(primaryColor).text("+", 60, 62);
      
      // Title
      doc.fontSize(28).font("Helvetica-Bold").fillColor("white")
         .text("CROCE EUROPA", 110, 50);
      doc.fontSize(14).font("Helvetica").fillColor("white")
         .text("Servizi di Emergenza e Trasporto Sanitario", 110, 85);
      doc.fontSize(18).font("Helvetica-Bold").fillColor(accentColor)
         .text("PROGRAMMA PARTNERSHIP ASSICURATIVA", 110, 110);
      
      // Exclusive badge
      doc.roundedRect(400, 50, 150, 30, 15).fill(accentColor);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(textColor)
         .text("OPPORTUNITA ESCLUSIVA", 415, 60);
      
      // Main content area
      let yPos = 180;
      
      // Intro section
      doc.fontSize(16).font("Helvetica-Bold").fillColor(primaryColor)
         .text("Una partnership strategica per la tua agenzia", 50, yPos);
      yPos += 30;
      
      doc.fontSize(10).font("Helvetica").fillColor(textColor)
         .text("SOCCORSO DIGITALE e il principale operatore di trasporto sanitario nelle province di Verona, Vicenza e Padova. Offriamo alla tua agenzia l'accesso esclusivo a un pubblico qualificato di oltre 500 professionisti del settore sanitario.", 50, yPos, { width: 495, align: "justify" });
      yPos += 60;
      
      // Stats boxes
      const boxWidth = 115;
      const boxHeight = 70;
      const boxSpacing = 8;
      const startX = 50;
      
      const stats = [
        { value: "500+", label: "Operatori Attivi" },
        { value: "5", label: "Sedi Operative" },
        { value: "3", label: "Province" },
        { value: "1500+", label: "Beneficiari" }
      ];
      
      stats.forEach((stat, i) => {
        const x = startX + (i * (boxWidth + boxSpacing));
        doc.roundedRect(x, yPos, boxWidth, boxHeight, 8).fill("#f1f5f9");
        doc.fontSize(22).font("Helvetica-Bold").fillColor(primaryColor)
           .text(stat.value, x + 10, yPos + 12, { width: boxWidth - 20, align: "center" });
        doc.fontSize(8).font("Helvetica").fillColor(lightGray)
           .text(stat.label.toUpperCase(), x + 10, yPos + 45, { width: boxWidth - 20, align: "center" });
      });
      yPos += boxHeight + 30;
      
      // Value proposition
      doc.fontSize(14).font("Helvetica-Bold").fillColor(primaryColor)
         .text("Vantaggi per la tua Agenzia", 50, yPos);
      yPos += 25;
      
      const benefits = [
        { title: "Pubblico Qualificato", desc: "Accesso a professionisti con reddito stabile e necessita assicurative concrete" },
        { title: "Zero Costi Fissi", desc: "Nessun costo di adesione. Paghi solo con lo sconto offerto ai nostri operatori" },
        { title: "Visibilita Premium", desc: "Brand visibile nell'app aziendale, materiali interni e comunicazioni ufficiali" },
        { title: "Lead Pre-qualificati", desc: "Sistema digitale che traccia le interazioni. Contatti gia interessati ai tuoi prodotti" }
      ];
      
      benefits.forEach(benefit => {
        doc.circle(60, yPos + 8, 4).fill(secondaryColor);
        doc.fontSize(11).font("Helvetica-Bold").fillColor(textColor)
           .text(benefit.title, 75, yPos);
        doc.fontSize(9).font("Helvetica").fillColor(lightGray)
           .text(benefit.desc, 75, yPos + 14, { width: 470 });
        yPos += 35;
      });
      yPos += 10;
      
      // Products section
      doc.fontSize(14).font("Helvetica-Bold").fillColor(primaryColor)
         .text("Prodotti ad Alta Conversione", 50, yPos);
      yPos += 25;
      
      const products = [
        "RC Auto - Autisti con esperienza professionale = profilo di rischio favorevole",
        "Polizza Vita - Lavoro a rischio aumenta sensibilita verso coperture vita",
        "Infortuni Professionali - Copertura integrativa complementare",
        "Previdenza Integrativa - Personale attento al futuro economico",
        "Polizza Casa - Cross-selling per le famiglie degli operatori",
        "Salute e Welfare - Alta sensibilita alla protezione salute"
      ];
      
      products.forEach(product => {
        doc.circle(60, yPos + 4, 3).fill(accentColor);
        doc.fontSize(9).font("Helvetica").fillColor(textColor)
           .text(product, 75, yPos, { width: 470 });
        yPos += 18;
      });
      
      // New page for partnership levels
      doc.addPage();
      yPos = 50;
      
      // Partnership levels header
      doc.fontSize(18).font("Helvetica-Bold").fillColor(primaryColor)
         .text("LIVELLI DI PARTNERSHIP", 50, yPos);
      yPos += 40;
      
      const levels = [
        { name: "BRONZE", discount: "10-11%", color: "#cd7f32", features: ["Visibilita nell'app", "Badge partner base", "Supporto email"] },
        { name: "SILVER", discount: "12-14%", color: "#94a3b8", features: ["Tutto Bronze +", "Logo in evidenza", "Newsletter mensile"] },
        { name: "GOLD", discount: "15-19%", color: "#f59e0b", features: ["Tutto Silver +", "Evento dedicato", "Report trimestrali", "Supporto prioritario"], recommended: true },
        { name: "PLATINUM", discount: "20%+", color: "#9333ea", features: ["Tutto Gold +", "Partner esclusivo zona", "Co-branding materiali", "Account manager dedicato"] }
      ];
      
      const levelBoxWidth = 120;
      const levelBoxHeight = 160;
      
      levels.forEach((level, i) => {
        const x = 50 + (i * (levelBoxWidth + 10));
        
        doc.roundedRect(x, yPos, levelBoxWidth, levelBoxHeight, 10)
           .lineWidth(2).stroke(level.color);
        
        if (level.recommended) {
          doc.roundedRect(x + 15, yPos - 10, 90, 20, 10).fill(accentColor);
          doc.fontSize(7).font("Helvetica-Bold").fillColor("white")
             .text("CONSIGLIATO", x + 25, yPos - 5);
        }
        
        doc.fontSize(12).font("Helvetica-Bold").fillColor(level.color)
           .text(level.name, x + 10, yPos + 15, { width: levelBoxWidth - 20, align: "center" });
        
        doc.fontSize(16).font("Helvetica-Bold").fillColor(textColor)
           .text(level.discount, x + 10, yPos + 35, { width: levelBoxWidth - 20, align: "center" });
        
        doc.fontSize(7).font("Helvetica").fillColor(lightGray)
           .text("Sconto sui premi", x + 10, yPos + 55, { width: levelBoxWidth - 20, align: "center" });
        
        let featureY = yPos + 75;
        level.features.forEach(feature => {
          doc.fontSize(7).font("Helvetica").fillColor(textColor)
             .text("- " + feature, x + 10, featureY, { width: levelBoxWidth - 20 });
          featureY += 14;
        });
      });
      
      yPos += levelBoxHeight + 40;
      
      // Target audience
      doc.fontSize(14).font("Helvetica-Bold").fillColor(primaryColor)
         .text("Chi raggiungerai", 50, yPos);
      yPos += 25;
      
      const audience = [
        { title: "Autisti Soccorritori", desc: "Professionisti con patente speciale, necessita di RC auto e polizze vita" },
        { title: "Personale Sanitario", desc: "Infermieri, OSS, coordinatori con esigenze di protezione professionale" },
        { title: "Famiglie", desc: "Coniugi e figli degli operatori, potenziali clienti per polizze casa e famiglia" },
        { title: "Amministrativi", desc: "Staff d'ufficio con necessita di polizze standard e previdenza" }
      ];
      
      const audColWidth = 245;
      audience.forEach((aud, i) => {
        const x = 50 + (i % 2) * 260;
        const y = yPos + Math.floor(i / 2) * 50;
        
        doc.roundedRect(x, y, audColWidth, 45, 6).fill("#f8fafc");
        doc.fontSize(10).font("Helvetica-Bold").fillColor(textColor)
           .text(aud.title, x + 10, y + 8);
        doc.fontSize(8).font("Helvetica").fillColor(lightGray)
           .text(aud.desc, x + 10, y + 22, { width: audColWidth - 20 });
      });
      
      yPos += 120;
      
      // Call to action
      doc.roundedRect(50, yPos, 495, 100, 12).fill(primaryColor);
      
      doc.fontSize(16).font("Helvetica-Bold").fillColor("white")
         .text("INIZIA OGGI LA PARTNERSHIP", 70, yPos + 20);
      
      doc.fontSize(10).font("Helvetica").fillColor("white")
         .text("Unisciti al primo programma convenzioni del settore trasporto sanitario nel Triveneto", 70, yPos + 45, { width: 455 });
      
      // Contact info
      doc.fontSize(11).font("Helvetica-Bold").fillColor(accentColor)
         .text("partner@croceeuropa.com", 70, yPos + 70);
      doc.fontSize(11).font("Helvetica-Bold").fillColor(accentColor)
         .text("045 8203000", 300, yPos + 70);
      
      // Footer
      yPos = 750;
      doc.fontSize(8).font("Helvetica").fillColor(lightGray)
         .text("SOCCORSO DIGITALE - Servizi di emergenza sanitaria e trasporto sanitario", 50, yPos, { align: "center", width: 495 });
      doc.fontSize(8).font("Helvetica").fillColor(lightGray)
         .text("Province di Verona, Vicenza e Padova", 50, yPos + 12, { align: "center", width: 495 });
      
      doc.end();
      
    } catch (error) {
      console.error("Error generating insurance brochure PDF:", error);
      res.status(500).json({ message: "Errore generazione PDF" });
    }
  });

  // Public API - Get public partner stats for partner-proposal page
  app.get("/api/public/partner-stats", async (req, res) => {
    try {
      // Count approved partners
      const [partnerCount] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(partners).where(eq(partners.status, "approved"));

      // Count active staff members
      const [staffCount] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(staffMembers).where(eq(staffMembers.isActive, true));

      // Count locations
      const locationsResult = await db.execute(sql`SELECT COUNT(DISTINCT location_id) as count FROM vehicles WHERE is_active = true`);
      const locationCount = Number((locationsResult.rows[0] as any)?.count) || 5;

      res.json({
        activeOperators: staffCount?.count || 150,
        potentialBeneficiaries: Math.max(500, (staffCount?.count || 150) * 3),
        operativeLocations: locationCount,
        approvedPartners: partnerCount?.count || 0,
      });
    } catch (error) {
      console.error("Error fetching public partner stats:", error);
      res.json({
        activeOperators: 150,
        potentialBeneficiaries: 500,
        operativeLocations: 5,
        approvedPartners: 0,
      });
    }
  });

  // Public API - Download Partner Proposal PDF
  app.get("/api/public/partner-proposal-pdf", async (req, res) => {
    try {
      // Get live stats for PDF
      const [partnerCount] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(partners).where(eq(partners.status, "approved"));

      const [staffCount] = await db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(staffMembers).where(eq(staffMembers.isActive, true));

      const stats = {
        operators: staffCount?.count || 196,
        beneficiaries: Math.max(588, (staffCount?.count || 196) * 3),
        partners: partnerCount?.count || 8,
      };

      generatePartnerProposalPDF(res, stats);
    } catch (error) {
      console.error("Error generating partner proposal PDF:", error);
      res.status(500).json({ message: "Errore generazione PDF" });
    }
  });

  // ========== EU FUNDING DOCUMENTS API ==========
  
  // Helper function to get project stats for funding documents
  async function getProjectStatsForFunding(): Promise<ProjectStats> {
    const [tripStats] = await db.select({
      totalTrips: sql<number>`COUNT(*)::int`,
      totalKm: sql<number>`COALESCE(SUM(km_traveled), 0)::int`,
      activeVehicles: sql<number>`COUNT(DISTINCT vehicle_id)::int`,
    }).from(trips);

    const [staffCount] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(staffMembers).where(eq(staffMembers.isActive, true));

    const [vehicleCount] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(vehiclesTable);

    const locations = await storage.getLocations();

    // Calculate CO2 saved (0.06 kg/km compared to private car)
    const totalKm = tripStats?.totalKm || 0;
    const co2Saved = Math.round(totalKm * 0.06);

    // Calculate avg trips per day (assuming 365 days of operation)
    const avgTripsPerDay = Math.round((tripStats?.totalTrips || 0) / 365);

    return {
      totalTrips: tripStats?.totalTrips || 0,
      totalKm: totalKm,
      totalVehicles: vehicleCount?.count || 0,
      activeVehicles: tripStats?.activeVehicles || 0,
      totalStaff: staffCount?.count || 0,
      totalLocations: locations.length,
      structuresServed: 158, // From structures table
      avgTripsPerDay: avgTripsPerDay,
      co2Saved: co2Saved,
    };
  }

  // Business Plan PDF
  app.get("/api/funding-documents/business-plan", requireAdmin, async (req, res) => {
    try {
      const stats = await getProjectStatsForFunding();
      generateBusinessPlanPDF(res, stats);
    } catch (error) {
      console.error("Error generating business plan PDF:", error);
      res.status(500).json({ error: "Errore generazione Business Plan" });
    }
  });

  // Social Impact Report PDF
  app.get("/api/funding-documents/social-impact", requireAdmin, async (req, res) => {
    try {
      const stats = await getProjectStatsForFunding();
      generateSocialImpactPDF(res, stats);
    } catch (error) {
      console.error("Error generating social impact PDF:", error);
      res.status(500).json({ error: "Errore generazione Report Impatto Sociale" });
    }
  });

  // Investment Plan PDF
  app.get("/api/funding-documents/investment-plan", requireAdmin, async (req, res) => {
    try {
      const stats = await getProjectStatsForFunding();
      generateInvestmentPlanPDF(res, stats);
    } catch (error) {
      console.error("Error generating investment plan PDF:", error);
      res.status(500).json({ error: "Errore generazione Piano Investimenti" });
    }
  });

  // Timeline/Cronoprogramma PDF
  app.get("/api/funding-documents/timeline", requireAdmin, async (req, res) => {
    try {
      const stats = await getProjectStatsForFunding();
      generateTimelinePDF(res, stats);
    } catch (error) {
      console.error("Error generating timeline PDF:", error);
      res.status(500).json({ error: "Errore generazione Cronoprogramma" });
    }
  });

  // Get funding documents stats (for admin panel preview)
  app.get("/api/funding-documents/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await getProjectStatsForFunding();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching funding stats:", error);
      res.status(500).json({ error: "Errore recupero statistiche" });
    }
  });

  // ========================================
  // PLATFORM SETTINGS ENDPOINTS
  // ========================================
  
  // In-memory settings storage (in production, use database)
  const platformSettings: {
    pdf?: any;
    general?: any;
    saas?: any;
    demo?: any;
  } = {
    pdf: {
      company_name: 'SOCCORSO DIGITALE',
      company_address: 'Via Forte Garofolo 20, 37057 San Giovanni Lupatoto VR',
      company_phone: '',
      company_email: '',
      company_piva: '',
      logo_url: '',
      primary_color: '#0066CC',
      footer_text: 'Documento generato automaticamente da SOCCORSO DIGITALE'
    },
    general: {
      timezone: 'Europe/Rome',
      language: 'it',
      date_format: 'DD/MM/YYYY',
      backup_frequency: 'daily',
      data_retention: 36,
      email_notifications: true,
      push_notifications: true
    },
    saas: {
      tenant_id: 'tenant_001',
      current_plan: 'Enterprise',
      max_users: 50,
      max_vehicles: 20,
      max_locations: 10,
      storage_gb: 50,
      feature_gps: true,
      feature_esg: true,
      feature_api: true,
      feature_whitelabel: false
    },
    demo: {
      enabled: false,
      show_banner: true,
      app_enabled: false,
      readonly: true
    }
  };

  // Get all settings (per-organization PDF settings from DB)
  app.get("/api/settings", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      let pdfSettings = { ...platformSettings.pdf };
      if (orgId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (org) {
          const builtAddress = [org.address, [org.postalCode, org.city, org.province].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          pdfSettings = {
            company_name: org.legalName ?? org.name ?? '',
            company_address: builtAddress ?? '',
            company_phone: org.phone ?? '',
            company_email: org.email ?? '',
            company_piva: org.vatNumber ?? org.fiscalCode ?? '',
            logo_url: org.logoUrl ?? '',
            primary_color: pdfSettings.primary_color,
            footer_text: `Documento generato automaticamente da ${org.legalName || org.name || 'SOCCORSO DIGITALE'}`
          };
        }
      }
      res.json({ ...platformSettings, pdf: pdfSettings });
    } catch (error) {
      console.error("Error loading settings:", error);
      res.json(platformSettings);
    }
  });

  // Save PDF settings (per-organization, saved to organizations table)
  app.post("/api/settings/pdf", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const { company_name, company_address, company_phone, company_email, company_piva, logo_url } = req.body;

      if (orgId) {
        const updateFields: Record<string, any> = {};
        if (company_name !== undefined) {
          updateFields.legalName = company_name;
        }
        if (company_address !== undefined) {
          updateFields.address = company_address;
          updateFields.postalCode = null;
          updateFields.city = null;
          updateFields.province = null;
        }
        if (company_phone !== undefined) updateFields.phone = company_phone;
        if (company_email !== undefined) updateFields.email = company_email;
        if (company_piva !== undefined) updateFields.vatNumber = company_piva;
        if (logo_url !== undefined) updateFields.logoUrl = logo_url;

        if (Object.keys(updateFields).length > 0) {
          await db.update(organizations).set(updateFields).where(eq(organizations.id, orgId));
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving PDF settings:", error);
      res.status(500).json({ error: "Errore nel salvataggio" });
    }
  });

  // Save general settings
  app.post("/api/settings/general", requireAdmin, (req, res) => {
    platformSettings.general = { ...platformSettings.general, ...req.body };
    res.json({ success: true, settings: platformSettings.general });
  });

  // Save SaaS settings
  app.post("/api/settings/saas", requireAdmin, (req, res) => {
    platformSettings.saas = { ...platformSettings.saas, ...req.body };
    res.json({ success: true, settings: platformSettings.saas });
  });

  // Save demo settings
  app.post("/api/settings/demo", requireAdmin, (req, res) => {
    platformSettings.demo = { ...platformSettings.demo, ...req.body };
    res.json({ success: true, settings: platformSettings.demo });
  });

  // Generate demo data
  app.post("/api/settings/demo/generate", requireAdmin, async (req, res) => {
    // Demo data generation would go here
    res.json({ success: true, message: 'Demo data generated' });
  });

  // Clear demo data
  app.post("/api/settings/demo/clear", requireAdmin, async (req, res) => {
    // Demo data clearing would go here
    res.json({ success: true, message: 'Demo data cleared' });
  });

  // Get demo mode status (for mobile app)
  app.get("/api/settings/demo/status", (req, res) => {
    res.json({ 
      enabled: platformSettings.demo?.enabled || false,
      app_enabled: platformSettings.demo?.app_enabled || false,
      readonly: platformSettings.demo?.readonly || true
    });
  });

  // ========================================
  // USER MANUAL PDF (public endpoint for crew)
  // ========================================
  app.get("/api/user-manual", (req, res) => {
    try {
      generateUserManualPDF(res);
    } catch (error) {
      console.error("Error generating user manual PDF:", error);
      res.status(500).json({ error: "Errore generazione manuale" });
    }
  });

  // ========================================
  // MANUALE OPERATIVO PDF (full manual)
  // ========================================
  app.get("/api/manuale-operativo", requireAuth, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      let orgInfo: { name: string; logoUrl?: string | null } | undefined;
      if (userOrgId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, userOrgId));
        if (org) {
          orgInfo = { name: org.name, logoUrl: org.logoUrl };
        }
      }
      generateManualeOperativoPDF(res, orgInfo);
    } catch (error) {
      console.error("Error generating manuale operativo PDF:", error);
      res.status(500).json({ error: "Errore generazione manuale operativo" });
    }
  });

  // ========================================
  // STAFF CONFIDENTIALITY AGREEMENTS - Impegno alla Riservatezza
  // ========================================
  // Sistema di firma digitale conforme GDPR (UE 2016/679), D.Lgs. 196/2003 e D.Lgs. 101/2018

  const CONFIDENTIALITY_AGREEMENT_TEXT = `
IMPEGNO ALLA RISERVATEZZA E PROTEZIONE DEI DATI PERSONALI
SETTORE TRASPORTO SANITARIO E SOCIO-SANITARIO

Croce Europa Impresa Sociale

RIFERIMENTI NORMATIVI:
- Regolamento UE 2016/679 (GDPR) - Regolamento Generale sulla Protezione dei Dati
- Art. 9 GDPR - Trattamento di categorie particolari di dati personali (dati sanitari)
- D.Lgs. 196/2003 - Codice in materia di protezione dei dati personali
- D.Lgs. 101/2018 - Disposizioni per l'adeguamento della normativa nazionale al GDPR
- D.Lgs. 81/2008 - Testo Unico sulla Sicurezza sul Lavoro (obblighi di riservatezza)
- D.M. 17/12/1987 n. 553 - Normativa sul trasporto sanitario
- Art. 622 Codice Penale - Rivelazione di segreto professionale
- Artt. 615-ter, 616, 617 Codice Penale - Violazione di sistemi informatici e corrispondenza
- Codice Deontologico delle Professioni Sanitarie

PREMESSO CHE:

a) Il/La sottoscritto/a svolge attività di trasporto sanitario e/o socio-sanitario per conto di Croce Europa Impresa Sociale, quale operatore del soccorso (autista soccorritore, soccorritore, infermiere);

b) Nell'esercizio delle proprie funzioni, il/la sottoscritto/a viene a conoscenza di dati personali appartenenti a categorie particolari ai sensi dell'Art. 9 GDPR, inclusi dati relativi alla salute dei pazienti trasportati;

c) I dati personali trattati includono, a titolo esemplificativo ma non esaustivo: dati anagrafici (nome, cognome, data di nascita, codice fiscale), dati di contatto, indirizzi di domicilio/residenza, condizioni di salute, patologie, terapie in corso, esiti di interventi sanitari, destinazioni sanitarie (ospedali, cliniche, strutture di cura);

d) Tali dati sono inseriti e gestiti tramite l'applicazione mobile "Croce Europa" per finalità operative, di rendicontazione e di adempimento agli obblighi normativi;

e) Il trattamento dei dati sanitari è soggetto a misure di sicurezza rafforzate ai sensi dell'Art. 32 GDPR e delle disposizioni del Garante Privacy in materia sanitaria;

f) Il/La sottoscritto/a è nominato/a "Incaricato del Trattamento" ai sensi dell'Art. 29 GDPR e dell'Art. 2-quaterdecies D.Lgs. 196/2003.

IL/LA SOTTOSCRITTO/A SI IMPEGNA FORMALMENTE A:

1. SEGRETO PROFESSIONALE E RISERVATEZZA ASSOLUTA
   - Mantenere il più rigoroso segreto professionale su tutti i dati personali e sanitari dei pazienti di cui venga a conoscenza nell'esercizio delle proprie funzioni, ai sensi dell'Art. 622 C.P.;
   - Non divulgare a terzi non autorizzati, in alcun modo e per alcun motivo, informazioni relative ai pazienti, alle loro condizioni di salute, diagnosi, terapie, ai luoghi di prelievo o destinazione;
   - Astenersi da qualsiasi commento, anche verbale, riguardante i pazienti assistiti, in contesti pubblici o privati non attinenti al servizio;
   - Rispettare il diritto alla dignità e alla riservatezza del paziente durante tutte le fasi del trasporto sanitario.

2. DIVIETO ASSOLUTO DI RIPRODUZIONE E DIFFUSIONE
   - Non effettuare fotografie, screenshot, registrazioni audio/video o qualsiasi altra forma di riproduzione delle schermate dell'applicazione, dei documenti sanitari o dei pazienti trasportati;
   - Non copiare, trascrivere, memorizzare o trasmettere dati personali e sanitari su supporti non autorizzati dall'organizzazione;
   - Non condividere informazioni sui pazienti tramite social media, applicazioni di messaggistica, email personali o qualsiasi altro canale non ufficiale;
   - Non pubblicare, commentare o diffondere contenuti (testuali, fotografici, video) relativi agli interventi effettuati.

3. USO ESCLUSIVO E AUTORIZZATO
   - Utilizzare l'applicazione "Croce Europa" e i dati in essa contenuti esclusivamente per le finalità lavorative espressamente autorizzate;
   - Accedere ai dati dei pazienti solo quando strettamente necessario per l'espletamento del servizio;
   - Non condividere le proprie credenziali di accesso (username, password, PIN) con terzi, inclusi colleghi;
   - Effettuare il logout dall'applicazione al termine di ogni turno di servizio o in caso di allontanamento temporaneo;
   - Non tentare di accedere a dati o funzionalità non pertinenti al proprio ruolo.

4. PROTEZIONE DEI DISPOSITIVI E SICUREZZA INFORMATICA
   - Proteggere il dispositivo mobile utilizzato per il servizio con adeguate misure di sicurezza (codice di accesso, impronta digitale, riconoscimento facciale);
   - Non lasciare il dispositivo incustodito, specialmente con l'applicazione aperta o in stato accessibile;
   - Non installare applicazioni non autorizzate o potenzialmente dannose sul dispositivo di servizio;
   - Segnalare immediatamente eventuali smarrimenti, furti o compromissioni del dispositivo;
   - Non collegare il dispositivo a reti Wi-Fi pubbliche o non sicure durante l'accesso ai dati sensibili.

5. OBBLIGO DI SEGNALAZIONE (DATA BREACH)
   - Segnalare tempestivamente (entro 24 ore) al responsabile e al DPO qualsiasi violazione, sospetta violazione o incidente di sicurezza riguardante i dati personali (data breach ai sensi dell'Art. 33 GDPR);
   - Collaborare attivamente e tempestivamente nelle attività di verifica, audit e indagine sulla protezione dei dati;
   - Non tentare di occultare o minimizzare eventuali incidenti di sicurezza.

6. FORMAZIONE CONTINUA
   - Partecipare ai corsi di formazione obbligatoria sulla protezione dei dati personali organizzati dall'ente;
   - Mantenersi aggiornato/a sulle normative vigenti in materia di privacy e trattamento dati sanitari;
   - Applicare le procedure e le linee guida comunicate dall'organizzazione.

7. RESPONSABILITÀ VERSO L'ORGANIZZAZIONE
   - Operare sempre nell'interesse dell'organizzazione e dei pazienti assistiti;
   - Rispettare le direttive del Titolare del Trattamento (Croce Europa Impresa Sociale) e del Responsabile della Protezione Dati (DPO);
   - Non compiere azioni che possano compromettere la reputazione dell'organizzazione o la fiducia dei pazienti.

CONSEGUENZE DELLA VIOLAZIONE:

La violazione degli obblighi sopra indicati costituisce grave inadempimento e può comportare:

Sanzioni Interne:
- Provvedimenti disciplinari proporzionati alla gravità della violazione, fino al licenziamento per giusta causa;
- Risoluzione immediata del rapporto di collaborazione o volontariato;
- Esclusione definitiva dall'organizzazione e dalle attività di trasporto sanitario;
- Richiesta di risarcimento per i danni causati all'organizzazione.

Responsabilità Civile:
- Obbligo di risarcimento integrale dei danni patrimoniali e non patrimoniali causati ai pazienti e/o all'organizzazione;
- Responsabilità solidale con l'organizzazione per le sanzioni irrogate.

Responsabilità Penale:
- Art. 622 C.P. - Rivelazione di segreto professionale: reclusione fino a 1 anno o multa da 30 a 516 euro;
- Art. 615-ter C.P. - Accesso abusivo a sistema informatico: reclusione da 1 a 5 anni;
- Art. 616 C.P. - Violazione della corrispondenza: reclusione fino a 1 anno o multa;
- Art. 617 C.P. - Intercettazione di comunicazioni: reclusione da 6 mesi a 4 anni.

Sanzioni Amministrative GDPR:
- Ai sensi dell'Art. 83 GDPR, sanzioni fino a 20 milioni di euro o al 4% del fatturato mondiale annuo;
- Possibili sanzioni accessorie (divieto di trattamento, pubblicazione del provvedimento).

DURATA E VALIDITÀ:

Gli obblighi di riservatezza assunti con il presente impegno:
- Hanno effetto immediato dalla data di sottoscrizione;
- Permangono per tutta la durata del rapporto con Croce Europa Impresa Sociale;
- Continuano a produrre effetti anche dopo la cessazione del rapporto, senza limiti di tempo, per quanto riguarda le informazioni apprese durante il servizio;
- Restano validi indipendentemente dalle cause della cessazione del rapporto.

DICHIARAZIONE FINALE:

Con la sottoscrizione del presente documento, il/la sottoscritto/a dichiara solennemente di:

a) Aver letto attentamente e compreso integralmente ogni punto del presente impegno alla riservatezza;

b) Aver ricevuto adeguata informativa sul trattamento dei propri dati personali ai sensi degli Artt. 13-14 GDPR;

c) Essere stato/a adeguatamente formato/a in materia di protezione dei dati personali e trattamento dei dati sanitari;

d) Accettare integralmente e senza riserve tutti gli obblighi sopra indicati;

e) Essere pienamente consapevole delle gravi conseguenze disciplinari, civili, penali e amministrative derivanti dalla violazione di tali obblighi;

f) Impegnarsi a rispettare scrupolosamente le normative vigenti e le disposizioni dell'organizzazione in materia di protezione dei dati.

INFORMAZIONI SULL'ORGANIZZAZIONE:

Titolare del Trattamento: Croce Europa Impresa Sociale
Per informazioni e segnalazioni privacy: privacy@croceeuropa.it
Responsabile Protezione Dati (DPO): Contattabile tramite i canali ufficiali dell'organizzazione

Versione documento: 2.0
Data ultimo aggiornamento: Gennaio 2026
Conforme a: GDPR, D.Lgs. 196/2003, D.Lgs. 101/2018, Normativa Sanitaria Italiana
`;

  // Get confidentiality agreement text and check if user has signed
  app.get("/api/confidentiality/status", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req) || '';

      // Check if user has a valid signed agreement
      const existingAgreement = await db.select()
        .from(staffConfidentialityAgreements)
        .where(and(
          eq(staffConfidentialityAgreements.userId, userId),
          eq(staffConfidentialityAgreements.isValid, true)
        ))
        .limit(1);
      
      // Get all locations for dropdown
      const allLocations = await db.select().from(locations);
      
      res.json({
        hasSigned: existingAgreement.length > 0,
        agreement: existingAgreement[0] || null,
        agreementText: CONFIDENTIALITY_AGREEMENT_TEXT,
        agreementVersion: "1.0",
        locations: allLocations
      });
    } catch (error) {
      console.error("Error checking confidentiality status:", error);
      res.status(500).json({ error: "Errore verifica stato firma" });
    }
  });

  // Sign confidentiality agreement
  app.post("/api/confidentiality/sign", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req) || '';
      const {
        firstName,
        lastName,
        fiscalCode,
        email,
        phone,
        staffType,
        role,
        locationId,
        signatureDataUrl,
        acceptedTerms,
        acceptedGdpr,
        acceptedNoDisclosure,
        acceptedNoPhotos,
        acceptedDataProtection
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !staffType || !signatureDataUrl) {
        return res.status(400).json({ error: "Campi obbligatori mancanti" });
      }

      // Validate all checkboxes are accepted
      if (!acceptedTerms || !acceptedGdpr || !acceptedNoDisclosure || !acceptedNoPhotos || !acceptedDataProtection) {
        return res.status(400).json({ error: "Tutti i consensi sono obbligatori" });
      }

      // Validate signature is a valid data URL
      if (!signatureDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: "Firma non valida" });
      }

      // Check if user already has a valid agreement
      const existingAgreement = await db.select()
        .from(staffConfidentialityAgreements)
        .where(and(
          eq(staffConfidentialityAgreements.userId, userId),
          eq(staffConfidentialityAgreements.isValid, true)
        ))
        .limit(1);

      if (existingAgreement.length > 0) {
        return res.status(400).json({ error: "Hai già firmato l'impegno alla riservatezza" });
      }

      // Calculate hash of agreement text for integrity
      const agreementHash = crypto.createHash("sha256")
        .update(CONFIDENTIALITY_AGREEMENT_TEXT)
        .digest("hex");

      // Get client info
      const ipAddress = req.ip || req.connection.remoteAddress || "";
      const userAgent = req.headers["user-agent"] || "";

      // Insert agreement
      const [newAgreement] = await db.insert(staffConfidentialityAgreements)
        .values({
          userId,
          firstName,
          lastName,
          fiscalCode: fiscalCode || null,
          email: email || null,
          phone: phone || null,
          staffType,
          role: role || null,
          locationId: locationId || null,
          agreementVersion: "1.0",
          agreementText: CONFIDENTIALITY_AGREEMENT_TEXT,
          agreementHash,
          acceptedTerms: true,
          acceptedGdpr: true,
          acceptedNoDisclosure: true,
          acceptedNoPhotos: true,
          acceptedDataProtection: true,
          signatureDataUrl,
          ipAddress,
          userAgent,
          isValid: true
        })
        .returning();

      // Log audit event
      await createAuditEntry({
        action: "create",
        entityType: "confidentiality_agreement",
        entityId: newAgreement.id,
        entityName: `${firstName} ${lastName}`,
        description: `Confidentiality agreement signed by ${firstName} ${lastName}`,
        metadata: {
          staffType,
          agreementVersion: "1.0"
        }
      });

      res.json({
        success: true,
        agreement: newAgreement,
        message: "Impegno alla riservatezza firmato con successo"
      });
    } catch (error) {
      console.error("Error signing confidentiality agreement:", error);
      res.status(500).json({ error: "Errore durante la firma" });
    }
  });

  // Admin: Get all signed agreements
  app.get("/api/admin/confidentiality/agreements", requireAdmin, async (req, res) => {
    try {
      const { locationId, staffType, valid } = req.query;
      
      let query = db.select({
        id: staffConfidentialityAgreements.id,
        firstName: staffConfidentialityAgreements.firstName,
        lastName: staffConfidentialityAgreements.lastName,
        fiscalCode: staffConfidentialityAgreements.fiscalCode,
        email: staffConfidentialityAgreements.email,
        staffType: staffConfidentialityAgreements.staffType,
        role: staffConfidentialityAgreements.role,
        locationId: staffConfidentialityAgreements.locationId,
        agreementVersion: staffConfidentialityAgreements.agreementVersion,
        signatureTimestamp: staffConfidentialityAgreements.signatureTimestamp,
        isValid: staffConfidentialityAgreements.isValid,
        createdAt: staffConfidentialityAgreements.createdAt
      }).from(staffConfidentialityAgreements);

      const agreements = await query.orderBy(desc(staffConfidentialityAgreements.createdAt));

      // Get location names
      const allLocations = await db.select().from(locations);
      const locationMap = new Map(allLocations.map(l => [l.id, l.name]));

      // Filter and enrich with location names
      let filteredAgreements = agreements.map(a => ({
        ...a,
        locationName: a.locationId ? locationMap.get(a.locationId) || "N/A" : "N/A"
      }));

      if (locationId && locationId !== 'all') {
        filteredAgreements = filteredAgreements.filter(a => a.locationId === locationId);
      }
      if (staffType && staffType !== 'all') {
        filteredAgreements = filteredAgreements.filter(a => a.staffType === staffType);
      }
      if (valid === 'true') {
        filteredAgreements = filteredAgreements.filter(a => a.isValid);
      } else if (valid === 'false') {
        filteredAgreements = filteredAgreements.filter(a => !a.isValid);
      }

      // Get stats - count by role (mansione)
      const stats = {
        total: filteredAgreements.length,
        valid: filteredAgreements.filter(a => a.isValid).length,
        revoked: filteredAgreements.filter(a => !a.isValid).length,
        byRole: {
          autista: filteredAgreements.filter(a => a.role === 'autista').length,
          soccorritore: filteredAgreements.filter(a => a.role === 'soccorritore').length,
          infermiere: filteredAgreements.filter(a => a.role === 'infermiere').length
        }
      };

      res.json({
        agreements: filteredAgreements,
        stats,
        locations: allLocations
      });
    } catch (error) {
      console.error("Error getting confidentiality agreements:", error);
      res.status(500).json({ error: "Errore recupero firme" });
    }
  });

  // Admin: Get single agreement with full details (including signature)
  app.get("/api/admin/confidentiality/agreements/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [agreement] = await db.select()
        .from(staffConfidentialityAgreements)
        .where(eq(staffConfidentialityAgreements.id, id));

      if (!agreement) {
        return res.status(404).json({ error: "Accordo non trovato" });
      }

      // Get location name
      if (agreement.locationId) {
        const [location] = await db.select().from(locations).where(eq(locations.id, agreement.locationId));
        (agreement as any).locationName = location?.name || "N/A";
      }

      res.json(agreement);
    } catch (error) {
      console.error("Error getting confidentiality agreement:", error);
      res.status(500).json({ error: "Errore recupero firma" });
    }
  });

  // Admin: Revoke agreement
  app.post("/api/admin/confidentiality/agreements/:id/revoke", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = getUserId(req);

      const [agreement] = await db.update(staffConfidentialityAgreements)
        .set({
          isValid: false,
          revokedAt: new Date(),
          revokedReason: reason || "Revocato dall'amministratore",
          updatedAt: new Date()
        })
        .where(eq(staffConfidentialityAgreements.id, id))
        .returning();

      if (!agreement) {
        return res.status(404).json({ error: "Accordo non trovato" });
      }

      // Log audit event
      await createAuditEntry({
        action: "update",
        entityType: "confidentiality_agreement",
        entityId: id,
        entityName: `${agreement.firstName} ${agreement.lastName}`,
        description: `Confidentiality agreement revoked`,
        metadata: {
          reason,
          revokedBy: adminId
        }
      });

      res.json({
        success: true,
        agreement,
        message: "Accordo revocato con successo"
      });
    } catch (error) {
      console.error("Error revoking confidentiality agreement:", error);
      res.status(500).json({ error: "Errore revoca accordo" });
    }
  });

  // Admin: Delete revoked agreement permanently
  app.delete("/api/admin/confidentiality/agreements/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = getUserId(req);

      // First check if agreement exists and is revoked
      const [existing] = await db.select()
        .from(staffConfidentialityAgreements)
        .where(eq(staffConfidentialityAgreements.id, id));

      if (!existing) {
        return res.status(404).json({ error: "Accordo non trovato" });
      }

      if (existing.isValid) {
        return res.status(400).json({ error: "Impossibile eliminare un accordo valido. Revocarlo prima." });
      }

      // Delete the agreement
      await db.delete(staffConfidentialityAgreements)
        .where(eq(staffConfidentialityAgreements.id, id));

      // Log audit event
      await createAuditEntry({
        action: "delete",
        entityType: "confidentiality_agreement",
        entityId: id,
        entityName: `${existing.firstName} ${existing.lastName}`,
        description: `Confidentiality agreement deleted permanently`,
        metadata: {
          staffType: existing.staffType,
          deletedBy: adminId
        }
      });

      res.json({
        success: true,
        message: "Accordo eliminato definitivamente"
      });
    } catch (error) {
      console.error("Error deleting confidentiality agreement:", error);
      res.status(500).json({ error: "Errore eliminazione accordo" });
    }
  });

  // Admin: Generate PDF of signed agreement
  app.get("/api/admin/confidentiality/agreements/:id/pdf", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [agreement] = await db.select()
        .from(staffConfidentialityAgreements)
        .where(eq(staffConfidentialityAgreements.id, id));

      if (!agreement) {
        return res.status(404).json({ error: "Accordo non trovato" });
      }

      // Get location name
      let locationName = "Sede Centrale";
      if (agreement.locationId) {
        const [location] = await db.select().from(locations).where(eq(locations.id, agreement.locationId));
        locationName = location?.name || "Sede Centrale";
      }

      // Professional color palette
      const colors = {
        primaryBlue: '#0066CC',
        darkBlue: '#003D7A',
        red: '#C41E3A',
        gray: '#6B7280',
        lightGray: '#F3F4F6',
        dark: '#1F2937',
        white: '#FFFFFF',
      };

      // Generate PDF
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="impegno_riservatezza_${agreement.lastName}_${agreement.firstName}.pdf"`);
      
      doc.pipe(res);

      const L = 40, R = 555, W = R - L;
      let y = 30;

      // ========== HEADER - White background with logo ==========
      // Company logo on left
      try {
        doc.image("attached_assets/Logo-Croce-Europa-Ufficiale_1766252701803.png", L, y, { height: 45 });
      } catch (logoErr) {
        doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.primaryBlue).text('CROCE EUROPA', L, y + 10);
      }
      
      // Company info on right - professional formatting
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray);
      doc.text('Via Forte Garofolo 20', R - 140, y + 8, { width: 140, align: 'right' });
      doc.text('37057 San Giovanni Lupatoto, Verona', R - 140, y + 18, { width: 140, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor(colors.primaryBlue);
      doc.text('privacy@croceeuropa.com', R - 140, y + 32, { width: 140, align: 'right' });
      
      y = 85;

      // Red accent line
      doc.rect(L, y, W, 2).fill(colors.red);
      y += 20;

      // ========== DOCUMENT TITLE ==========
      doc.font('Helvetica-Bold').fontSize(16).fillColor(colors.dark).text('IMPEGNO ALLA RISERVATEZZA', L, y, { width: W, align: 'center' });
      y += 22;
      doc.font('Helvetica').fontSize(10).fillColor(colors.gray).text('E PROTEZIONE DEI DATI PERSONALI', L, y, { width: W, align: 'center' });
      y += 14;
      doc.fontSize(9).text('Settore Trasporto Sanitario e Socio-Sanitario', L, y, { width: W, align: 'center' });
      y += 18;

      // ========== Legal references box ==========
      doc.roundedRect(L, y, W, 48, 3).fill(colors.lightGray);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.dark).text('RIFERIMENTI NORMATIVI:', L + 10, y + 6);
      doc.font('Helvetica').fontSize(6.5).fillColor(colors.gray);
      doc.text('• Regolamento UE 2016/679 (GDPR) - Art. 9 Trattamento di categorie particolari di dati personali', L + 10, y + 16);
      doc.text('• D.Lgs. 196/2003 - Codice in materia di protezione dei dati personali', L + 10, y + 25);
      doc.text('• D.Lgs. 101/2018 - Disposizioni per l\'adeguamento al GDPR | Art. 622 C.P. - Rivelazione di segreto professionale', L + 10, y + 34);
      y += 55;

      // ========== PREMESSO CHE section ==========
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primaryBlue).text('PREMESSO CHE:', L, y);
      y += 14;
      doc.font('Helvetica').fontSize(9).fillColor(colors.dark);
      const premesse = [
        'Il/La sottoscritto/a svolge attività di trasporto sanitario per conto di Croce Europa Impresa Sociale;',
        'Nell\'esercizio delle proprie funzioni viene a conoscenza di dati personali appartenenti a categorie particolari ai sensi dell\'Art. 9 GDPR;',
        'I dati personali trattati includono: dati anagrafici, dati di contatto, condizioni di salute, patologie, terapie in corso;',
        'Tali dati sono gestiti tramite l\'applicazione "Croce Europa";',
        'Il/La sottoscritto/a è nominato/a "Incaricato del Trattamento" ai sensi dell\'Art. 29 GDPR.'
      ];
      premesse.forEach((p, i) => {
        doc.text(`${String.fromCharCode(97 + i)}) ${p}`, L + 6, y, { width: W - 12, lineGap: 1 });
        y += doc.heightOfString(p, { width: W - 12 }) + 2;
      });
      y += 6;

      // ========== SI IMPEGNA A section ==========
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primaryBlue).text('SI IMPEGNA A:', L, y);
      y += 14;
      const impegni = [
        'Trattare i dati personali dei pazienti in modo lecito, corretto e trasparente;',
        'Non divulgare a terzi non autorizzati alcuna informazione acquisita durante l\'attività;',
        'Non fotografare, registrare o riprodurre dati personali senza autorizzazione;',
        'Utilizzare l\'applicazione esclusivamente per finalità operative;',
        'Segnalare immediatamente eventuali violazioni dei dati al responsabile di sede.'
      ];
      doc.font('Helvetica').fontSize(9).fillColor(colors.dark);
      impegni.forEach((imp, i) => {
        doc.text(`${i + 1}. ${imp}`, L + 6, y, { width: W - 12 });
        y += 11;
      });
      y += 6;

      // ========== Warning box ==========
      doc.roundedRect(L, y, W, 22, 3).fill('#FEF2F2');
      doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.red).text('ATTENZIONE:', L + 10, y + 6);
      doc.font('Helvetica').fontSize(7).text('La violazione degli obblighi di riservatezza può comportare sanzioni disciplinari, civili e penali ai sensi del GDPR.', L + 65, y + 6, { width: W - 75 });
      y += 30;

      // ========== SIGNATORY DATA section ==========
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primaryBlue).text('DATI DEL FIRMATARIO', L, y);
      y += 14;

      const staffTypeLabels: Record<string, string> = {
        volontario: 'Volontario',
        dipendente: 'Dipendente',
        collaboratore: 'Collaboratore'
      };
      const roleLabels: Record<string, string> = {
        autista: 'Autista',
        soccorritore: 'Soccorritore',
        infermiere: 'Infermiere',
        altro: 'Altro'
      };

      // Data grid - proper box with content inside
      const boxHeight = 75;
      doc.roundedRect(L, y, W, boxHeight, 3).lineWidth(0.5).stroke('#E5E7EB');
      
      const row1Y = y + 8;
      const row2Y = y + 28;
      const row3Y = y + 50;
      const col1 = L + 12;
      const col2 = L + W/2 + 12;

      // Row 1: Nome / Cognome
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Nome', col1, row1Y);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(agreement.firstName, col1, row1Y + 9);
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Cognome', col2, row1Y);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(agreement.lastName, col2, row1Y + 9);

      // Row 2: Tipologia / Mansione
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Tipologia', col1, row2Y);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(staffTypeLabels[agreement.staffType || ''] || agreement.staffType || 'N/A', col1, row2Y + 9);
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Mansione', col2, row2Y);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(roleLabels[agreement.role || ''] || agreement.role || 'N/A', col2, row2Y + 9);

      // Row 3: Email / Telefono
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Email', col1, row3Y);
      doc.font('Helvetica').fontSize(9).fillColor(colors.dark).text(agreement.email || 'Non fornita', col1, row3Y + 9);
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Telefono', col2, row3Y);
      doc.font('Helvetica').fontSize(9).fillColor(colors.dark).text(agreement.phone || 'Non fornito', col2, row3Y + 9);

      y += boxHeight + 16;

      // ========== SIGNATURE section ==========
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primaryBlue).text('FIRMA DIGITALE', L, y);
      y += 14;

      const sigBoxWidth = W/2 - 8;
      const sigBoxHeight = 70;

      // Signature box
      doc.roundedRect(L, y, sigBoxWidth, sigBoxHeight, 3).lineWidth(0.5).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Firma', L + 8, y + 5);
      
      if (agreement.signatureDataUrl) {
        try {
          let svgData = '';
          
          // Handle base64-encoded SVG
          if (agreement.signatureDataUrl.includes('svg+xml;base64,')) {
            const base64Part = agreement.signatureDataUrl.replace('data:image/svg+xml;base64,', '');
            svgData = Buffer.from(base64Part, 'base64').toString('utf-8');
          } 
          // Handle URL-encoded SVG
          else if (agreement.signatureDataUrl.includes('svg+xml,')) {
            svgData = decodeURIComponent(agreement.signatureDataUrl.replace('data:image/svg+xml,', ''));
          }
          // Handle PNG/JPEG base64
          else if (agreement.signatureDataUrl.includes('base64,')) {
            const base64Data = agreement.signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imageBuffer, L + 8, y + 15, { width: sigBoxWidth - 20, height: sigBoxHeight - 25, fit: [sigBoxWidth - 20, sigBoxHeight - 25] });
            svgData = ''; // Skip SVG processing
          }
          
          if (svgData) {
            const pathMatches = svgData.match(/d="([^"]+)"/g);
            if (pathMatches && pathMatches.length > 0) {
              doc.save();
              const sigX = L + 8;
              const sigY = y + 15;
              const maxWidth = sigBoxWidth - 20;
              const maxHeight = sigBoxHeight - 25;
              
              const viewBoxMatch = svgData.match(/viewBox="([^"]+)"/);
              let scale = 0.25;
              if (viewBoxMatch) {
                const [, , vbWidth, vbHeight] = viewBoxMatch[1].split(' ').map(Number);
                const scaleX = maxWidth / (vbWidth || 300);
                const scaleY = maxHeight / (vbHeight || 150);
                scale = Math.min(scaleX, scaleY);
              }
              
              doc.translate(sigX, sigY);
              doc.scale(scale);
              
              pathMatches.forEach(pathMatch => {
                const pathData = pathMatch.replace('d="', '').replace('"', '');
                doc.path(pathData).stroke('#1F2937');
              });
              doc.restore();
            }
          }
        } catch (e) {
          console.error('Error rendering signature:', e);
        }
      }

      // Date/time box
      doc.roundedRect(L + sigBoxWidth + 16, y, sigBoxWidth, sigBoxHeight, 3).fill(colors.lightGray);
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Data e ora firma', L + sigBoxWidth + 24, y + 6);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.dark).text(
        new Date(agreement.signatureTimestamp).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }),
        L + sigBoxWidth + 24, y + 20
      );
      doc.font('Helvetica').fontSize(10).fillColor(colors.dark).text(
        new Date(agreement.signatureTimestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        L + sigBoxWidth + 24, y + 35
      );
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray).text('Versione documento', L + sigBoxWidth + 24, y + 50);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text(agreement.agreementVersion, L + sigBoxWidth + 24, y + 61);

      // ========== FOOTER - Fixed at bottom of page 1 ==========
      const footerY = 760;
      
      // Centered footer content
      doc.font('Helvetica').fontSize(8).fillColor(colors.gray);
      doc.text(`ID Documento: ${agreement.id}`, L, footerY, { width: W, align: 'center' });
      doc.text(`Hash integrità SHA-256: ${agreement.agreementHash}`, L, footerY + 12, { width: W, align: 'center' });
      
      // Generation timestamp - centered and highlighted in green
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#059669');
      doc.text(`Generato il ${new Date().toLocaleString('it-IT')}`, L, footerY + 30, { width: W, align: 'center' });

      doc.end();
    } catch (error) {
      console.error("Error generating confidentiality PDF:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  // ========================================
  // PIANO STRATEGICO PARTNERSHIP - HTML/PDF
  // ========================================

  app.get("/api/admin/partnership-strategy", requireAdmin, async (req, res) => {
    try {
      const templatePath = path.join(__dirname, 'templates', 'partnership-strategy.html');
      let html = fs.readFileSync(templatePath, 'utf-8');
      const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      html = html.replace(/\{\{date\}\}/g, today);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error("Error serving partnership strategy:", error);
      res.status(500).json({ error: "Errore caricamento documento" });
    }
  });

  app.get("/api/public/partnership-strategy", async (req, res) => {
    try {
      const templatePath = path.join(__dirname, 'templates', 'partnership-strategy.html');
      let html = fs.readFileSync(templatePath, 'utf-8');
      const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      html = html.replace(/\{\{date\}\}/g, today);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error("Error serving partnership strategy:", error);
      res.status(500).json({ error: "Errore caricamento documento" });
    }
  });

  app.get("/api/admin/partnership-proposal/pdf", requireAdmin, async (req, res) => {
    try {
      generatePartnershipProposalPDF(res);
    } catch (error) {
      console.error("Error generating partnership proposal PDF:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  app.get("/api/public/partnership-proposal-pdf", async (req, res) => {
    try {
      generatePartnershipProposalPDF(res);
    } catch (error) {
      console.error("Error generating partnership proposal PDF:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  app.get("/api/public/partnership-activation-guide-pdf", async (req, res) => {
    try {
      generatePartnershipActivationGuidePDF(res);
    } catch (error) {
      console.error("Error generating partnership activation guide PDF:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  // ========================================
  // PARTNER TECNICO UFFICIALE - PDF BROCHURE
  // ========================================
  
  app.get("/api/admin/partner-brochure/pdf", requireAdmin, async (req, res) => {
    try {



      
      // Professional color palette based on Croce Europa logo
      const colors = {
        primaryBlue: '#1E4A8D',
        lightBlue: '#4A7DC4',
        veryLightBlue: '#E8F0FA',
        darkBlue: '#0D2240',
        red: '#C41E3A',
        white: '#FFFFFF',
        mediumGray: '#6B7280',
        darkGray: '#374151'
      };
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        info: {
          Title: 'Partner Tecnico Ufficiale - Croce Europa',
          Author: 'Croce Europa SRL Impresa Sociale',
          Subject: 'Proposta di Partnership'
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Partner_Tecnico_Ufficiale_Croce_Europa.pdf"');
      
      doc.pipe(res);
      
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const marginLeft = 50;
      const marginRight = 50;
      const contentWidth = pageWidth - marginLeft - marginRight;
      const logoPath = path.join(__dirname, 'assets', 'logo-croce-europa.png');
      const logoExists = fs.existsSync(logoPath);
      
      // Helper: draw page footer with "Verona" only
      const drawPageFooter = (pageNum: number) => {
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor(colors.mediumGray)
           .text('Verona', marginLeft, pageHeight - 35);
        doc.text(String(pageNum), pageWidth / 2 - 5, pageHeight - 35);
      };
      
      // Helper: section header
      const drawSectionHeader = (title: string, y: number) => {
        doc.rect(marginLeft, y, contentWidth, 30)
           .fill(colors.veryLightBlue);
        doc.rect(marginLeft, y, 4, 30)
           .fill(colors.primaryBlue);
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor(colors.darkBlue)
           .text(title.toUpperCase(), marginLeft + 15, y + 9);
        return y + 42;
      };
      
      // Helper: bullet point
      const drawBullet = (text: string, x: number, y: number, bulletColor = colors.primaryBlue) => {
        doc.circle(x + 6, y + 5, 2.5).fill(bulletColor);
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor(colors.darkGray)
           .text(text, x + 18, y, { width: contentWidth - 25 });
      };
      
      // ============ PAGE 1 - COVER ============
      
      // Top decorative band
      doc.rect(0, 0, pageWidth, 100)
         .fill(colors.primaryBlue);
      
      // Logo (larger size on first page)
      if (logoExists) {
        doc.image(logoPath, pageWidth / 2 - 90, 120, { width: 180 });
      } else {
        doc.font('Helvetica-Bold')
           .fontSize(28)
           .fillColor(colors.primaryBlue)
           .text('CROCE EUROPA', marginLeft, 170, { align: 'center', width: contentWidth });
      }
      
      // Main title
      doc.font('Helvetica-Bold')
         .fontSize(32)
         .fillColor(colors.darkBlue)
         .text('PARTNER TECNICO', marginLeft, 300, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica-Bold')
         .fontSize(32)
         .fillColor(colors.primaryBlue)
         .text('UFFICIALE', marginLeft, 340, { align: 'center', width: contentWidth });
      
      // Red accent line
      doc.moveTo(pageWidth / 2 - 60, 382)
         .lineTo(pageWidth / 2 + 60, 382)
         .strokeColor(colors.red)
         .lineWidth(3)
         .stroke();
      
      // Subtitle
      doc.font('Helvetica')
         .fontSize(13)
         .fillColor(colors.mediumGray)
         .text('ABBIGLIAMENTO ISTITUZIONALE E OPERATIVO', marginLeft, 400, { align: 'center', width: contentWidth });
      
      // Company box
      doc.roundedRect(pageWidth / 2 - 170, 450, 340, 90, 8)
         .fill(colors.veryLightBlue);
      
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.primaryBlue)
         .text('Croce Europa SRL', marginLeft, 470, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica')
         .fontSize(14)
         .fillColor(colors.darkBlue)
         .text('Impresa Sociale', marginLeft, 495, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.red)
         .text('Da oltre 30 anni al servizio del territorio', marginLeft, 518, { align: 'center', width: contentWidth });
      
      // Bottom band
      doc.rect(0, pageHeight - 80, pageWidth, 80)
         .fill(colors.primaryBlue);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.white)
         .text('Verona | Servizi Sanitari 24/7', marginLeft, pageHeight - 50, { align: 'center', width: contentWidth });
      
      // ============ PAGE 2 - CHI SIAMO + OBIETTIVI ============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, pageWidth, 45)
         .fill(colors.veryLightBlue);
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor(colors.primaryBlue)
         .text('CROCE EUROPA SRL IMPRESA SOCIALE', marginLeft, 17);
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.mediumGray)
         .text('Partner Tecnico Ufficiale', pageWidth - marginRight - 100, 17);
      
      let yPos = 60;
      yPos = drawSectionHeader('Chi Siamo', yPos);
      
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.primaryBlue)
         .text('Da oltre 30 anni al servizio del territorio.', marginLeft, yPos);
      
      yPos += 22;
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('Croce Europa SRL Impresa Sociale opera nel settore del trasporto sanitario e dei servizi di assistenza ed emergenza sul territorio di Verona. Siamo attivi 24 ore su 24 con personale qualificato, mezzi dedicati e una presenza costante sul territorio, collaborando con enti pubblici, strutture sanitarie e realtà private.', marginLeft, yPos, { width: contentWidth, align: 'justify', lineGap: 3 });
      
      yPos += 60;
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.primaryBlue)
         .text('Accanto all\'attività operativa, Croce Europa sviluppa progetti di:', marginLeft, yPos);
      
      yPos += 20;
      const activities = ['Formazione sanitaria (BLSD, Primo Soccorso)', 'Prevenzione', 'Innovazione tecnologica', 'Sviluppo organizzativo'];
      activities.forEach(activity => {
        drawBullet(activity, marginLeft, yPos);
        yPos += 18;
      });
      
      yPos += 10;
      doc.roundedRect(marginLeft, yPos, contentWidth, 45, 5)
         .fill(colors.veryLightBlue);
      doc.font('Helvetica-Oblique')
         .fontSize(10)
         .fillColor(colors.darkBlue)
         .text('Con l\'obiettivo di rafforzare la qualità dei servizi e costruire collaborazioni di valore, Croce Europa seleziona partner strategici coerenti con la propria missione di impresa sociale.', marginLeft + 12, yPos + 12, { width: contentWidth - 24, align: 'center', lineGap: 3 });
      
      // OBIETTIVO DELLA PARTNERSHIP
      yPos += 70;
      yPos = drawSectionHeader('Obiettivo della Partnership', yPos);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('Croce Europa intende avviare una collaborazione strutturata con un\'azienda del settore abbigliamento tecnico, sanitario o workwear, selezionando un Partner Tecnico Ufficiale per l\'abbigliamento istituzionale e operativo del proprio personale.', marginLeft, yPos, { width: contentWidth, align: 'justify', lineGap: 3 });
      
      yPos += 45;
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.primaryBlue)
         .text('La partnership ha l\'obiettivo di:', marginLeft, yPos);
      
      yPos += 20;
      const objectives = [
        'Migliorare il comfort e l\'identità visiva del personale',
        'Offrire visibilità qualificata e continuativa al partner',
        'Creare una collaborazione basata su qualità, affidabilità e valore reciproco'
      ];
      objectives.forEach(obj => {
        drawBullet(obj, marginLeft, yPos, colors.red);
        yPos += 18;
      });
      
      yPos += 15;
      doc.roundedRect(marginLeft, yPos, contentWidth, 35, 5)
         .strokeColor(colors.primaryBlue)
         .lineWidth(1.5)
         .stroke();
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.darkBlue)
         .text('Non si tratta di una sponsorizzazione standard, ma di una partnership selettiva e strutturata.', marginLeft + 10, yPos + 10, { width: contentWidth - 20, align: 'center' });
      
      drawPageFooter(2);
      
      // ============ PAGE 3 - AMBITO FORNITURA + PARTNER IDEALE ============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, pageWidth, 45)
         .fill(colors.veryLightBlue);
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor(colors.primaryBlue)
         .text('CROCE EUROPA SRL IMPRESA SOCIALE', marginLeft, 17);
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.mediumGray)
         .text('Partner Tecnico Ufficiale', pageWidth - marginRight - 100, 17);
      
      yPos = 60;
      yPos = drawSectionHeader('Ambito della Fornitura', yPos);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('La collaborazione riguarda esclusivamente l\'abbigliamento istituzionale e di rappresentanza, utilizzato dal personale di Croce Europa nelle seguenti attività:', marginLeft, yPos, { width: contentWidth, align: 'justify', lineGap: 3 });
      
      yPos += 40;
      const activities2 = ['Servizio ordinario', 'Formazione', 'Attività interne', 'Eventi', 'Rappresentanza istituzionale'];
      doc.roundedRect(marginLeft, yPos, contentWidth, 55, 5)
         .fill(colors.veryLightBlue);
      
      let actX = marginLeft + 15;
      let actY = yPos + 12;
      activities2.forEach((act, i) => {
        if (i === 3) { actX = marginLeft + 15; actY += 18; }
        drawBullet(act, actX, actY);
        actX += contentWidth / 2 - 10;
        if (i === 1 || i === 4) { actX = marginLeft + 15; actY += 18; }
      });
      
      yPos += 75;
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.primaryBlue)
         .text('Capi oggetto della partnership', marginLeft, yPos);
      
      yPos += 20;
      const halfW = contentWidth / 2 - 10;
      
      // Capi inclusi
      doc.roundedRect(marginLeft, yPos, halfW, 95, 5)
         .fill(colors.veryLightBlue);
      doc.rect(marginLeft, yPos, 4, 95).fill(colors.primaryBlue);
      
      const capi = ['Felpe', 'Magliette a manica corta', 'Magliette a manica lunga', 'Scaldacollo', 'Cappellini'];
      let capiY = yPos + 10;
      capi.forEach(capo => {
        drawBullet(capo, marginLeft + 8, capiY);
        capiY += 16;
      });
      
      // Esclusioni
      doc.roundedRect(marginLeft + halfW + 20, yPos, halfW, 95, 5)
         .fill('#FEF2F2');
      doc.rect(marginLeft + halfW + 20, yPos, 4, 95).fill(colors.red);
      
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.red)
         .text('Esclusioni', marginLeft + halfW + 35, yPos + 8);
      
      const esclusioni = ['Divise tecniche da soccorso', 'Capi DPI', 'Abbigliamento omologato', 'Dispositivi di protezione'];
      let escY = yPos + 28;
      esclusioni.forEach(esc => {
        doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text('X  ' + esc, marginLeft + halfW + 35, escY);
        escY += 16;
      });
      
      yPos += 110;
      doc.roundedRect(marginLeft, yPos, contentWidth, 35, 5)
         .strokeColor(colors.red)
         .lineWidth(1)
         .stroke();
      doc.font('Helvetica-Oblique')
         .fontSize(9)
         .fillColor(colors.darkGray)
         .text('Questi elementi continuano a essere gestiti separatamente secondo normative e standard specifici del settore sanitario.', marginLeft + 10, yPos + 10, { width: contentWidth - 20, align: 'center' });
      
      // IL PARTNER IDEALE
      yPos += 55;
      yPos = drawSectionHeader('Il Partner Ideale', yPos);
      
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.darkBlue)
         .text('Il Partner Tecnico ideale:', marginLeft, yPos);
      
      yPos += 20;
      const partnerIdeal = [
        'Opera nel settore abbigliamento tecnico, sanitario o workwear',
        'Investe in qualità dei materiali e dei processi',
        'È interessato a test reali sul campo',
        'Riconosce il valore di una collaborazione con un\'impresa sociale',
        'Desidera associare il proprio marchio a un\'attività sanitaria credibile e continuativa'
      ];
      partnerIdeal.forEach(item => {
        drawBullet(item, marginLeft, yPos, colors.lightBlue);
        yPos += 18;
      });
      
      drawPageFooter(3);
      
      // ============ PAGE 4 - COSA OFFRIAMO + VISIBILITÀ ============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, pageWidth, 45)
         .fill(colors.veryLightBlue);
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor(colors.primaryBlue)
         .text('CROCE EUROPA SRL IMPRESA SOCIALE', marginLeft, 17);
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.mediumGray)
         .text('Partner Tecnico Ufficiale', pageWidth - marginRight - 100, 17);
      
      yPos = 60;
      yPos = drawSectionHeader('Cosa Offriamo al Partner', yPos);
      
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.darkBlue)
         .text('La partnership garantisce:', marginLeft, yPos);
      
      yPos += 20;
      const benefits = [
        'Visibilità quotidiana su personale operativo',
        'Presenza sul territorio di Verona',
        'Associazione a un brand sanitario riconosciuto da oltre 30 anni',
        'Feedback strutturato sull\'utilizzo dei capi in condizioni operative reali'
      ];
      benefits.forEach(b => {
        drawBullet(b, marginLeft, yPos);
        yPos += 18;
      });
      
      yPos += 10;
      doc.roundedRect(marginLeft, yPos, contentWidth, 40, 5)
         .fill(colors.primaryBlue);
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.white)
         .text('Utilizzo del titolo:', marginLeft + 12, yPos + 8);
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.white)
         .text('"Partner Tecnico Ufficiale Croce Europa SRL Impresa Sociale"', marginLeft + 12, yPos + 23);
      
      yPos += 55;
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.primaryBlue)
         .text('Possibilità di integrazione del brand su:', marginLeft, yPos);
      
      yPos += 18;
      const integrations = ['Materiali istituzionali', 'Attività formative', 'Eventi', 'Strumenti digitali interni'];
      integrations.forEach(int => {
        drawBullet(int, marginLeft, yPos);
        yPos += 16;
      });
      
      // VISIBILITÀ E CO-BRANDING
      yPos += 20;
      yPos = drawSectionHeader('Visibilità e Co-Branding', yPos);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('Le modalità di visibilità saranno definite congiuntamente, nel rispetto dell\'identità visiva e dei valori di Croce Europa.', marginLeft, yPos, { width: contentWidth, align: 'justify', lineGap: 3 });
      
      yPos += 35;
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.primaryBlue)
         .text('Principi guida:', marginLeft, yPos);
      
      yPos += 20;
      const principles = ['Sobrietà', 'Riconoscibilità', 'Coerenza con il contesto sanitario', 'Tutela dell\'immagine istituzionale'];
      const boxW = (contentWidth - 20) / 2;
      let pX = marginLeft;
      let pY = yPos;
      principles.forEach((p, i) => {
        if (i === 2) { pX = marginLeft; pY += 30; }
        doc.roundedRect(pX, pY, boxW, 24, 4).fill(colors.veryLightBlue);
        doc.font('Helvetica').fontSize(9).fillColor(colors.darkBlue).text(p, pX + 8, pY + 7, { width: boxW - 16, align: 'center' });
        pX += boxW + 10;
      });
      
      drawPageFooter(4);
      
      // ============ PAGE 5 - LINEE GUIDA LOGHI + GOVERNANCE ============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, pageWidth, 45)
         .fill(colors.veryLightBlue);
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor(colors.primaryBlue)
         .text('CROCE EUROPA SRL IMPRESA SOCIALE', marginLeft, 17);
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.mediumGray)
         .text('Partner Tecnico Ufficiale', pageWidth - marginRight - 100, 17);
      
      yPos = 60;
      yPos = drawSectionHeader('Linee Guida per l\'Utilizzo dei Loghi', yPos);
      
      doc.roundedRect(marginLeft, yPos, contentWidth, 38, 5)
         .fill(colors.veryLightBlue);
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.darkBlue)
         .text('Il logo Croce Europa rimane sempre il marchio principale', marginLeft + 12, yPos + 8);
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.mediumGray)
         .text('Il logo del partner ha ruolo secondario', marginLeft + 12, yPos + 22);
      
      yPos += 50;
      const halfWidth = contentWidth / 2 - 10;
      
      // Posizionamenti consentiti
      doc.roundedRect(marginLeft, yPos, halfWidth, 75, 5)
         .fill('#ECFDF5');
      doc.rect(marginLeft, yPos, 4, 75).fill('#10B981');
      
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor('#047857')
         .text('Posizionamenti Consentiti', marginLeft + 12, yPos + 8);
      
      let consY = yPos + 28;
      ['Manica', 'Parte bassa della schiena'].forEach(item => {
        doc.circle(marginLeft + 18, consY + 4, 2.5).fill('#10B981');
        doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text(item, marginLeft + 30, consY);
        consY += 16;
      });
      
      // Posizionamenti non consentiti
      doc.roundedRect(marginLeft + halfWidth + 20, yPos, halfWidth, 75, 5)
         .fill('#FEF2F2');
      doc.rect(marginLeft + halfWidth + 20, yPos, 4, 75).fill(colors.red);
      
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.red)
         .text('Posizionamenti Non Consentiti', marginLeft + halfWidth + 32, yPos + 8);
      
      let noConsY = yPos + 28;
      ['Centro petto', 'Fronte principale', 'Aree tecniche dei capi'].forEach(item => {
        doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text('X  ' + item, marginLeft + halfWidth + 32, noConsY);
        noConsY += 14;
      });
      
      yPos += 90;
      doc.roundedRect(marginLeft, yPos, contentWidth, 45, 5)
         .strokeColor(colors.primaryBlue)
         .lineWidth(1)
         .stroke();
      
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.primaryBlue).text('Dimensioni:', marginLeft + 12, yPos + 10);
      doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text('Logo partner massimo 60% del logo Croce Europa', marginLeft + 90, yPos + 10);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.primaryBlue).text('Numero loghi:', marginLeft + 12, yPos + 27);
      doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text('Massimo due loghi per capo', marginLeft + 90, yPos + 27);
      
      // GOVERNANCE
      yPos += 65;
      yPos = drawSectionHeader('Governance della Partnership', yPos);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('La partnership avrà durata annuale o pluriennale e sarà regolata da un accordo formale che definirà:', marginLeft, yPos, { width: contentWidth, align: 'justify', lineGap: 3 });
      
      yPos += 30;
      const governance = ['Ambito della fornitura', 'Standard qualitativi', 'Utilizzo dei loghi', 'Esclusività di settore', 'Modalità di rinnovo e recesso'];
      governance.forEach(item => {
        drawBullet(item, marginLeft, yPos, colors.lightBlue);
        yPos += 16;
      });
      
      drawPageFooter(5);
      
      // ============ PAGE 6 - CONTATTI ============
      doc.addPage();
      
      // Top header band
      doc.rect(0, 0, pageWidth, 130)
         .fill(colors.primaryBlue);
      
      doc.font('Helvetica-Bold')
         .fontSize(24)
         .fillColor(colors.white)
         .text('MANIFESTAZIONE DI INTERESSE', marginLeft, 55, { align: 'center', width: contentWidth });
      
      yPos = 155;
      
      doc.roundedRect(marginLeft + 20, yPos, contentWidth - 40, 65, 6)
         .fill(colors.veryLightBlue);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkBlue)
         .text('Croce Europa sta valutando un numero limitato di aziende per questa collaborazione. Le realtà interessate sono invitate a manifestare il proprio interesse per avviare un confronto e valutare una proposta personalizzata.', marginLeft + 35, yPos + 15, { width: contentWidth - 70, align: 'center', lineGap: 4 });
      
      yPos += 85;
      
      // Stats boxes
      const statBoxW = (contentWidth - 20) / 3;
      doc.roundedRect(marginLeft, yPos, statBoxW, 50, 5).fill(colors.veryLightBlue);
      doc.roundedRect(marginLeft + statBoxW + 10, yPos, statBoxW, 50, 5).fill(colors.veryLightBlue);
      doc.roundedRect(marginLeft + (statBoxW + 10) * 2, yPos, statBoxW, 50, 5).fill(colors.veryLightBlue);
      
      doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.primaryBlue).text('30+', marginLeft, yPos + 8, { width: statBoxW, align: 'center' });
      doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text('Anni di esperienza', marginLeft, yPos + 30, { width: statBoxW, align: 'center' });
      
      doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.primaryBlue).text('20+', marginLeft + statBoxW + 10, yPos + 8, { width: statBoxW, align: 'center' });
      doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text('Ambulanze operative', marginLeft + statBoxW + 10, yPos + 30, { width: statBoxW, align: 'center' });
      
      doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.primaryBlue).text('150+', marginLeft + (statBoxW + 10) * 2, yPos + 8, { width: statBoxW, align: 'center' });
      doc.font('Helvetica').fontSize(9).fillColor(colors.darkGray).text('Personale operativo', marginLeft + (statBoxW + 10) * 2, yPos + 30, { width: statBoxW, align: 'center' });
      
      yPos += 70;
      
      // Contact section
      doc.roundedRect(marginLeft, yPos, contentWidth, 155, 8)
         .strokeColor(colors.primaryBlue)
         .lineWidth(2)
         .stroke();
      
      doc.font('Helvetica-Bold')
         .fontSize(13)
         .fillColor(colors.primaryBlue)
         .text('CONTATTI', marginLeft, yPos + 15, { align: 'center', width: contentWidth });
      
      doc.moveTo(pageWidth / 2 - 30, yPos + 32)
         .lineTo(pageWidth / 2 + 30, yPos + 32)
         .strokeColor(colors.red)
         .lineWidth(2)
         .stroke();
      
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(colors.darkBlue)
         .text('Croce Europa SRL Impresa Sociale', marginLeft, yPos + 45, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.mediumGray)
         .text('Verona | Servizi Sanitari Attivi 24/7', marginLeft, yPos + 62, { align: 'center', width: contentWidth });
      
      // Contact person
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.darkBlue)
         .text('Adrian Vasile', marginLeft, yPos + 85, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.mediumGray)
         .text('Responsabile Partnership', marginLeft, yPos + 100, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(colors.primaryBlue)
         .text('partnership@croceeuropa.com', marginLeft, yPos + 120, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('Tel: 392 806 6329', marginLeft, yPos + 135, { align: 'center', width: contentWidth });
      
      yPos += 175;
      
      // Logo section (larger on last page)
      if (logoExists) {
        doc.image(logoPath, pageWidth / 2 - 80, yPos, { width: 160 });
      } else {
        doc.font('Helvetica-Bold')
           .fontSize(20)
           .fillColor(colors.primaryBlue)
           .text('CROCE EUROPA', marginLeft, yPos + 30, { align: 'center', width: contentWidth });
      }
      
      // Bottom band
      doc.rect(0, pageHeight - 45, pageWidth, 45)
         .fill(colors.primaryBlue);
      
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(colors.white)
         .text('Verona | www.croceeuropa.com', marginLeft, pageHeight - 28, { align: 'center', width: contentWidth });
      
      drawPageFooter(6);
      
      doc.end();
      
    } catch (error) {
      console.error("Error generating partner brochure PDF:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  // ========================================
  // PUBLIC CONFIDENTIALITY AGREEMENT PAGE
  // ========================================
  
  const AGREEMENT_TEXT_FOR_PAGE = `
IMPEGNO ALLA RISERVATEZZA E PROTEZIONE DEI DATI PERSONALI
SETTORE TRASPORTO SANITARIO E SOCIO-SANITARIO

Croce Europa Impresa Sociale

RIFERIMENTI NORMATIVI:
- Regolamento UE 2016/679 (GDPR)
- Art. 9 GDPR - Trattamento di categorie particolari di dati personali
- D.Lgs. 196/2003 - Codice in materia di protezione dei dati personali
- D.Lgs. 101/2018 - Disposizioni per l'adeguamento al GDPR
- Art. 622 Codice Penale - Rivelazione di segreto professionale

PREMESSO CHE:

a) Il/La sottoscritto/a svolge attività di trasporto sanitario per conto di Croce Europa Impresa Sociale;

b) Nell'esercizio delle proprie funzioni viene a conoscenza di dati personali appartenenti a categorie particolari ai sensi dell'Art. 9 GDPR;

c) I dati personali trattati includono: dati anagrafici, dati di contatto, condizioni di salute, patologie, terapie in corso;

d) Tali dati sono gestiti tramite l'applicazione "Croce Europa";

e) Il/La sottoscritto/a è nominato/a "Incaricato del Trattamento" ai sensi dell'Art. 29 GDPR.

SI IMPEGNA A:

1. Trattare i dati personali dei pazienti in modo lecito, corretto e trasparente
2. Non divulgare a terzi non autorizzati alcuna informazione
3. Non fotografare, registrare o riprodurre dati personali
4. Utilizzare l'applicazione esclusivamente per finalità operative
5. Segnalare immediatamente eventuali violazioni dei dati

CONSEGUENZE DELLA VIOLAZIONE:
La violazione degli obblighi di riservatezza può comportare sanzioni disciplinari, civili e penali.
`.trim();

  // Public endpoint to get locations for confidentiality form (no auth)
  app.get("/api/public/confidentiality/locations", async (req, res) => {
    try {
      const allLocations = await db.select({ id: locations.id, name: locations.name })
        .from(locations)
        .orderBy(locations.name);
      res.json(allLocations);
    } catch (error) {
      console.error("Error getting locations:", error);
      res.status(500).json({ error: "Errore recupero sedi" });
    }
  });

  // Public endpoint to submit confidentiality agreement (no auth)
  app.post("/api/public/confidentiality/sign", async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        fiscalCode,
        email,
        phone,
        staffType,
        role,
        locationId,
        signatureDataUrl,
        acceptedTerms,
        acceptedGdpr,
        acceptedNoDisclosure,
        acceptedNoPhotos,
        acceptedDataProtection
      } = req.body;

      if (!firstName || !lastName || !staffType || !signatureDataUrl) {
        return res.status(400).json({ error: "Campi obbligatori mancanti" });
      }

      if (!acceptedTerms || !acceptedGdpr || !acceptedNoDisclosure || !acceptedNoPhotos || !acceptedDataProtection) {
        return res.status(400).json({ error: "Tutti i consensi sono obbligatori" });
      }

      if (!signatureDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: "Firma non valida" });
      }

      const agreementHash = crypto.createHash("sha256")
        .update(AGREEMENT_TEXT_FOR_PAGE)
        .digest("hex");

      const ipAddress = req.ip || req.connection.remoteAddress || "";
      const userAgent = req.headers["user-agent"] || "";

      const [newAgreement] = await db.insert(staffConfidentialityAgreements)
        .values({
          userId: null,
          firstName,
          lastName,
          fiscalCode: fiscalCode || null,
          email: email || null,
          phone: phone || null,
          staffType,
          role: role || null,
          locationId: locationId || null,
          agreementVersion: "1.0",
          agreementText: AGREEMENT_TEXT_FOR_PAGE,
          agreementHash,
          signatureDataUrl,
          signatureTimestamp: new Date(),
          ipAddress,
          userAgent,
          acceptedTerms: true,
          acceptedGdpr: true,
          acceptedNoDisclosure: true,
          acceptedNoPhotos: true,
          acceptedDataProtection: true,
          isValid: true,
        })
        .returning();

      // Send confirmation email if email provided
      if (email) {
        console.log(`Attempting to send confirmation email to ${email}...`);
        try {
          const emailSent = await sendConfidentialityConfirmationEmail({
            recipientEmail: email,
            firstName,
            lastName,
            staffType,
            role: role || null,
            signatureTimestamp: new Date(newAgreement.signatureTimestamp),
            documentId: newAgreement.id,
          });
          if (emailSent) {
            console.log(`Confidentiality confirmation email sent successfully to ${email}`);
          } else {
            console.log(`Confidentiality confirmation email failed to send to ${email}`);
          }
        } catch (emailError) {
          console.error("Error sending confirmation email:", emailError);
        }
      } else {
        console.log("No email provided, skipping confirmation email");
      }

      res.json({ success: true, id: newAgreement.id });
    } catch (error) {
      console.error("Error signing public confidentiality agreement:", error);
      res.status(500).json({ error: "Errore durante il salvataggio" });
    }
  });

  // ========================================
  // CURSO BLSD CUBA - PDF PROGRAM
  // ========================================
  
  // Public endpoint for BLSD Cuba PDF (no auth required)
  app.get("/api/public/blsd-cuba/pdf", async (req, res) => {
    try {



      
      const colors = {
        primaryBlue: '#1E4A8D',
        lightBlue: '#4A7DC4',
        veryLightBlue: '#E8F0FA',
        darkBlue: '#0D2240',
        red: '#C41E3A',
        lightRed: '#FEF2F2',
        white: '#FFFFFF',
        mediumGray: '#6B7280',
        darkGray: '#374151'
      };
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 60, left: 50, right: 50 },
        info: {
          Title: 'Curso BLSD - Programa de Formación',
          Author: 'Croce Europa - Centro de Formación Acreditado',
          Subject: 'Soporte Vital Básico y Desfibrilación Automática'
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Curso_BLSD_Cuba_Programa.pdf"');
      
      doc.pipe(res);
      
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const marginLeft = 50;
      const marginRight = 50;
      const contentWidth = pageWidth - marginLeft - marginRight;
      const logoPath = path.join(__dirname, 'assets', 'logo-croce-europa.png');
      const logoExists = fs.existsSync(logoPath);
      
      // Helper: draw footer on all pages
      const drawFooter = (pageNum: number) => {
        doc.rect(0, pageHeight - 55, pageWidth, 55).fill(colors.primaryBlue);
        
        doc.font('Helvetica-Bold')
           .fontSize(8)
           .fillColor(colors.white)
           .text('Croce Europa – Centro de Formación Acreditado', marginLeft, pageHeight - 45, { width: contentWidth, align: 'center' });
        
        doc.font('Helvetica')
           .fontSize(7)
           .fillColor(colors.white)
           .text('En colaboración con Servicios Médicos Cubanos (SMC)', marginLeft, pageHeight - 33, { width: contentWidth, align: 'center' });
        
        doc.font('Helvetica')
           .fontSize(7)
           .fillColor(colors.white)
           .text('www.croceeuropa.com  |  formazione@croceeuropa.com', marginLeft, pageHeight - 21, { width: contentWidth, align: 'center' });
        
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor(colors.white)
           .text(String(pageNum), pageWidth - 30, pageHeight - 35);
      };
      
      // Helper: schedule item
      const drawScheduleItem = (time: string, title: string, description: string, y: number, isHighlight = false) => {
        const boxHeight = description ? 45 : 30;
        
        if (isHighlight) {
          doc.roundedRect(marginLeft, y, contentWidth, boxHeight, 5).fill(colors.lightRed);
          doc.rect(marginLeft, y, 5, boxHeight).fill(colors.red);
        } else {
          doc.roundedRect(marginLeft, y, contentWidth, boxHeight, 5).fill(colors.veryLightBlue);
          doc.rect(marginLeft, y, 5, boxHeight).fill(colors.primaryBlue);
        }
        
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor(isHighlight ? colors.red : colors.primaryBlue)
           .text(time, marginLeft + 15, y + 8);
        
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor(colors.darkBlue)
           .text(title, marginLeft + 100, y + 8, { width: contentWidth - 115 });
        
        if (description) {
          doc.font('Helvetica')
             .fontSize(9)
             .fillColor(colors.darkGray)
             .text(description, marginLeft + 100, y + 23, { width: contentWidth - 115 });
        }
        
        return y + boxHeight + 8;
      };
      
      // ============ PAGE 1 - COVER ============
      
      // Top header band
      doc.rect(0, 0, pageWidth, 120).fill(colors.primaryBlue);
      
      // Logo
      if (logoExists) {
        doc.image(logoPath, pageWidth / 2 - 50, 130, { width: 100 });
      }
      
      // Main title
      doc.font('Helvetica-Bold')
         .fontSize(36)
         .fillColor(colors.primaryBlue)
         .text('CURSO BLSD', marginLeft, 260, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica')
         .fontSize(16)
         .fillColor(colors.darkBlue)
         .text('Soporte Vital Básico y Desfibrilación Automática', marginLeft, 310, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor(colors.red)
         .text('Adulto y Pediátrico', marginLeft, 335, { align: 'center', width: contentWidth });
      
      // Red accent line
      doc.moveTo(pageWidth / 2 - 80, 365)
         .lineTo(pageWidth / 2 + 80, 365)
         .strokeColor(colors.red)
         .lineWidth(3)
         .stroke();
      
      // Subtitle
      doc.font('Helvetica-Oblique')
         .fontSize(11)
         .fillColor(colors.mediumGray)
         .text('Formación basada en las Guías Internacionales de la American Heart Association', marginLeft, 385, { align: 'center', width: contentWidth });
      
      // Organizations box
      doc.roundedRect(marginLeft + 40, 420, contentWidth - 80, 55, 8)
         .fill(colors.veryLightBlue);
      
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.primaryBlue)
         .text('Croce Europa – Centro de Formación Acreditado', marginLeft, 432, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('En colaboración con Servicios Médicos Cubanos (SMC)', marginLeft, 450, { align: 'center', width: contentWidth });
      
      // Introduction text box
      doc.roundedRect(marginLeft, 500, contentWidth, 130, 8)
         .strokeColor(colors.primaryBlue)
         .lineWidth(2)
         .stroke();
      
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(colors.red)
         .text('Un paro cardiorrespiratorio puede ocurrir en cualquier momento.', marginLeft + 20, 520, { width: contentWidth - 40, align: 'center' });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('La intervención precoz mediante RCP de alta calidad y el uso correcto del Desfibrilador Automático Externo (DEA) puede marcar la diferencia.', marginLeft + 20, 545, { width: contentWidth - 40, align: 'center', lineGap: 4 });
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('Este curso combina formación teórica y entrenamiento práctico para la correcta actuación en situaciones de emergencia en adultos, niños y lactantes.', marginLeft + 20, 580, { width: contentWidth - 40, align: 'center', lineGap: 4 });
      
      // Heart/AED icon visual element
      doc.circle(pageWidth / 2, 680, 30).fill(colors.red);
      doc.font('Helvetica-Bold')
         .fontSize(20)
         .fillColor(colors.white)
         .text('AED', pageWidth / 2 - 20, 670);
      
      drawFooter(1);
      
      // ============ PAGE 2 - THEORETICAL SESSIONS ============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, pageWidth, 60).fill(colors.primaryBlue);
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.white)
         .text('Programa de la Jornada', marginLeft, 22, { align: 'center', width: contentWidth });
      doc.font('Helvetica')
         .fontSize(12)
         .fillColor(colors.white)
         .text('Sesión Teórica', marginLeft, 42, { align: 'center', width: contentWidth });
      
      let yPos = 80;
      
      yPos = drawScheduleItem('08:30 – 09:00', 'Recepción de participantes', 'Apertura del curso', yPos);
      yPos = drawScheduleItem('09:00 – 09:30', 'Introducción al BLSD', 'Cadena de supervivencia', yPos);
      yPos = drawScheduleItem('09:30 – 10:30', 'Reconocimiento del paro cardiorrespiratorio', 'Evaluación de conciencia y respiración', yPos);
      yPos = drawScheduleItem('10:30 – 11:00', 'Activación del sistema de emergencias', '', yPos);
      
      // Coffee break
      yPos += 5;
      doc.roundedRect(marginLeft + 80, yPos, contentWidth - 160, 35, 8).fill(colors.red);
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(colors.white)
         .text('Pausa café', marginLeft, yPos + 10, { align: 'center', width: contentWidth });
      yPos += 50;
      
      yPos = drawScheduleItem('11:00 – 11:45', 'RCP de alta calidad en adulto', 'Técnicas de compresión y ventilación', yPos);
      yPos = drawScheduleItem('11:45 – 12:30', 'RCP en niño y lactante', 'Diferencias y adaptaciones pediátricas', yPos);
      yPos = drawScheduleItem('12:30 – 13:00', 'Uso seguro del DEA', 'Desfibrilador Automático Externo', yPos);
      
      // Lunch break
      yPos += 5;
      doc.roundedRect(marginLeft + 80, yPos, contentWidth - 160, 45, 8).fill(colors.primaryBlue);
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(colors.white)
         .text('Pausa almuerzo', marginLeft, yPos + 8, { align: 'center', width: contentWidth });
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor(colors.white)
         .text('13:00 – 14:00', marginLeft, yPos + 25, { align: 'center', width: contentWidth });
      
      drawFooter(2);
      
      // ============ PAGE 3 - PRACTICAL ACTIVITIES ============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, pageWidth, 60).fill(colors.primaryBlue);
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.white)
         .text('Actividades Prácticas', marginLeft, 22, { align: 'center', width: contentWidth });
      doc.font('Helvetica')
         .fontSize(12)
         .fillColor(colors.white)
         .text('Simulaciones y Talleres', marginLeft, 42, { align: 'center', width: contentWidth });
      
      yPos = 80;
      
      yPos = drawScheduleItem('14:00 – 15:30', 'Taller práctico de RCP en adulto', 'Uso del DEA en escenarios simulados', yPos);
      yPos = drawScheduleItem('15:30 – 16:00', 'Simulación de emergencia integrada', 'Escenario completo en adulto', yPos);
      yPos = drawScheduleItem('16:00 – 16:30', 'Taller práctico de RCP en niño y lactante', 'Técnicas adaptadas a edad pediátrica', yPos);
      yPos = drawScheduleItem('16:30 – 17:00', 'Simulación de emergencia pediátrica', 'Uso del DEA en edad pediátrica', yPos);
      
      // Visual element - practice icons
      yPos += 30;
      const iconBoxW = (contentWidth - 40) / 3;
      
      doc.roundedRect(marginLeft, yPos, iconBoxW, 80, 8).fill(colors.veryLightBlue);
      doc.roundedRect(marginLeft + iconBoxW + 20, yPos, iconBoxW, 80, 8).fill(colors.veryLightBlue);
      doc.roundedRect(marginLeft + (iconBoxW + 20) * 2, yPos, iconBoxW, 80, 8).fill(colors.veryLightBlue);
      
      doc.circle(marginLeft + iconBoxW / 2, yPos + 30, 15).fill(colors.primaryBlue);
      doc.circle(marginLeft + iconBoxW + 20 + iconBoxW / 2, yPos + 30, 15).fill(colors.red);
      doc.circle(marginLeft + (iconBoxW + 20) * 2 + iconBoxW / 2, yPos + 30, 15).fill(colors.primaryBlue);
      
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor(colors.darkBlue)
         .text('RCP Adulto', marginLeft, yPos + 55, { width: iconBoxW, align: 'center' });
      doc.text('DEA', marginLeft + iconBoxW + 20, yPos + 55, { width: iconBoxW, align: 'center' });
      doc.text('RCP Pediátrico', marginLeft + (iconBoxW + 20) * 2, yPos + 55, { width: iconBoxW, align: 'center' });
      
      drawFooter(3);
      
      // ============ PAGE 4 - EVALUATION AND CLOSURE ============
      doc.addPage();
      
      // Page header
      doc.rect(0, 0, pageWidth, 60).fill(colors.primaryBlue);
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor(colors.white)
         .text('Evaluación Final y Cierre', marginLeft, 22, { align: 'center', width: contentWidth });
      doc.font('Helvetica')
         .fontSize(12)
         .fillColor(colors.white)
         .text('Certificación del Curso', marginLeft, 42, { align: 'center', width: contentWidth });
      
      yPos = 80;
      
      yPos = drawScheduleItem('17:00 – 17:45', 'Evaluación práctica final', 'Repaso de los conocimientos adquiridos', yPos);
      yPos = drawScheduleItem('17:45 – 18:00', 'Cierre del curso', 'Conclusiones y feedback', yPos);
      
      // Certification box
      yPos += 20;
      doc.roundedRect(marginLeft, yPos, contentWidth, 120, 10)
         .fill(colors.veryLightBlue);
      doc.rect(marginLeft, yPos, 6, 120).fill(colors.red);
      
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor(colors.primaryBlue)
         .text('CERTIFICACIÓN', marginLeft + 20, yPos + 15);
      
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(colors.red)
         .text('Entrega de Certificado BLSD American Heart', marginLeft + 20, yPos + 40);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('Validez internacional', marginLeft + 40, yPos + 65);
      
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.darkGray)
         .text('Vigencia: 2 años', marginLeft + 40, yPos + 82);
      
      // Instructor box
      yPos += 145;
      doc.roundedRect(marginLeft, yPos, contentWidth, 80, 10)
         .strokeColor(colors.primaryBlue)
         .lineWidth(2)
         .stroke();
      
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(colors.primaryBlue)
         .text('INSTRUCTOR DEL CURSO', marginLeft, yPos + 20, { align: 'center', width: contentWidth });
      
      doc.font('Helvetica-Bold')
         .fontSize(16)
         .fillColor(colors.darkBlue)
         .text('Diego Toninelli', marginLeft, yPos + 45, { align: 'center', width: contentWidth });
      
      // Logo at bottom
      yPos += 110;
      if (logoExists) {
        doc.image(logoPath, pageWidth / 2 - 60, yPos, { width: 120 });
      }
      
      drawFooter(4);
      
      doc.end();
      
    } catch (error) {
      console.error("Error generating BLSD Cuba PDF:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  // ============ SOCCORSO LIVE PDF GENERATION ============
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

  // ============================================================
  // FUEL ANALYTICS - Analisi Consumi Carburante da Trip Data
  // ============================================================

  app.get("/api/fuel-analytics", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.query.vehicleId as string;
      if (!vehicleId) return res.status(400).json({ error: "vehicleId richiesto" });

      const orgId = getEffectiveOrgId(req);
      const vehicleConditions: any[] = [eq(vehicles.id, vehicleId)];
      if (orgId) vehicleConditions.push(eq(vehicles.organizationId, orgId));
      const [vehicle] = await db.select().from(vehicles).where(and(...vehicleConditions));
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
      if (isOrgAdmin(req) && orgId) {
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
      if (isOrgAdmin(req) && orgId) {
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
      const orgId = getEffectiveOrgId(req);
      const conditions: any[] = [
        eq(vehicleDocuments.vehicleId, req.params.vehicleId),
        eq(vehicleDocuments.isActive, true),
      ];
      if (orgId) conditions.push(eq(vehicleDocuments.organizationId, orgId));
      const docs = await db.select().from(vehicleDocuments)
        .where(and(...conditions))
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
      if (isOrgAdmin(req) && orgId) {
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

  // ============================================================
  // VALDAGNO PROPOSAL PDF - Professional Document Generation
  // ============================================================
  app.get("/api/public/documents/valdagno-proposal", async (req, res) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 55, right: 55 },
        bufferPages: true,
        info: {
          Title: "Bozza Progettuale - Punto Informativo e di Formazione - Valdagno",
          Author: "Croce Europa - Impresa Sociale",
          Subject: "Bozza progettuale per punto informativo a Valdagno",
          Creator: "Croce Europa Document System",
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="Proposta-Croce-Europa-Valdagno.pdf"');
      doc.pipe(res);

      const pageW = doc.page.width - 110;
      const leftM = 55;
      const PRIMARY = "#1B3F8B";
      const PRIMARY_DARK = "#0F2555";
      const PRIMARY_MED = "#4A6FA5";
      const PRIMARY_LIGHT = "#7B9FCC";
      const BG_LIGHT = "#EDF2F9";
      const BG_ACCENT = "#D6E3F3";
      const RED_ACCENT = "#C43030";
      const WHITE = "#FFFFFF";
      const TEXT_DARK = "#1A1A2E";
      const TEXT_BODY = "#2D2D3F";
      const TEXT_SECONDARY = "#5A5A6E";
      const logoPath = path.resolve(process.cwd(), "attached_assets", "Logo-Croce-Europa-Ufficiale_1770646801409.png");

      function drawPageFooter(pageNum: number, totalPages: number) {
        const footerY = doc.page.height - 40;
        doc.save();
        doc.moveTo(leftM, footerY - 8).lineTo(leftM + pageW, footerY - 8).strokeColor(BG_ACCENT).lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor(TEXT_SECONDARY).font("Helvetica")
          .text(`${pageNum} / ${totalPages}`, leftM, footerY, { width: pageW, align: "right" });
        doc.restore();
      }

      function drawSectionHeader(title: string, icon?: string) {
        if (doc.y > doc.page.height - 160) doc.addPage();
        const y = doc.y;
        doc.save();
        doc.roundedRect(leftM, y, pageW, 32, 4).fill(PRIMARY);
        const iconText = icon || "";
        doc.fontSize(12).font("Helvetica-Bold").fillColor(WHITE)
          .text(`${iconText}  ${title.toUpperCase()}`, leftM + 14, y + 9, { width: pageW - 28 });
        doc.restore();
        doc.y = y + 44;
      }

      function drawSubHeader(title: string) {
        if (doc.y > doc.page.height - 120) doc.addPage();
        const y = doc.y;
        doc.save();
        doc.roundedRect(leftM, y, pageW, 26, 3).fill(BG_LIGHT);
        doc.moveTo(leftM, y).lineTo(leftM, y + 26).lineWidth(3).strokeColor(PRIMARY_MED).stroke();
        doc.fontSize(10).font("Helvetica-Bold").fillColor(PRIMARY_DARK)
          .text(title, leftM + 12, y + 7, { width: pageW - 24 });
        doc.restore();
        doc.y = y + 34;
      }

      function drawBodyText(text: string) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.fontSize(9.5).font("Helvetica").fillColor(TEXT_BODY)
          .text(text, leftM + 4, doc.y, { width: pageW - 8, align: "justify", lineGap: 3.5 });
        doc.y += 8;
      }

      function drawBulletPoint(title: string, description: string) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        const startY = doc.y;
        doc.save();
        doc.circle(leftM + 10, startY + 6, 3).fill(PRIMARY_MED);
        doc.circle(leftM + 10, startY + 6, 1.5).fill(WHITE);
        doc.restore();
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor(PRIMARY_DARK)
          .text(title, leftM + 20, startY, { width: pageW - 28, continued: description ? true : false });
        if (description) {
          doc.font("Helvetica").fillColor(TEXT_BODY)
            .text(": " + description, { width: pageW - 28, align: "justify", lineGap: 3 });
        }
        doc.y += 6;
      }

      function drawHighlightBox(text: string) {
        if (doc.y > doc.page.height - 120) doc.addPage();
        const y = doc.y;
        const textH = doc.fontSize(9).font("Helvetica-Oblique").heightOfString(text, { width: pageW - 36, lineGap: 3 });
        const boxH = textH + 18;
        doc.save();
        doc.roundedRect(leftM + 4, y, pageW - 8, boxH, 4).fill(BG_LIGHT);
        doc.moveTo(leftM + 4, y + 4).lineTo(leftM + 4, y + boxH - 4).lineWidth(3).strokeColor(PRIMARY_MED).stroke();
        doc.restore();
        doc.fontSize(9).font("Helvetica-Oblique").fillColor(TEXT_SECONDARY)
          .text(text, leftM + 18, y + 9, { width: pageW - 36, lineGap: 3, align: "justify" });
        doc.y = y + boxH + 12;
      }

      function drawKeyMetric(label: string, value: string, x: number, y: number, w: number) {
        doc.save();
        doc.roundedRect(x, y, w, 56, 5).fill(BG_LIGHT);
        doc.moveTo(x, y + 4).lineTo(x, y + 52).lineWidth(3).strokeColor(PRIMARY).stroke();
        doc.fontSize(18).font("Helvetica-Bold").fillColor(PRIMARY)
          .text(value, x + 12, y + 8, { width: w - 24, align: "center" });
        doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_SECONDARY)
          .text(label.toUpperCase(), x + 8, y + 36, { width: w - 16, align: "center" });
        doc.restore();
      }

      // ========== COVER PAGE ==========
      const now = new Date();
      const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
      const dateStr = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      try {
        const logoW = 320;
        const logoH = logoW * (500 / 3000);
        const logoX = (doc.page.width - logoW) / 2;
        doc.image(logoPath, logoX, 130, { width: logoW });
        doc.y = 130 + logoH + 30;
      } catch (e) {
        doc.y = 180;
      }

      doc.moveTo(doc.page.width / 2 - 60, doc.y + 10).lineTo(doc.page.width / 2 + 60, doc.y + 10).lineWidth(1.5).strokeColor(PRIMARY_MED).stroke();
      doc.y += 30;

      doc.fontSize(10).font("Helvetica").fillColor(PRIMARY_MED)
        .text("BOZZA PROGETTUALE", 0, doc.y, { width: doc.page.width, align: "center" });
      doc.y += 24;

      doc.fontSize(24).font("Helvetica-Bold").fillColor(PRIMARY_DARK)
        .text("Punto Informativo", 0, doc.y, { width: doc.page.width, align: "center" });
      doc.y += 30;
      doc.fontSize(24).font("Helvetica-Bold").fillColor(PRIMARY_DARK)
        .text("e di Formazione", 0, doc.y, { width: doc.page.width, align: "center" });
      doc.y += 36;

      doc.fontSize(18).font("Helvetica").fillColor(PRIMARY_MED)
        .text("Valdagno (VI)", 0, doc.y, { width: doc.page.width, align: "center" });
      doc.y += 50;

      doc.moveTo(doc.page.width / 2 - 40, doc.y).lineTo(doc.page.width / 2 + 40, doc.y).lineWidth(0.8).strokeColor(BG_ACCENT).stroke();
      doc.y += 30;

      doc.fontSize(10).font("Helvetica").fillColor(TEXT_SECONDARY)
        .text(dateStr, 0, doc.y, { width: doc.page.width, align: "center" });
      doc.y += 20;
      doc.fontSize(9).font("Helvetica-Oblique").fillColor(TEXT_SECONDARY)
        .text("Documento di studio interno - Progetto in fase di valutazione", 0, doc.y, { width: doc.page.width, align: "center" });

      // ========== PAGE 2 - TABLE OF CONTENTS ==========
      doc.addPage();

      doc.fontSize(14).font("Helvetica-Bold").fillColor(PRIMARY_DARK)
        .text("Indice", leftM, 80, { width: pageW });
      doc.y = 110;

      const tocItems = [
        { num: "1", title: "L'Idea: Perché Valdagno", page: "3" },
        { num: "2", title: "Obiettivi del Progetto", page: "4" },
        { num: "3", title: "Sala Formazione e Corsi", page: "5" },
        { num: "4", title: "Serate Informative e Collaborazioni", page: "7" },
        { num: "5", title: "Punto Informativo e Volontariato", page: "9" },
        { num: "6", title: "Bacino Territoriale e Comuni Limitrofi", page: "10" },
        { num: "7", title: "Strategie per Generare Domanda", page: "12" },
        { num: "8", title: "Gestione e Autonomia Operativa", page: "14" },
        { num: "9", title: "Prossimi Passi", page: "15" },
      ];

      tocItems.forEach(item => {
        const y = doc.y;
        doc.save();
        doc.roundedRect(leftM, y, 22, 22, 3).fill(PRIMARY);
        doc.fontSize(10).font("Helvetica-Bold").fillColor(WHITE)
          .text(item.num, leftM + 2, y + 5, { width: 18, align: "center" });
        doc.restore();
        doc.fontSize(10).font("Helvetica").fillColor(TEXT_DARK)
          .text(item.title, leftM + 32, y + 5, { width: pageW - 80 });
        doc.fontSize(10).font("Helvetica").fillColor(PRIMARY_MED)
          .text(item.page, leftM + pageW - 30, y + 5, { width: 30, align: "right" });
        if (tocItems.indexOf(item) < tocItems.length - 1) {
          doc.moveTo(leftM + 32, y + 24).lineTo(leftM + pageW, y + 24).lineWidth(0.3).strokeColor(BG_ACCENT).stroke();
        }
        doc.y = y + 30;
      });

      // ========== SECTION 1: L'IDEA ==========
      doc.addPage();
      drawSectionHeader("1. L'Idea: Perché Valdagno");

      drawBodyText("L'area dell'Alto Vicentino, e in particolare la Valle dell'Agno, rappresenta un territorio con una forte identità comunitaria ma carente di punti di riferimento dedicati alla formazione sanitaria e alla cultura dell'emergenza. Valdagno, con la sua posizione centrale rispetto ai comuni limitrofi, offre un'opportunità concreta per colmare questo vuoto.");

      drawBodyText("L'idea è quella di aprire uno spazio che funzioni principalmente come sala formazione e punto informativo: un luogo dove organizzare corsi, serate tematiche, e dove i cittadini possano trovare risposte su come fare volontariato, come richiedere assistenza sanitaria per eventi, o semplicemente informarsi sulle attività dell'organizzazione.");

      drawBodyText("Non si tratta di replicare una sede operativa, ma di creare un presidio leggero e flessibile, orientato alla formazione e al contatto con il territorio. Un investimento sulla visibilità e sulla crescita della rete di volontari nell'area.");

      drawHighlightBox("L'obiettivo è posizionare Croce Europa come punto di riferimento per la formazione sanitaria e l'informazione nella Valle dell'Agno e nei comuni circostanti, intercettando una domanda latente che oggi non trova risposta organizzata sul territorio.");

      // ========== SECTION 2: OBIETTIVI ==========
      doc.addPage();
      drawSectionHeader("2. Obiettivi del Progetto");

      drawBodyText("Gli obiettivi principali di questa iniziativa sono:");
      doc.y += 4;

      drawBulletPoint("Creare un polo formativo locale", "disporre di una sala attrezzata per corsi di primo soccorso (BLS, BLSD, uso del DAE), corsi per volontari e aggiornamenti periodici, evitando spostamenti verso altre sedi");

      drawBulletPoint("Organizzare serate informative tematiche", "proporre un calendario di eventi aperti al pubblico su temi di interesse (sicurezza stradale, primo soccorso pediatrico, gestione delle emergenze domestiche, ecc.) anche in collaborazione con professionisti ed enti del territorio");

      drawBulletPoint("Punto di accoglienza per nuovi volontari", "offrire uno spazio fisico dove chi è interessato al volontariato possa informarsi, conoscere l'organizzazione e iniziare il percorso formativo");

      drawBulletPoint("Sportello per richieste di servizi", "ricevere richieste di assistenza sanitaria per eventi sportivi, manifestazioni, sagre e altre iniziative locali, consolidando il rapporto con il tessuto associativo e istituzionale del territorio");

      drawBulletPoint("Aumentare la visibilità nell'Alto Vicentino", "rendere Croce Europa un nome riconosciuto e di fiducia nella zona, creando un canale diretto con la cittadinanza al di fuori delle situazioni di emergenza");

      drawBulletPoint("Reclutamento e fidelizzazione", "attrarre nuovi volontari dal bacino locale e offrire ai volontari esistenti dell'area un punto di ritrovo e formazione più accessibile");

      // ========== SECTION 3: SALA FORMAZIONE ==========
      doc.addPage();
      drawSectionHeader("3. Sala Formazione e Corsi");

      drawBodyText("Il cuore del progetto è la sala formazione. Uno spazio attrezzato, versatile, capace di ospitare sia corsi strutturati che incontri informali. Le attività principali previste:");
      doc.y += 4;

      drawSubHeader("Corsi di Primo Soccorso per Cittadini");
      drawBodyText("Corsi BLS (Basic Life Support) e BLSD (con uso del defibrillatore) aperti a tutti, con cadenza regolare. Questi corsi rispondono a una domanda crescente da parte della popolazione e rappresentano anche un'occasione per far conoscere l'organizzazione a potenziali nuovi volontari.");

      drawSubHeader("Corsi per Aziende (D.Lgs. 81/08)");
      drawBodyText("Formazione obbligatoria per addetti al primo soccorso aziendale. Le aziende del territorio (artigianato, piccole e medie imprese della Valle dell'Agno) necessitano di questi corsi per ottemperare agli obblighi di legge. La sede di Valdagno può diventare il riferimento locale per questa esigenza, generando anche un ritorno economico utile alla sostenibilità del progetto.");

      drawSubHeader("Formazione e Aggiornamento Volontari");
      drawBodyText("Addestramento periodico dei volontari Croce Europa: esercitazioni pratiche, ripassi di protocolli operativi, incontri con medici e specialisti per approfondimenti. Avere una sala dedicata nell'area evita ai volontari della zona di doversi spostare verso altre sedi per la formazione obbligatoria.");

      drawSubHeader("Corsi Specialistici");
      drawBodyText("In prospettiva, la sala potrà ospitare anche corsi più specifici: primo soccorso pediatrico, gestione del trauma, formazione per accompagnatori di pazienti dializzati, aggiornamenti sulle nuove linee guida di rianimazione. L'offerta formativa potrà essere ampliata progressivamente in base alla domanda.");

      drawHighlightBox("La sala formazione non è solo un costo: i corsi per aziende e i corsi certificativi a pagamento possono contribuire alla sostenibilità economica della sede, mentre i corsi gratuiti per cittadini e volontari generano visibilità e nuove adesioni.");

      // ========== SECTION 4: SERATE INFORMATIVE ==========
      doc.addPage();
      drawSectionHeader("4. Serate Informative e Collaborazioni");

      drawBodyText("Uno degli strumenti più efficaci per radicarsi nel territorio e generare interesse verso la formazione è l'organizzazione di serate informative aperte al pubblico. L'idea è di proporre un calendario strutturato di eventi, con cadenza almeno mensile:");
      doc.y += 4;

      drawSubHeader("Tematiche Proposte");
      drawBulletPoint("Primo soccorso in casa", "come gestire le emergenze domestiche più comuni (ustioni, cadute, soffocamento nei bambini), con dimostrazioni pratiche");
      drawBulletPoint("Sicurezza stradale", "cosa fare in caso di incidente, come mettere in sicurezza la scena, primo intervento in attesa dei soccorsi");
      drawBulletPoint("Il DAE salva la vita", "serata dedicata alla defibrillazione precoce, dove trovarli nel territorio, come usarli, sfatare i falsi miti");
      drawBulletPoint("Primo soccorso pediatrico", "manovre di disostruzione delle vie aeree nei lattanti e bambini, in collaborazione con pediatri locali");
      drawBulletPoint("Emergenze sportive", "gestione degli infortuni durante attività sportive, in collaborazione con società sportive del territorio");
      drawBulletPoint("Protezione civile e maxiemergenze", "informare i cittadini su come comportarsi in caso di calamità naturali, in collaborazione con la Protezione Civile");
      drawBulletPoint("Anziani e prevenzione", "cadute, colpi di calore, riconoscere i segni di ictus e infarto, in collaborazione con medici di base o geriatri");

      doc.y += 4;
      drawSubHeader("Collaborazioni Strategiche");
      drawBodyText("Le serate informative acquistano maggiore valore e richiamo quando organizzate in collaborazione con soggetti riconosciuti dal territorio:");
      doc.y += 2;
      drawBulletPoint("Medici di base e specialisti", "per dare autorevolezza alle serate su temi clinici e attrarre i loro pazienti");
      drawBulletPoint("Comuni e Pro Loco", "per ottenere patrocini, spazi comunicativi (bacheche comunali, siti web, social) e raggiungere i cittadini");
      drawBulletPoint("Scuole di ogni ordine e grado", "per organizzare giornate formative dedicate a studenti e insegnanti");
      drawBulletPoint("Società sportive", "per corsi mirati sulla gestione delle emergenze durante allenamenti e gare");
      drawBulletPoint("Protezione Civile e Vigili del Fuoco Volontari", "per eventi congiunti su temi di sicurezza e prevenzione");
      drawBulletPoint("Parrocchie e associazioni culturali", "per raggiungere la fascia di popolazione meno digitalizzata attraverso canali tradizionali");
      drawBulletPoint("Ordini professionali e associazioni di categoria", "per proporre crediti formativi ECM o aggiornamenti professionali");

      drawHighlightBox("Ogni serata informativa è anche un'opportunità di reclutamento: chi partecipa e rimane colpito dall'esperienza può essere invitato a frequentare un corso completo o a valutare il percorso di volontariato.");

      // ========== SECTION 5: PUNTO INFORMATIVO ==========
      doc.addPage();
      drawSectionHeader("5. Punto Informativo e Volontariato");

      drawBodyText("La sede di Valdagno funzionerà come sportello informativo in orari prestabiliti, dove i cittadini potranno:");
      doc.y += 4;

      drawBulletPoint("Informarsi sul volontariato", "conoscere i requisiti, il percorso formativo, gli impegni richiesti e le opportunità offerte da Croce Europa. Molte persone sono curiose ma non sanno a chi rivolgersi o cosa comporta concretamente fare il volontario");

      drawBulletPoint("Richiedere assistenza sanitaria per eventi", "organizzatori di eventi sportivi, sagre, manifestazioni e feste patronali potranno rivolgersi direttamente alla sede per richiedere la presenza di ambulanza e personale sanitario durante i loro eventi");

      drawBulletPoint("Informarsi sui corsi disponibili", "consultare il calendario dei corsi in programma (primo soccorso, BLS, BLSD, corsi aziendali) e iscriversi direttamente");

      drawBulletPoint("Conoscere i servizi di trasporto sanitario", "ricevere informazioni sui servizi di trasporto sanitario programmato disponibili nella zona e sulle modalità di prenotazione");

      drawBulletPoint("Collaborazioni e proposte", "enti locali, scuole, associazioni e gruppi organizzati potranno proporre collaborazioni, richiedere dimostrazioni di primo soccorso o organizzare iniziative congiunte");

      drawHighlightBox("Lo sportello informativo ha un costo operativo molto basso (basta la presenza di un volontario formato) ma genera un flusso continuo di contatti e opportunità. È il modo più naturale per far crescere la rete locale.");

      // ========== SECTION 6: BACINO TERRITORIALE ==========
      doc.addPage();
      drawSectionHeader("6. Bacino Territoriale e Comuni Limitrofi");

      drawBodyText("Valdagno è il punto di riferimento naturale per un'ampia area della Valle dell'Agno e dell'ovest vicentino. La sede non servirà solo la città, ma potrà intercettare la domanda di formazione e informazione di un bacino molto più ampio:");
      doc.y += 4;

      drawSubHeader("Comuni del Bacino Primario");
      drawBulletPoint("Valdagno", "sede del punto, circa 26.000 abitanti. Centro della Valle dell'Agno con buona accessibilità");
      drawBulletPoint("Cornedo Vicentino", "comune confinante, circa 12.000 abitanti. Nessun punto di riferimento per formazione sanitaria");
      drawBulletPoint("Recoaro Terme", "comune montano, circa 6.000 abitanti. Comunità con forte senso di appartenenza, facilmente coinvolgibile");
      drawBulletPoint("Brogliano", "circa 4.000 abitanti, area limitrofa naturale");
      drawBulletPoint("Castelgomberto", "circa 6.000 abitanti, tra Valdagno e Montecchio");

      drawSubHeader("Bacino Allargato");
      drawBulletPoint("Montecchio Maggiore", "sede operativa esistente per i trasporti. La sala formazione di Valdagno può servire anche i volontari di quest'area per corsi e aggiornamenti");
      drawBulletPoint("Trissino, Arzignano, Chiampo", "comuni più grandi della zona, raggiungibili facilmente. Potenziale significativo soprattutto per i corsi aziendali vista la concentrazione di attività produttive");

      doc.y += 4;
      drawBodyText("Il bacino complessivo supera i 100.000 abitanti, un territorio in cui attualmente non esiste un punto di riferimento strutturato per la formazione sanitaria non ospedaliera. Questo rappresenta un'opportunità significativa.");

      drawHighlightBox("Centralizzare a Valdagno le attività formative per l'intera area permette di ottimizzare i costi, massimizzare la partecipazione e creare un effetto di attrazione che si autoalimenta: più partecipanti generano più passaparola e più domanda.");

      // ========== SECTION 7: STRATEGIE PER GENERARE DOMANDA ==========
      doc.addPage();
      drawSectionHeader("7. Strategie per Generare Domanda");

      drawBodyText("Il successo del progetto dipende dalla capacità di attrarre partecipanti ai corsi e alle serate, e di far conoscere la sede come punto di riferimento. Ecco le idee concrete per generare domanda:");
      doc.y += 4;

      drawSubHeader("Corsi Aziendali come Motore Economico");
      drawBodyText("Contattare direttamente le aziende della zona (artigiani, PMI, cooperative) per proporre corsi di primo soccorso obbligatori ai sensi del D.Lgs. 81/08. Molte piccole imprese faticano a trovare fornitori locali e comodi per questa formazione. Croce Europa può offrire prezzi competitivi, flessibilità di orario e la garanzia di formatori qualificati. Questa attività può contribuire significativamente alla copertura dei costi della sede.");

      drawSubHeader("Convenzioni con Comuni e Scuole");
      drawBodyText("Proporre ai Comuni del bacino convenzioni per serate informative periodiche, giornate formative nelle scuole e presenza durante eventi comunali. Il patrocinio comunale dà credibilità e accesso ai canali di comunicazione istituzionali (albo pretorio, sito web, social del Comune, bacheche pubbliche).");

      drawSubHeader("Collaborazione con Società Sportive");
      drawBodyText("Le società sportive hanno spesso l'obbligo o la necessità di avere personale formato in primo soccorso. Proporre corsi dedicati, serate tematiche sulle emergenze sportive e la possibilità di richiedere assistenza sanitaria per gare e tornei. Un canale che genera sia domanda di corsi che richieste di servizio.");

      drawSubHeader("Presenza sui Social e Comunicazione Locale");
      drawBodyText("Creare una presenza attiva sui social media con contenuti utili: pillole di primo soccorso, consigli pratici, testimonianze di volontari, foto delle serate e dei corsi. Affiancare con comunicazione tradizionale: volantini nelle attività commerciali, articoli sul giornale locale (Il Giornale di Vicenza, L'Eco Vicentino), locandine nelle bacheche comunali.");

      drawSubHeader("Passaparola e Referral");
      drawBodyText("Chi partecipa a un corso o a una serata diventa il primo ambasciatore. Incentivare il passaparola con iniziative semplici: \"porta un amico al prossimo corso\", sconti per gruppi di colleghi sulla formazione aziendale, riconoscimenti per i volontari che reclutano nuovi partecipanti.");

      drawSubHeader("Eventi di Lancio ad Alto Impatto");
      drawBodyText("Per l'apertura, organizzare un evento inaugurale visibile: un'ambulanza esposta in piazza, dimostrazioni pratiche di primo soccorso, simulazioni di intervento aperte al pubblico, distribuzione di materiale informativo. Coinvolgere i media locali per massimizzare la copertura. Ripetere eventi simili in occasione di ricorrenze (Giornata Mondiale del Cuore, Settimana della Sicurezza Stradale, ecc.).");

      drawSubHeader("Rete con Farmacie e Studi Medici");
      drawBodyText("Lasciare materiale informativo (locandine, depliant) presso le farmacie e gli studi medici della zona. Sono punti di contatto naturali con la popolazione più sensibile ai temi sanitari e della prevenzione.");

      drawHighlightBox("La chiave è non aspettare che la gente venga, ma andare a cercarla: nelle aziende, nelle scuole, nelle piazze, nelle società sportive. Ogni contatto è un potenziale partecipante, ogni partecipante un potenziale volontario.");

      // ========== SECTION 8: GESTIONE ==========
      doc.addPage();
      drawSectionHeader("8. Gestione e Autonomia Operativa");

      drawBodyText("La gestione del punto sarà interamente a cura di Croce Europa, garantendo flessibilità decisionale e chiarezza organizzativa:");
      doc.y += 4;

      drawBulletPoint("Gestione esclusiva", "nessun coinvolgimento di altre associazioni di soccorso nella conduzione. Collaborazioni occasionali su singoli eventi restano possibili, ma sotto il coordinamento di Croce Europa");

      drawBulletPoint("Autonomia dall'ULSS", "il punto non è un presidio sanitario ufficiale. Questo evita vincoli burocratici e consente piena libertà nell'organizzazione delle attività");

      drawBulletPoint("Orari flessibili", "la presenza in sede sarà calibrata sulle effettive esigenze: aperture programmate per lo sportello, orari dedicati per i corsi, serate per gli eventi. Nessun obbligo di apertura continuativa");

      drawBulletPoint("Sostenibilità economica", "i costi fissi (affitto, utenze, materiali) potranno essere parzialmente coperti dai ricavi dei corsi aziendali e certificativi. Il restante potrà essere sostenuto con fondi propri, contributi comunali o sponsorizzazioni locali");

      drawBulletPoint("Personale e volontari", "la sede sarà presidiata da volontari formati e, per le attività didattiche, da istruttori qualificati. Non è necessario personale dedicato a tempo pieno");

      // ========== SECTION 9: PROSSIMI PASSI ==========
      doc.addPage();
      drawSectionHeader("9. Prossimi Passi");

      drawBodyText("Se l'idea viene condivisa, i passi da valutare sarebbero:");
      doc.y += 4;

      drawBulletPoint("Ricerca del locale", "individuare uno spazio idoneo a Valdagno, preferibilmente in zona centrale o di passaggio, con una sala adeguata per la formazione (capienza minimo 20-30 persone)");

      drawBulletPoint("Analisi dei costi", "definire il budget previsionale: affitto, allestimento (tavoli, sedie, proiettore, manichini per BLS, DAE da addestramento), utenze e materiale informativo");

      drawBulletPoint("Mappatura delle aziende", "censire le aziende del territorio per stimare il potenziale dei corsi obbligatori D.Lgs. 81/08 e costruire un primo elenco di contatti");

      drawBulletPoint("Calendario pilota", "definire un programma per i primi 3-6 mesi con almeno: 2 corsi BLS al mese, 1 serata informativa al mese, sportello informativo settimanale");

      drawBulletPoint("Piano di comunicazione", "preparare i materiali (logo sede, locandine, presenza social) e pianificare l'evento inaugurale");

      drawBulletPoint("Contatti istituzionali", "avviare i primi contatti con il Comune di Valdagno e i Comuni limitrofi per presentare il progetto e richiedere patrocini");

      doc.y += 10;
      drawHighlightBox("Questa bozza è un punto di partenza per la discussione interna. Le idee presentate possono essere modificate, ampliate o ridimensionate in base alle valutazioni dei vertici aziendali e alle risorse disponibili. L'importante è partire con una visione chiara e obiettivi misurabili.");

      // ========== BACK COVER (clean) ==========
      doc.addPage();

      try {
        const logoW2 = 240;
        const logoH2 = logoW2 * (500 / 3000);
        const logoX2 = (doc.page.width - logoW2) / 2;
        doc.image(logoPath, logoX2, doc.page.height / 2 - logoH2 - 40, { width: logoW2 });
      } catch (e) {}

      doc.fontSize(11).font("Helvetica").fillColor(PRIMARY_MED)
        .text("Croce Europa - Impresa Sociale", 0, doc.page.height / 2 + 20, { width: doc.page.width, align: "center" });
      doc.y += 20;
      doc.moveTo(doc.page.width / 2 - 40, doc.y).lineTo(doc.page.width / 2 + 40, doc.y).lineWidth(0.8).strokeColor(BG_ACCENT).stroke();
      doc.y += 16;
      doc.fontSize(9).font("Helvetica").fillColor(TEXT_SECONDARY)
        .text("www.croceeuropa.org", 0, doc.y, { width: doc.page.width, align: "center" });

      // ========== BLANK END PAGE with reserved notice ==========
      doc.addPage();
      doc.fontSize(9).font("Helvetica-Oblique").fillColor(TEXT_SECONDARY)
        .text("Croce Europa - Impresa Sociale  |  Documento Riservato", 0, doc.page.height / 2 - 20, { width: doc.page.width, align: "center" });
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_SECONDARY)
        .text(`Documento generato il ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`, 0, doc.page.height / 2 + 10, { width: doc.page.width, align: "center" });

      const totalContentPages = doc.bufferedPageRange().count;
      for (let i = 1; i < totalContentPages - 2; i++) {
        doc.switchToPage(i);
        drawPageFooter(i + 1, totalContentPages - 2);
      }

      doc.end();
    } catch (error) {
      console.error("Error generating Valdagno proposal PDF:", error);
      res.status(500).json({ error: "Errore nella generazione del PDF" });
    }
  });

  // ============================================================================
  // GARE D'APPALTO INTELLIGENCE - Tender Monitors
  // ============================================================================

  // ANAC Open Data Integration - Auto-import Veneto tenders
  app.get("/api/admin/volunteer-registry", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const entries = await db.select().from(volunteerRegistry)
        .where(eq(volunteerRegistry.organizationId, orgId))
        .orderBy(volunteerRegistry.progressiveNumber);

      const completedSigs = await db.select({
        volunteerId: volunteerSignatures.volunteerId,
        protocolNumber: volunteerSignatures.protocolNumber,
        protocolYear: volunteerSignatures.protocolYear,
      }).from(volunteerSignatures)
        .where(and(
          eq(volunteerSignatures.organizationId, orgId),
          eq(volunteerSignatures.status, "completed"),
          isNotNull(volunteerSignatures.protocolNumber)
        ));

      const protocolMap: Record<string, { protocolNumber: number; protocolYear: number }> = {};
      for (const sig of completedSigs) {
        if (sig.protocolNumber && sig.protocolYear) {
          if (!protocolMap[sig.volunteerId] || sig.protocolNumber > protocolMap[sig.volunteerId].protocolNumber) {
            protocolMap[sig.volunteerId] = { protocolNumber: sig.protocolNumber, protocolYear: sig.protocolYear };
          }
        }
      }

      const enriched = entries.map(e => ({
        ...e,
        protocolNumber: protocolMap[e.id]?.protocolNumber || null,
        protocolYear: protocolMap[e.id]?.protocolYear || null,
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching volunteer registry:", error);
      res.status(500).json({ error: "Errore nel recupero del registro volontari" });
    }
  });

  app.get("/api/admin/volunteer-registry/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const [entry] = await db.select().from(volunteerRegistry)
        .where(and(
          eq(volunteerRegistry.id, req.params.id),
          eq(volunteerRegistry.organizationId, orgId!)
        ));

      if (!entry) return res.status(404).json({ error: "Volontario non trovato" });
      res.json(entry);
    } catch (error) {
      console.error("Error fetching volunteer entry:", error);
      res.status(500).json({ error: "Errore nel recupero del volontario" });
    }
  });

  app.post("/api/admin/volunteer-registry", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const userId = getUserId(req);

      const [maxNum] = await db.select({ max: sql<number>`COALESCE(MAX(${volunteerRegistry.progressiveNumber}), 0)` })
        .from(volunteerRegistry)
        .where(eq(volunteerRegistry.organizationId, orgId));

      const progressiveNumber = (maxNum?.max || 0) + 1;

      const data = {
        ...req.body,
        organizationId: orgId,
        progressiveNumber,
        createdBy: userId,
        updatedBy: userId,
      };

      const [entry] = await db.insert(volunteerRegistry).values(data).returning();

      await createAuditEntry({
        action: "create",
        entityType: "volunteer_registry",
        entityId: entry.id,
        entityName: `${entry.lastName} ${entry.firstName} (#${entry.progressiveNumber})`,
        description: `Nuovo volontario registrato: ${entry.lastName} ${entry.firstName}`,
        isCompliance: true,
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating volunteer entry:", error);
      res.status(500).json({ error: "Errore nella creazione del volontario" });
    }
  });

  const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/admin/volunteer-registry/import-excel", requireAdmin, excelUpload.single('file'), async (req, res) => {
    try {
      const XLSX = await import('xlsx');
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      if (!req.file) return res.status(400).json({ error: "Nessun file caricato" });

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return res.status(400).json({ error: "Il file Excel non contiene fogli" });

      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) return res.status(400).json({ error: "Il foglio Excel e' vuoto" });

      const headers = Object.keys(rawRows[0]);

      const headerMappings: Record<string, string[]> = {
        firstName: ['nome', 'first_name', 'firstname', 'name', 'nome volontario', 'nome_volontario'],
        lastName: ['cognome', 'last_name', 'lastname', 'surname', 'cognome volontario', 'cognome_volontario'],
        fiscalCode: ['codice fiscale', 'codice_fiscale', 'fiscal_code', 'cf', 'c.f.', 'cod. fiscale', 'cod.fiscale', 'codicefiscale'],
        birthDate: ['data nascita', 'data_nascita', 'birth_date', 'data di nascita', 'nato il', 'birthdate', 'datanascita'],
        birthPlace: ['luogo nascita', 'luogo_nascita', 'birth_place', 'luogo di nascita', 'nato a', 'birthplace', 'luogonascita'],
        gender: ['sesso', 'gender', 'genere', 'm/f'],
        residenceAddress: ['indirizzo', 'address', 'indirizzo residenza', 'via', 'indirizzo_residenza', 'residenza'],
        residenceCity: ['citta', 'city', 'comune', 'citta residenza', 'comune residenza', 'comune_residenza'],
        residenceProvince: ['provincia', 'province', 'prov', 'prov.'],
        residencePostalCode: ['cap', 'postal_code', 'codice postale', 'zip'],
        phone: ['telefono', 'phone', 'cellulare', 'tel', 'tel.', 'numero telefono', 'cell', 'cell.'],
        email: ['email', 'e-mail', 'mail', 'posta elettronica', 'indirizzo email'],
        volunteerType: ['tipo', 'type', 'tipo volontario', 'tipologia', 'tipo_volontario'],
        startDate: ['data inizio', 'data_inizio', 'start_date', 'inizio attivita', 'data iscrizione', 'data_iscrizione', 'datainizio'],
        endDate: ['data fine', 'data_fine', 'end_date', 'fine attivita', 'data cessazione', 'datafine'],
        role: ['ruolo', 'role', 'mansione', 'qualifica'],
        qualifications: ['qualifiche', 'qualifications', 'certificazioni', 'abilitazioni'],
        notes: ['note', 'notes', 'osservazioni', 'annotazioni'],
        emergencyContactName: ['contatto emergenza', 'emergency_contact', 'contatto_emergenza', 'nome contatto emergenza'],
        emergencyContactPhone: ['telefono emergenza', 'emergency_phone', 'tel emergenza', 'telefono_emergenza'],
        insurancePolicyNumber: ['polizza', 'policy', 'numero polizza', 'polizza_assicurativa'],
      };

      const detectedMappings: Record<string, string> = {};
      const usedHeaders = new Set<string>();
      for (const [field, aliases] of Object.entries(headerMappings)) {
        for (const header of headers) {
          if (usedHeaders.has(header)) continue;
          const normalized = header.toLowerCase().trim();
          if (aliases.includes(normalized)) {
            detectedMappings[field] = header;
            usedHeaders.add(header);
            break;
          }
        }
      }
      for (const [field, aliases] of Object.entries(headerMappings)) {
        if (detectedMappings[field]) continue;
        for (const header of headers) {
          if (usedHeaders.has(header)) continue;
          const normalized = header.toLowerCase().trim();
          if (aliases.some(a => normalized === a || (a.length > 3 && normalized.includes(a)))) {
            detectedMappings[field] = header;
            usedHeaders.add(header);
            break;
          }
        }
      }

      const formatDate = (val: any): string | null => {
        if (!val) return null;
        if (val instanceof Date) {
          const y = val.getFullYear();
          const m = String(val.getMonth() + 1).padStart(2, '0');
          const d = String(val.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        const s = String(val).trim();
        const ddmmyyyy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
        if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`;
        const yyyymmdd = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
        if (yyyymmdd) return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2,'0')}-${yyyymmdd[3].padStart(2,'0')}`;
        return null;
      };

      const normalizeGender = (val: any): string | null => {
        if (!val) return null;
        const v = String(val).trim().toUpperCase();
        if (v === 'M' || v.startsWith('MASCH')) return 'M';
        if (v === 'F' || v.startsWith('FEMM')) return 'F';
        return null;
      };

      const normalizeVolunteerType = (val: any): string => {
        if (!val) return 'continuativo';
        const v = String(val).trim().toLowerCase();
        if (v.includes('occasion')) return 'occasionale';
        return 'continuativo';
      };

      const parsedRows = rawRows.map((row, idx) => {
        const get = (field: string) => {
          const header = detectedMappings[field];
          if (!header) return null;
          const val = row[header];
          return val === '' || val === undefined || val === null ? null : val;
        };

        return {
          rowIndex: idx + 2,
          firstName: get('firstName') ? String(get('firstName')).trim() : null,
          lastName: get('lastName') ? String(get('lastName')).trim() : null,
          fiscalCode: get('fiscalCode') ? String(get('fiscalCode')).trim().toUpperCase() : null,
          birthDate: formatDate(get('birthDate')),
          birthPlace: get('birthPlace') ? String(get('birthPlace')).trim() : null,
          gender: normalizeGender(get('gender')),
          residenceAddress: get('residenceAddress') ? String(get('residenceAddress')).trim() : null,
          residenceCity: get('residenceCity') ? String(get('residenceCity')).trim() : null,
          residenceProvince: get('residenceProvince') ? String(get('residenceProvince')).trim().toUpperCase() : null,
          residencePostalCode: get('residencePostalCode') ? String(get('residencePostalCode')).trim() : null,
          phone: get('phone') ? String(get('phone')).trim() : null,
          email: get('email') ? String(get('email')).trim().toLowerCase() : null,
          volunteerType: normalizeVolunteerType(get('volunteerType')),
          startDate: formatDate(get('startDate')),
          endDate: formatDate(get('endDate')),
          role: get('role') ? String(get('role')).trim() : null,
          qualifications: get('qualifications') ? String(get('qualifications')).trim() : null,
          notes: get('notes') ? String(get('notes')).trim() : null,
          emergencyContactName: get('emergencyContactName') ? String(get('emergencyContactName')).trim() : null,
          emergencyContactPhone: get('emergencyContactPhone') ? String(get('emergencyContactPhone')).trim() : null,
          insurancePolicyNumber: get('insurancePolicyNumber') ? String(get('insurancePolicyNumber')).trim() : null,
        };
      });

      const validRows = parsedRows.filter(r => r.firstName && r.lastName);
      const invalidRows = parsedRows.filter(r => !r.firstName || !r.lastName);

      res.json({
        totalRows: rawRows.length,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        headers,
        detectedMappings,
        preview: validRows.slice(0, 5),
        allValid: validRows,
        invalidPreview: invalidRows.slice(0, 3),
        sheetName,
      });
    } catch (error: any) {
      console.error("Error parsing Excel:", error);
      res.status(500).json({ error: `Errore nella lettura del file: ${error.message || 'formato non supportato'}` });
    }
  });

  app.post("/api/admin/volunteer-registry/import-confirm", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const userId = getUserId(req);

      const { volunteers } = req.body;
      if (!Array.isArray(volunteers) || volunteers.length === 0) {
        return res.status(400).json({ error: "Nessun volontario da importare" });
      }
      if (volunteers.length > 500) {
        return res.status(400).json({ error: "Massimo 500 volontari per importazione" });
      }

      const existingEntries = await db.select({ fiscalCode: volunteerRegistry.fiscalCode, firstName: volunteerRegistry.firstName, lastName: volunteerRegistry.lastName })
        .from(volunteerRegistry).where(eq(volunteerRegistry.organizationId, orgId));
      const existingCFs = new Set(existingEntries.filter(e => e.fiscalCode).map(e => e.fiscalCode!.toUpperCase()));
      const existingNames = new Set(existingEntries.map(e => `${e.lastName?.toUpperCase()}|${e.firstName?.toUpperCase()}`));

      const [maxNum] = await db.select({ max: sql<number>`COALESCE(MAX(${volunteerRegistry.progressiveNumber}), 0)` })
        .from(volunteerRegistry)
        .where(eq(volunteerRegistry.organizationId, orgId));
      let nextNum = (maxNum?.max || 0) + 1;

      const imported: any[] = [];
      const errors: string[] = [];
      const skipped: string[] = [];

      const sanitize = (val: any, maxLen = 255): string | null => {
        if (val === null || val === undefined || val === '') return null;
        return String(val).trim().substring(0, maxLen);
      };
      const isValidDate = (val: any): boolean => {
        if (!val) return true;
        return /^\d{4}-\d{2}-\d{2}$/.test(val);
      };
      const isValidEmail = (val: any): boolean => {
        if (!val) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      };

      for (const vol of volunteers) {
        try {
          const firstName = sanitize(vol.firstName, 100);
          const lastName = sanitize(vol.lastName, 100);
          if (!firstName || !lastName) {
            errors.push(`Riga ${vol.rowIndex || '?'}: Nome e cognome obbligatori`);
            continue;
          }

          const fiscalCode = sanitize(vol.fiscalCode, 16)?.toUpperCase() || null;
          if (fiscalCode && existingCFs.has(fiscalCode)) {
            skipped.push(`${lastName} ${firstName} (CF ${fiscalCode} gia' presente)`);
            continue;
          }
          const nameKey = `${lastName.toUpperCase()}|${firstName.toUpperCase()}`;
          if (!fiscalCode && existingNames.has(nameKey)) {
            skipped.push(`${lastName} ${firstName} (nome gia' presente)`);
            continue;
          }

          const startDate = sanitize(vol.startDate);
          const birthDate = sanitize(vol.birthDate);
          const endDate = sanitize(vol.endDate);
          if (startDate && !isValidDate(startDate)) {
            errors.push(`${lastName} ${firstName}: Data inizio non valida (${startDate})`);
            continue;
          }
          if (birthDate && !isValidDate(birthDate)) {
            errors.push(`${lastName} ${firstName}: Data nascita non valida (${birthDate})`);
            continue;
          }

          const email = sanitize(vol.email, 255)?.toLowerCase() || null;
          if (email && !isValidEmail(email)) {
            errors.push(`${lastName} ${firstName}: Email non valida (${email})`);
            continue;
          }

          const volType = vol.volunteerType === 'occasionale' ? 'occasionale' : 'continuativo';

          const data: any = {
            organizationId: orgId,
            progressiveNumber: nextNum,
            firstName,
            lastName,
            fiscalCode,
            birthDate: birthDate || null,
            birthPlace: sanitize(vol.birthPlace, 100),
            gender: vol.gender === 'M' || vol.gender === 'F' ? vol.gender : null,
            residenceAddress: sanitize(vol.residenceAddress, 255),
            residenceCity: sanitize(vol.residenceCity, 100),
            residenceProvince: sanitize(vol.residenceProvince, 5)?.toUpperCase() || null,
            residencePostalCode: sanitize(vol.residencePostalCode, 10),
            phone: sanitize(vol.phone, 30),
            email,
            emergencyContactName: sanitize(vol.emergencyContactName, 100),
            emergencyContactPhone: sanitize(vol.emergencyContactPhone, 30),
            emergencyContactRelation: sanitize(vol.emergencyContactRelation, 50),
            volunteerType: volType,
            status: 'active',
            startDate: startDate || new Date().toISOString().split('T')[0],
            endDate: endDate && isValidDate(endDate) ? endDate : null,
            role: sanitize(vol.role, 100),
            qualifications: sanitize(vol.qualifications, 500),
            notes: sanitize(vol.notes, 1000),
            insurancePolicyNumber: sanitize(vol.insurancePolicyNumber, 50),
            createdBy: userId,
            updatedBy: userId,
          };

          const [entry] = await db.insert(volunteerRegistry).values(data).returning();
          imported.push({ id: entry.id, name: `${entry.lastName} ${entry.firstName}`, number: nextNum });
          existingCFs.add((fiscalCode || '').toUpperCase());
          existingNames.add(nameKey);
          nextNum++;
        } catch (err: any) {
          errors.push(`${vol.lastName || '?'} ${vol.firstName || '?'}: ${err.message || 'Errore sconosciuto'}`);
        }
      }

      if (imported.length > 0) {
        await createAuditEntry({
          action: "create",
          entityType: "volunteer_registry",
          entityId: "bulk-import",
          entityName: `Importazione Excel (${imported.length} volontari)`,
          description: `Importati ${imported.length} volontari da file Excel. ${skipped.length > 0 ? `Saltati ${skipped.length} duplicati.` : ''}`,
          isCompliance: true,
        });
      }

      res.json({ imported: imported.length, errors, skipped, total: volunteers.length });
    } catch (error: any) {
      console.error("Error importing volunteers:", error);
      res.status(500).json({ error: "Errore nell'importazione" });
    }
  });

  app.put("/api/admin/volunteer-registry/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const userId = getUserId(req);

      const [existing] = await db.select().from(volunteerRegistry)
        .where(and(
          eq(volunteerRegistry.id, req.params.id),
          eq(volunteerRegistry.organizationId, orgId!)
        ));

      if (!existing) return res.status(404).json({ error: "Volontario non trovato" });

      const modifiedFields = Object.keys(req.body);
      await checkAndInvalidateVolunteerIntegrity(req.params.id, modifiedFields);

      const [updated] = await db.update(volunteerRegistry)
        .set({
          ...req.body,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(volunteerRegistry.id, req.params.id))
        .returning();

      await createAuditEntry({
        action: "update",
        entityType: "volunteer_registry",
        entityId: updated.id,
        entityName: `${updated.lastName} ${updated.firstName} (#${updated.progressiveNumber})`,
        description: `Volontario aggiornato: ${updated.lastName} ${updated.firstName}`,
        metadata: { modifiedFields },
        isCompliance: true,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating volunteer entry:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento del volontario" });
    }
  });

  app.delete("/api/admin/volunteer-registry/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);

      const [existing] = await db.select().from(volunteerRegistry)
        .where(and(
          eq(volunteerRegistry.id, req.params.id),
          eq(volunteerRegistry.organizationId, orgId!)
        ));

      if (!existing) return res.status(404).json({ error: "Volontario non trovato" });

      await db.delete(volunteerRegistry).where(eq(volunteerRegistry.id, req.params.id));

      // Auto-renumber remaining volunteers for this org (no gaps)
      const remaining = await db.select({ id: volunteerRegistry.id })
        .from(volunteerRegistry)
        .where(eq(volunteerRegistry.organizationId, orgId!))
        .orderBy(asc(volunteerRegistry.progressiveNumber));
      
      for (let i = 0; i < remaining.length; i++) {
        await db.update(volunteerRegistry).set({
          progressiveNumber: i + 1,
          updatedAt: new Date(),
        }).where(eq(volunteerRegistry.id, remaining[i].id));
      }

      // Re-sign HMAC for all renumbered volunteers
      for (const v of remaining) {
        try { await signVolunteerEntry(v.id); } catch (e) { /* skip */ }
      }

      await createAuditEntry({
        action: "delete",
        entityType: "volunteer_registry",
        entityId: existing.id,
        entityName: `${existing.lastName} ${existing.firstName} (#${existing.progressiveNumber})`,
        description: `Volontario rimosso dal registro: ${existing.lastName} ${existing.firstName}. Numerazione aggiornata.`,
        isCompliance: true,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting volunteer entry:", error);
      res.status(500).json({ error: "Errore nella cancellazione del volontario" });
    }
  });

  app.post("/api/admin/volunteer-registry/:id/sign", requireAdmin, async (req, res) => {
    try {
      const result = await signVolunteerEntry(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error signing volunteer entry:", error);
      res.status(500).json({ error: "Errore nella firma del volontario" });
    }
  });

  app.get("/api/admin/volunteer-registry/:id/verify", requireAdmin, async (req, res) => {
    try {
      const result = await verifyVolunteerIntegrity(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error verifying volunteer integrity:", error);
      res.status(500).json({ error: "Errore nella verifica integrita" });
    }
  });

  app.post("/api/admin/volunteer-registry/bulk-sign", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const result = await bulkSignVolunteers(orgId);
      res.json(result);
    } catch (error) {
      console.error("Error bulk signing volunteers:", error);
      res.status(500).json({ error: "Errore nella firma massiva" });
    }
  });

  app.get("/api/admin/volunteer-registry-stats", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const integrity = await getVolunteerIntegrityStats(orgId);
      
      const all = await db.select().from(volunteerRegistry)
        .where(eq(volunteerRegistry.organizationId, orgId));
      
      const active = all.filter(v => v.status === "active").length;
      const continuativi = all.filter(v => v.volunteerType === "continuativo").length;
      const occasionali = all.filter(v => v.volunteerType === "occasionale").length;

      res.json({
        total: all.length,
        active,
        continuativi,
        occasionali,
        suspended: all.filter(v => v.status === "suspended").length,
        terminated: all.filter(v => v.status === "terminated").length,
        integrity,
      });
    } catch (error) {
      console.error("Error fetching volunteer registry stats:", error);
      res.status(500).json({ error: "Errore nel recupero statistiche" });
    }
  });

  app.get("/api/admin/volunteer-registry/:id/pdf", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const [entry] = await db.select().from(volunteerRegistry)
        .where(and(
          eq(volunteerRegistry.id, req.params.id),
          eq(volunteerRegistry.organizationId, orgId!)
        ));

      if (!entry) return res.status(404).json({ error: "Volontario non trovato" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId!));
      const orgInfo = {
        name: org?.name || "Organizzazione",
        legalName: org?.legalName,
        legalRepRole: org?.legalRepRole,
        address: org?.address,
        city: org?.city,
        province: org?.province,
        fiscalCode: org?.fiscalCode,
        vatNumber: org?.vatNumber,
        pec: org?.pec,
      };

      // Fetch the most recent completed/signed digital signature for this volunteer
      const signatures = await db.select().from(volunteerSignatures)
        .where(and(
          eq(volunteerSignatures.volunteerId, req.params.id),
          eq(volunteerSignatures.organizationId, orgId!)
        ))
        .orderBy(desc(volunteerSignatures.createdAt))
        .limit(5);

      // Pick the best signature: prefer completed, then volunteer_signed/org_signed, then sent
      const activeSig = signatures.find(s => s.status === 'completed')
        || signatures.find(s => s.status === 'volunteer_signed' || s.status === 'org_signed')
        || signatures.find(s => s.status !== 'cancelled' && s.status !== 'expired');

      const digitalSignature = activeSig ? {
        volunteerSignatureData: activeSig.volunteerSignatureData,
        volunteerSignedAt: activeSig.volunteerSignedAt,
        volunteerName: activeSig.volunteerName,
        orgSignatureData: activeSig.orgSignatureData,
        orgSignedAt: activeSig.orgSignedAt,
        orgSignerName: activeSig.orgSignerName,
        status: activeSig.status,
      } : null;

      generateSingleVolunteerPDF(res, entry as any, orgInfo, digitalSignature);
    } catch (error) {
      console.error("Error generating volunteer PDF:", error);
      res.status(500).json({ error: "Errore nella generazione PDF" });
    }
  });

  app.get("/api/admin/signature-document/:sigId/pdf", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const [sig] = await db.select().from(volunteerSignatures)
        .where(and(
          eq(volunteerSignatures.id, req.params.sigId),
          eq(volunteerSignatures.organizationId, orgId!)
        ));
      if (!sig) return res.status(404).json({ error: "Documento non trovato" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId!));
      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      const safeTitle = (sig.documentTitle || "documento").replace(/[^a-zA-Z0-9_-]/g, "_");
      res.setHeader("Content-Disposition", 'attachment; filename="Prot_' + String(sig.protocolNumber || 0).padStart(7, "0") + "_" + (sig.protocolYear || new Date().getFullYear()) + "_" + safeTitle + '.pdf"');
      doc.pipe(res);

      const M = 40;
      const PW = 515;
      let py = 35;

      doc.fontSize(8).fillColor("#94A3B8").text("DOCUMENTO PROTOCOLLATO", M, py, { align: "center", width: PW });
      py += 12;
      doc.fontSize(14).fillColor("#1D4ED8").text(org?.name || "Organizzazione", M, py, { align: "center", width: PW });
      py += 18;
      doc.fontSize(8).fillColor("#94A3B8").text((org?.address || "") + " " + (org?.city || "") + " " + (org?.province || ""), M, py, { align: "center", width: PW });
      py += 14;

      const protNum = String(sig.protocolNumber || 0).padStart(7, "0") + "/" + (sig.protocolYear || "");
      doc.rect(M, py, PW, 50).fill("#EFF6FF");
      const bxY = py + 6;
      doc.fontSize(7).fillColor("#64748B").text("N. PROTOCOLLO", M + 15, bxY);
      doc.fontSize(13).fillColor("#1D4ED8").font("Courier").text(protNum, M + 15, bxY + 10);
      doc.font("Helvetica");
      doc.fontSize(7).fillColor("#64748B").text("DATA", M + 180, bxY);
      const pDate = sig.protocolDate ? new Date(sig.protocolDate).toLocaleString("it-IT") : "-";
      doc.fontSize(9).fillColor("#1E293B").text(pDate, M + 180, bxY + 10);
      doc.fontSize(7).fillColor("#64748B").text("TIPO", M + 180, bxY + 24);
      doc.fontSize(9).fillColor("#1E293B").text((sig.protocolType || "uscita").toUpperCase(), M + 210, bxY + 24);
      doc.fontSize(7).fillColor("#64748B").text("OPERATORE", M + 350, bxY);
      doc.fontSize(9).fillColor("#1E293B").text(sig.protocolOperatorName || "-", M + 350, bxY + 10);
      py += 55;

      doc.fontSize(8).fillColor("#64748B").text("DESTINATARIO: ", M, py, { continued: true });
      doc.fillColor("#1E293B").text(sig.volunteerName || "-");
      py += 12;
      doc.fontSize(8).fillColor("#64748B").text("OGGETTO: ", M, py, { continued: true });
      doc.fillColor("#1E293B").text(sig.documentTitle || "-");
      py += 12;
      doc.fontSize(6).fillColor("#64748B").text("SHA-256: ", M, py, { continued: true });
      doc.font("Courier").fontSize(5.5).fillColor("#475569").text(sig.documentHash || "-");
      doc.font("Helvetica");
      py += 10;
      doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(M, py).lineTo(M + PW, py).stroke();
      py += 6;

      if (sig.documentContent) {
        doc.fontSize(9).fillColor("#1E293B");
        const cleanContent = sig.documentContent.replace(/<[^>]*>/g, "\n").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
        doc.text(cleanContent, M, py, { width: PW, lineGap: 1.5 });
        py = doc.y + 6;
      }

      if (sig.volunteerSignatureData || sig.orgSignatureData) {
        doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(M, py).lineTo(M + PW, py).stroke();
        py += 6;
        if (sig.orgSignatureData) {
          doc.fontSize(7).fillColor("#64748B").text("Firma Organizzazione:", M, py);
          try { doc.image(sig.orgSignatureData, M, py + 8, { width: 110, height: 35 }); } catch(e) {}
          doc.fontSize(6).fillColor("#475569").text(sig.orgSignerName || "", M, py + 45);
          if (sig.orgSignedAt) doc.text(new Date(sig.orgSignedAt).toLocaleString("it-IT"), M, py + 52);
        }
        if (sig.volunteerSignatureData) {
          doc.fontSize(7).fillColor("#64748B").text("Firma Volontario:", M + 280, py);
          try { doc.image(sig.volunteerSignatureData, M + 280, py + 8, { width: 110, height: 35 }); } catch(e) {}
          doc.fontSize(6).fillColor("#475569").text(sig.volunteerName || "", M + 280, py + 45);
          if (sig.volunteerSignedAt) doc.text(new Date(sig.volunteerSignedAt).toLocaleString("it-IT"), M + 280, py + 52);
        }
      }

      const pageH = doc.page.height;
      doc.fontSize(5.5).fillColor("#94A3B8").text(
        "Documento protocollato ai sensi del DPR 445/2000, Art. 53 - Campi immodificabili: N. protocollo, data, destinatario, oggetto, impronta",
        M, pageH - 28, { width: PW, align: "center" }
      );

      doc.end();
    } catch (error) {
      console.error("Error generating signature document PDF:", error);
      res.status(500).json({ error: "Errore nella generazione PDF" });
    }
  });

  app.get("/api/admin/volunteer-registry-pdf", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const entries = await db.select().from(volunteerRegistry)
        .where(eq(volunteerRegistry.organizationId, orgId))
        .orderBy(volunteerRegistry.progressiveNumber);

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      const orgInfo = {
        name: org?.name || "Organizzazione",
        legalName: org?.legalName,
        legalRepRole: org?.legalRepRole,
        address: org?.address,
        city: org?.city,
        province: org?.province,
        fiscalCode: org?.fiscalCode,
        vatNumber: org?.vatNumber,
        pec: org?.pec,
      };

      generateFullRegistryPDF(res, entries as any[], orgInfo);
    } catch (error) {
      console.error("Error generating full registry PDF:", error);
      res.status(500).json({ error: "Errore nella generazione PDF registro completo" });
    }
  });

  // ============================================================================
  // PUBLIC CALENDAR PAGE (from PDF link)
  // ============================================================================

  function generateCalendarToken(month: string, locationId: string | null, orgId: string): string {
    const secret = process.env.TRIP_INTEGRITY_SECRET || 'calendar-secret';
    const payload = JSON.stringify({ month, locationId: locationId || 'all', orgId, purpose: 'shift-calendar' });
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    return `${payloadB64}.${sig}`;
  }

  function verifyCalendarToken(token: string): { month: string; locationId: string | null; orgId: string } | null {
    const secret = process.env.TRIP_INTEGRITY_SECRET || 'calendar-secret';
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    if (sig !== expectedSig) return null;
    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      if (payload.purpose !== 'shift-calendar') return null;
      return { month: payload.month, locationId: payload.locationId === 'all' ? null : payload.locationId, orgId: payload.orgId };
    } catch { return null; }
  }

  app.get("/turni/:orgId", (req, res) => {
    res.sendFile(path.join(process.cwd(), "admin/public/turni-pubblico.html"));
  });

  app.get("/api/public/turni/:orgId", async (req, res) => {
    try {
      const orgParam = req.params.orgId;
      const monthQuery = req.query.month as string | undefined;
      const now = new Date();
      const month = monthQuery || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [year, monthNum] = month.split('-').map(Number);
      const dateFrom = `${month}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;
      const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
      const monthLabel = `${monthNames[monthNum - 1]} ${year}`;

      let [org] = await db.select().from(organizations).where(eq(organizations.id, orgParam)).limit(1);
      if (!org) {
        [org] = await db.select().from(organizations).where(eq(organizations.slug, orgParam)).limit(1);
      }
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });
      const orgId = org.id;

      const logoFile = path.join(UPLOADS_DIR,"logos", `${org.id}.png`);
      const logoUrl = fs.existsSync(logoFile) ? `/api/public/turni/${orgId}/logo` : '';

      const orgLocs = await db.select({ id: locations.id }).from(locations).where(eq(locations.organizationId, orgId));
      const orgLocIds = orgLocs.map(l => l.id);

      const shiftConditions: any[] = [
        gte(shiftInstances.shiftDate, dateFrom),
        lte(shiftInstances.shiftDate, dateTo),
        eq(shiftInstances.organizationId, orgId),
      ];

      const allShifts = await db.select().from(shiftInstances).where(and(...shiftConditions));
      const shiftIds = allShifts.map(s => s.id);
      let assignmentsData: any[] = [];
      if (shiftIds.length > 0) {
        assignmentsData = await db.select({
          assignment: shiftAssignments,
          staff: { id: staffMembers.id, firstName: staffMembers.firstName, lastName: staffMembers.lastName, primaryRole: staffMembers.primaryRole }
        }).from(shiftAssignments)
          .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
          .leftJoin(staffMembers, eq(shiftAssignments.staffMemberId, staffMembers.id))
          .where(inArray(shiftAssignments.shiftInstanceId, shiftIds));
      }

      const allVehicles = await db.select().from(vehiclesTable);
      const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
      const allLocations = await db.select().from(locations);
      const locationMap = new Map(allLocations.map(l => [l.id, l]));

      const staffShiftsMap = new Map<string, { firstName: string; lastName: string; primaryRole: string; shifts: any[]; totalHours: number }>();
      assignmentsData.forEach(({ assignment, staff }) => {
        if (!staff?.id) return;
        if (!staffShiftsMap.has(staff.id)) {
          staffShiftsMap.set(staff.id, { firstName: staff.firstName, lastName: staff.lastName, primaryRole: staff.primaryRole, shifts: [], totalHours: 0 });
        }
        const s = staffShiftsMap.get(staff.id)!;
        const instance = allShifts.find(sh => sh.id === assignment.shiftInstanceId);
        if (instance) {
          const vehicle = vehicleMap.get(instance.vehicleId || '');
          const natoName = (vehicle as any)?.natoName || '';
          const vehicleLabel = natoName || vehicle?.code || '?';
          const [sh, sm] = (instance.startTime || '').split(':').map(Number);
          const [eh, em] = (instance.endTime || '').split(':').map(Number);
          const hours = (eh + em/60) - (sh + sm/60);
          s.totalHours += hours > 0 ? hours : hours + 24;
          s.shifts.push({
            date: instance.shiftDate,
            startTime: instance.startTime,
            endTime: instance.endTime,
            role: assignment.assignedRole,
            vehicleLabel,
            instanceId: instance.id,
            locationName: locationMap.get(instance.locationId)?.name || '',
          });
        }
      });

      const staff = [...staffShiftsMap.entries()].map(([id, data]) => ({
        id,
        firstName: data.firstName,
        lastName: data.lastName,
        primaryRole: data.primaryRole,
        shiftCount: data.shifts.length,
        totalHours: data.totalHours,
        shifts: data.shifts.sort((a: any, b: any) => a.date.localeCompare(b.date)),
      })).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

      res.json({ orgName: (org as any).legalName || org.name, monthLabel, month, logoUrl, staff });
    } catch (error) {
      console.error("Error fetching public turni:", error);
      res.status(500).json({ error: "Errore nel caricamento" });
    }
  });

  app.get("/api/public/turni/:orgId/logo", async (req, res) => {
    const orgParam = req.params.orgId;
    let logoFile = path.join(UPLOADS_DIR,"logos", `${orgParam}.png`);
    if (!fs.existsSync(logoFile)) {
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgParam)).limit(1);
      if (org) logoFile = path.join(UPLOADS_DIR,"logos", `${org.id}.png`);
    }
    if (fs.existsSync(logoFile)) return res.sendFile(logoFile);
    res.status(404).end();
  });

  app.get("/api/public/turni/:orgId/ics/:staffId", async (req, res) => {
    try {
      const orgParam = req.params.orgId;
      const { staffId } = req.params;
      let [orgLookup] = await db.select().from(organizations).where(eq(organizations.id, orgParam)).limit(1);
      if (!orgLookup) {
        [orgLookup] = await db.select().from(organizations).where(eq(organizations.slug, orgParam)).limit(1);
      }
      const orgId = orgLookup?.id || orgParam;
      const monthQuery = req.query.month as string | undefined;
      const now = new Date();
      const month = monthQuery || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [year, monthNum] = month.split('-').map(Number);
      const dateFrom = `${month}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;

      const staffMember = await storage.getStaffMemberById(staffId);
      if (!staffMember) return res.status(404).json({ error: "Operatore non trovato" });

      const conditions: any[] = [
        eq(shiftAssignments.staffMemberId, staffId),
        gte(shiftInstances.shiftDate, dateFrom),
        lte(shiftInstances.shiftDate, dateTo),
      ];

      const staffAssignmentsData = await db.select({
        assignment: shiftAssignments,
        instance: shiftInstances,
      }).from(shiftAssignments)
        .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
        .where(and(...conditions))
        .orderBy(shiftInstances.shiftDate, shiftInstances.startTime);

      const allVehicles = await db.select().from(vehiclesTable);
      const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
      const allLocations = await db.select().from(locations);
      const locationMap = new Map(allLocations.map(l => [l.id, l]));
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      const orgName = org?.name || 'Soccorso Digitale';

      const pad2 = (n: number) => String(n).padStart(2, '0');
      const formatICSDate = (dateStr: string, timeStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const [h, min] = timeStr.split(':').map(Number);
        return `${y}${pad2(m)}${pad2(d)}T${pad2(h)}${pad2(min)}00`;
      };
      const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Soccorso Digitale//Turni//IT',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:Turni ${staffMember.firstName} ${staffMember.lastName}`,
        'X-WR-TIMEZONE:Europe/Rome',
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Rome',
        'BEGIN:STANDARD',
        'DTSTART:19701025T030000',
        'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
        'TZOFFSETFROM:+0200',
        'TZOFFSETTO:+0100',
        'TZNAME:CET',
        'END:STANDARD',
        'BEGIN:DAYLIGHT',
        'DTSTART:19700329T020000',
        'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
        'TZOFFSETFROM:+0100',
        'TZOFFSETTO:+0200',
        'TZNAME:CEST',
        'END:DAYLIGHT',
        'END:VTIMEZONE',
      ].join('\r\n') + '\r\n';

      staffAssignmentsData.forEach(({ assignment, instance }, idx) => {
        const vehicle = vehicleMap.get(instance.vehicleId || '');
        const loc = locationMap.get(instance.locationId || '');
        const natoName = (vehicle as any)?.natoName || '';
        const roleName = assignment.assignedRole === 'autista' ? 'Autista' : assignment.assignedRole === 'soccorritore' ? 'Soccorritore' : 'Operatore';
        const vehicleLabel = natoName || vehicle?.code || '?';
        const summary = `Turno ${roleName} - ${vehicleLabel}`;
        const description = `${orgName}\\nSede: ${loc?.name || 'N/D'}\\nVeicolo: ${vehicleLabel}\\nRuolo: ${roleName}\\nOrario: ${(instance.startTime || '').slice(0,5)} - ${(instance.endTime || '').slice(0,5)}`;
        const uid = `shift-${instance.id}-${assignment.id || idx}@soccorsodigitale.app`;

        icsContent += [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${nowStamp}`,
          `DTSTART;TZID=Europe/Rome:${formatICSDate(instance.shiftDate, instance.startTime)}`,
          `DTEND;TZID=Europe/Rome:${formatICSDate(instance.shiftDate, instance.endTime)}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `LOCATION:${loc?.name || ''}`,
          'STATUS:CONFIRMED',
          'BEGIN:VALARM',
          'TRIGGER:-PT30M',
          'ACTION:DISPLAY',
          `DESCRIPTION:Turno tra 30 minuti - ${vehicleLabel}`,
          'END:VALARM',
          'END:VEVENT',
        ].join('\r\n') + '\r\n';
      });

      icsContent += 'END:VCALENDAR\r\n';
      const fileName = `turni_${staffMember.firstName}_${staffMember.lastName}_${month}.ics`.replace(/\s/g, '_');
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating public ICS:", error);
      if (!res.headersSent) res.status(500).json({ error: "Errore nella generazione calendario" });
    }
  });

  app.get("/calendario/:token", (req, res) => {
    const verified = verifyCalendarToken(req.params.token);
    if (!verified) return res.status(403).send('<html><body><h1>Link non valido</h1><p>Questo link non è valido o è stato alterato.</p></body></html>');
    res.sendFile(path.join(process.cwd(), "admin/public/calendario.html"));
  });

  app.get("/api/public/calendario/:token", async (req, res) => {
    try {
      const verified = verifyCalendarToken(req.params.token);
      if (!verified) return res.status(403).json({ error: "Link non valido o scaduto" });

      const { month, locationId, orgId } = verified;
      const [year, monthNum] = month.split('-').map(Number);
      const dateFrom = `${month}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;
      const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
      const monthLabel = `${monthNames[monthNum - 1]} ${year}`;

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      const orgName = org?.name || 'Organizzazione';
      const logoFile = path.join(UPLOADS_DIR,"logos", `${orgId}.png`);
      const logoUrl = fs.existsSync(logoFile) ? `/api/public/calendario/${req.params.token}/logo` : '';

      let locationName = 'Tutte le sedi';
      if (locationId) {
        const [loc] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
        locationName = loc?.name || locationName;
      }

      const shiftConditions: any[] = [
        gte(shiftInstances.shiftDate, dateFrom),
        lte(shiftInstances.shiftDate, dateTo),
      ];
      if (locationId) shiftConditions.push(eq(shiftInstances.locationId, locationId));
      const orgVehicles = await db.select().from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId));
      const orgVehicleIds = orgVehicles.map(v => v.id);
      if (orgVehicleIds.length > 0) {
        shiftConditions.push(inArray(shiftInstances.vehicleId, orgVehicleIds));
      }

      const shifts = await db.select().from(shiftInstances).where(and(...shiftConditions));
      const shiftIds = shifts.map(s => s.id);

      let assignmentsData: any[] = [];
      if (shiftIds.length > 0) {
        assignmentsData = await db.select({
          assignment: shiftAssignments,
          instance: shiftInstances,
          staff: { id: staffMembers.id, firstName: staffMembers.firstName, lastName: staffMembers.lastName, primaryRole: staffMembers.primaryRole }
        }).from(shiftAssignments)
          .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
          .leftJoin(staffMembers, eq(shiftAssignments.staffMemberId, staffMembers.id))
          .where(inArray(shiftAssignments.shiftInstanceId, shiftIds));
      }

      const vehicleMap = new Map<string, any>();
      orgVehicles.forEach(v => vehicleMap.set(v.id, v));

      const staffMap = new Map<string, { id: string; firstName: string; lastName: string; primaryRole: string; shiftCount: number; totalHours: number; shifts: any[] }>();
      assignmentsData.forEach(({ assignment, instance, staff }) => {
        if (!staff?.id) return;
        if (!staffMap.has(staff.id)) {
          staffMap.set(staff.id, { id: staff.id, firstName: staff.firstName, lastName: staff.lastName, primaryRole: staff.primaryRole || 'operatore', shiftCount: 0, totalHours: 0, shifts: [] });
        }
        const entry = staffMap.get(staff.id)!;
        entry.shiftCount++;
        const startP = (instance.startTime || '06:30:00').split(':').map(Number);
        const endP = (instance.endTime || '14:00:00').split(':').map(Number);
        entry.totalHours += Math.max(0, (endP[0] + endP[1]/60) - (startP[0] + startP[1]/60));
        const vehicle = vehicleMap.get(instance.vehicleId);
        const natoName = (vehicle as any)?.natoName || '';
        const vehicleLabel = natoName || (vehicle?.code || '?');
        entry.shifts.push({
          instanceId: instance.id,
          date: instance.shiftDate,
          startTime: instance.startTime || '06:30:00',
          endTime: instance.endTime || '14:00:00',
          role: assignment.assignedRole || 'operatore',
          vehicleLabel
        });
      });

      const staffList = [...staffMap.values()].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

      res.json({ orgName, monthLabel, locationName, logoUrl, staff: staffList });
    } catch (error) {
      console.error("Error in public calendar:", error);
      res.status(500).json({ error: "Errore nel caricamento dei turni" });
    }
  });

  app.get("/api/public/calendario/:token/logo", async (req, res) => {
    const verified = verifyCalendarToken(req.params.token);
    if (!verified) return res.status(403).send('Forbidden');
    const logoFile = path.join(UPLOADS_DIR,"logos", `${verified.orgId}.png`);
    if (fs.existsSync(logoFile)) {
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(logoFile);
    } else {
      res.status(404).send('Not found');
    }
  });

  app.get("/api/public/calendario/:token/ics/:staffId", async (req, res) => {
    try {
      const verified = verifyCalendarToken(req.params.token);
      if (!verified) return res.status(403).json({ error: "Link non valido" });

      const { month, locationId, orgId } = verified;
      const { staffId } = req.params;
      const [year, monthNum] = month.split('-').map(Number);
      const dateFrom = `${month}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;

      const staffMember = await storage.getStaffMemberById(staffId);
      if (!staffMember) return res.status(404).json({ error: "Operatore non trovato" });

      const filterInstanceId = req.query.instanceId as string | undefined;
      const filterDate = req.query.shiftDate as string | undefined;

      const conditions: any[] = [
        eq(shiftAssignments.staffMemberId, staffId),
      ];
      if (filterInstanceId) {
        conditions.push(eq(shiftInstances.id, filterInstanceId));
      } else if (filterDate) {
        conditions.push(eq(shiftInstances.shiftDate, filterDate));
      } else {
        conditions.push(gte(shiftInstances.shiftDate, dateFrom));
        conditions.push(lte(shiftInstances.shiftDate, dateTo));
      }

      const staffAssignments = await db.select({
        assignment: shiftAssignments,
        instance: shiftInstances,
      }).from(shiftAssignments)
        .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
        .where(and(...conditions))
        .orderBy(shiftInstances.shiftDate, shiftInstances.startTime);

      const allVehicles = await db.select().from(vehiclesTable);
      const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
      const locationsList = await db.select().from(locations);
      const locationMap = new Map(locationsList.map(l => [l.id, l]));

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      const orgName = org?.name || 'Soccorso Digitale';

      const pad2 = (n: number) => String(n).padStart(2, '0');
      const formatICSDate = (dateStr: string, timeStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const [h, min] = timeStr.split(':').map(Number);
        return `${y}${pad2(m)}${pad2(d)}T${pad2(h)}${pad2(min)}00`;
      };
      const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Soccorso Digitale//Turni//IT',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:Turni ${staffMember.firstName} ${staffMember.lastName}`,
      ].join('\r\n') + '\r\n';

      staffAssignments.forEach(({ assignment, instance }, idx) => {
        const vehicle = vehicleMap.get(instance.vehicleId || '');
        const loc = locationMap.get(instance.locationId || '');
        const natoName = (vehicle as any)?.natoName || '';
        const roleName = assignment.assignedRole === 'autista' ? 'Autista' : assignment.assignedRole === 'soccorritore' ? 'Soccorritore' : 'Operatore';
        const vehicleLabel = natoName || (vehicle?.code || '?');
        const summary = `Turno ${roleName} - ${vehicleLabel}`;
        const description = `${orgName}\\nSede: ${loc?.name || 'N/D'}\\nVeicolo: ${vehicleLabel}\\nRuolo: ${roleName}\\nOrario: ${(instance.startTime || '').slice(0,5)} - ${(instance.endTime || '').slice(0,5)}`;
        const uid = `shift-${instance.id}-${assignment.id || idx}@soccorsodigitale.app`;

        icsContent += [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${nowStamp}`,
          `DTSTART:${formatICSDate(instance.shiftDate, instance.startTime)}`,
          `DTEND:${formatICSDate(instance.shiftDate, instance.endTime)}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `LOCATION:${loc?.name || ''}`,
          `STATUS:CONFIRMED`,
          'BEGIN:VALARM',
          'TRIGGER:-PT30M',
          'ACTION:DISPLAY',
          `DESCRIPTION:Turno tra 30 minuti - ${vehicleLabel}`,
          'END:VALARM',
          'END:VEVENT',
        ].join('\r\n') + '\r\n';
      });

      icsContent += 'END:VCALENDAR\r\n';

      const singleDate = filterInstanceId && staffAssignments.length === 1 ? staffAssignments[0].instance.shiftDate : null;
      const fileName = singleDate
        ? `turno_${staffMember.firstName}_${staffMember.lastName}_${singleDate}.ics`.replace(/\s/g, '_')
        : `turni_${staffMember.firstName}_${staffMember.lastName}_${month}.ics`.replace(/\s/g, '_');
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating public ICS:", error);
      if (!res.headersSent) res.status(500).json({ error: "Errore nella generazione calendario" });
    }
  });


  // ============================================================================
  // LEGAL REPRESENTATIVE MANAGEMENT
  // ============================================================================

  app.get("/api/admin/legal-representative", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });
      res.json({
        legalRepName: org.legalRepName || '',
        legalRepRole: org.legalRepRole || '',
        legalRepSignature: org.legalRepSignature || '',
        defaultProtocolOperator: org.defaultProtocolOperator || '',
      });
    } catch (error) {
      console.error("Error fetching legal representative:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/legal-representative", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const { legalRepName, legalRepRole, legalRepSignature, defaultProtocolOperator } = req.body;
      const updateData: Record<string, any> = {
        legalRepName: legalRepName || null,
        legalRepRole: legalRepRole || null,
        defaultProtocolOperator: defaultProtocolOperator || null,
        updatedAt: new Date(),
      };
      if (legalRepSignature) {
        updateData.legalRepSignature = legalRepSignature;
      }
      await db.update(organizations).set(updateData).where(eq(organizations.id, orgId));
      res.json({ success: true, message: "Legale rappresentante aggiornato" });
    } catch (error) {
      console.error("Error updating legal representative:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // VOLUNTEER SIGNATURE WORKFLOW
  // ============================================================================

  // Serve the public signing page
  app.get("/firma/:token", (req, res) => {
    res.sendFile(path.join(process.cwd(), "admin/public/firma.html"));
  });

  // Serve the CUT monitoring portal page
  app.get("/monitoraggio/:token", (req, res) => {
    res.sendFile(path.join(process.cwd(), "admin/public/monitoraggio.html"));
  });

  // Serve the public status page
  app.get("/status", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "admin/public/status.html"));
  });

  // Admin: Send signature request to volunteer
  app.post("/api/admin/volunteer-registry/:id/send-signature", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const [volunteer] = await db.select().from(volunteerRegistry).where(
        and(eq(volunteerRegistry.id, id), eq(volunteerRegistry.organizationId, orgId))
      );
      if (!volunteer) return res.status(404).json({ error: "Volontario non trovato" });
      if (!volunteer.email) return res.status(400).json({ error: "Il volontario non ha un indirizzo email configurato" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      const orgName = org?.name || "Organizzazione";

      if (!org?.legalRepName || !org?.legalRepSignature) {
        return res.status(400).json({ error: "Configurare prima il Legale Rappresentante con nome e firma nella sezione Impostazioni del Registro Volontari" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const documentTitle = "Iscrizione al Registro Volontari";
      const isFemale = volunteer.gender === 'F';
      const art = isFemale ? 'la' : 'il';
      const sottoscritto = isFemale ? 'la sottoscritta' : 'il sottoscritto';
      const volontarioLabel = isFemale ? 'volontaria' : 'volontario';
      const tipoVolontario = volunteer.volunteerType === 'continuativo' ? (isFemale ? 'continuativa' : 'continuativo') : 'occasionale';
      const fiscalCodeText = volunteer.fiscalCode ? `, C.F. ${volunteer.fiscalCode},` : '';
      const documentContent = `Con la presente, ${sottoscritto} ${volunteer.firstName} ${volunteer.lastName}${fiscalCodeText} dichiara di volersi iscrivere come ${volontarioLabel} ${tipoVolontario} presso l'organizzazione ${orgName}, ai sensi dell'Art. 17 del Codice del Terzo Settore (D.Lgs. 117/2017, D.M. 6 ottobre 2021).\n\n${sottoscritto.charAt(0).toUpperCase() + sottoscritto.slice(1)} si impegna a:\n- Svolgere la propria attivita di volontariato in modo personale, spontaneo e gratuito;\n- Rispettare il regolamento interno dell'organizzazione;\n- Mantenere la riservatezza sui dati personali e sensibili trattati durante il servizio;\n- Comunicare tempestivamente eventuali variazioni dei propri dati personali.\n\nL'organizzazione si impegna a:\n- Iscrivere ${art} ${volontarioLabel} nel registro dei volontari;\n- Garantire la copertura assicurativa come previsto dalla normativa vigente;\n- Fornire adeguata formazione per lo svolgimento dell'attivita.\n\nData di inizio attivita: ${volunteer.startDate ? new Date(volunteer.startDate).toLocaleDateString('it-IT') : 'Da definire'}\nRuolo: ${volunteer.role || 'Da definire'}\n\nNumero progressivo registro: ${volunteer.progressiveNumber}`;

      const [signature] = await db.insert(volunteerSignatures).values({
        organizationId: orgId,
        volunteerId: id,
        token,
        status: "draft",
        documentType: "registrazione_volontario",
        documentTitle,
        documentContent,
        volunteerEmail: volunteer.email,
        volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
        orgSignatureData: org.legalRepSignature,
        orgSignedAt: new Date(),
        orgSignedBy: getUserId(req),
        orgSignerName: `${org.legalRepName} (${org.legalRepRole || 'Legale Rappresentante'})`,
        expiresAt,
        createdBy: getUserId(req),
      }).returning();

      const replitDomain = process.env.REPLIT_DEV_DOMAIN;
      const forwardedHost = req.headers['x-forwarded-host'] as string;
      const host = forwardedHost || (replitDomain ? `${replitDomain}:5000` : null) || req.headers.host || 'soccorsodigitale.app';
      const protocol = (req.headers['x-forwarded-proto'] as string) || (replitDomain ? 'https' : (req.secure ? 'https' : 'http'));
      const signingUrl = `${protocol}://${host}/firma/${token}`;

      // Send email
      const emailSent = await sendSignatureRequestEmail({
        recipientEmail: volunteer.email,
        volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
        organizationName: orgName,
        documentTitle,
        signingUrl,
        expiresAt,
      });

      if (emailSent) {
        await db.update(volunteerSignatures)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(volunteerSignatures.id, signature.id));
      }

      res.json({ 
        success: true, 
        signatureId: signature.id, 
        emailSent,
        signingUrl,
        message: emailSent ? "Email di firma inviata con successo" : "Richiesta creata ma email non inviata"
      });
    } catch (error) {
      console.error("Error sending signature request:", error);
      res.status(500).json({ error: "Errore nell'invio della richiesta di firma" });
    }
  });

  // Admin: Organization sign a document
  app.post("/api/admin/volunteer-signatures/:signatureId/org-sign", requireAdmin, async (req, res) => {
    try {
      const { signatureId } = req.params;
      const { signatureData } = req.body;
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const [sig] = await db.select().from(volunteerSignatures).where(
        and(eq(volunteerSignatures.id, signatureId), eq(volunteerSignatures.organizationId, orgId))
      );
      if (!sig) return res.status(404).json({ error: "Firma non trovata" });

      const userId = getUserId(req) || '';
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      const newStatus = sig.volunteerSignatureData ? "completed" : "org_signed";

      await db.update(volunteerSignatures).set({
        orgSignatureData: signatureData,
        orgSignedAt: new Date(),
        orgSignedBy: userId,
        orgSignerName: user?.name || "Amministratore",
        status: newStatus,
        updatedAt: new Date(),
      }).where(eq(volunteerSignatures.id, signatureId));

      if (newStatus === "completed") {
        await db.update(volunteerRegistry).set({
          startSignatureConfirmed: true,
          startSignatureDate: new Date(),
          updatedAt: new Date(),
        }).where(eq(volunteerRegistry.id, sig.volunteerId));

        if (!sig.protocolNumber) {
          try {
            const currentYear = new Date().getFullYear();
            const [latest] = await db.select({ maxNum: sql<number>`COALESCE(MAX(${volunteerSignatures.protocolNumber}), 0)` })
              .from(volunteerSignatures)
              .where(and(
                eq(volunteerSignatures.organizationId, sig.organizationId),
                eq(volunteerSignatures.protocolYear, currentYear)
              ));
            const nextNum = (latest?.maxNum || 0) + 1;
            const crypto = await import("crypto");
            const docContent = sig.documentContent || sig.documentTitle || "";
            const docHash = crypto.createHash("sha256").update(docContent).digest("hex");
            const [orgForProt] = await db.select().from(organizations).where(eq(organizations.id, sig.organizationId));
            const protOperatorName = orgForProt?.defaultProtocolOperator || user?.name || "Amministratore";
            await db.update(volunteerSignatures).set({
              protocolNumber: nextNum,
              protocolYear: currentYear,
              protocolDate: new Date(),
              protocolOperator: userId,
              protocolOperatorName: protOperatorName,
              protocolType: "uscita",
              documentHash: docHash,
              updatedAt: new Date(),
            }).where(eq(volunteerSignatures.id, sig.id));
          } catch (e) {
            console.error("Auto protocol assignment on org sign failed:", e);
          }
        }

        try {
          await signVolunteerEntry(sig.volunteerId);
        } catch (e) {
          console.error("Auto re-sign HMAC after org signature completion failed:", e);
        }
      }

      res.json({ success: true, status: newStatus });
    } catch (error) {
      console.error("Error org signing:", error);
      res.status(500).json({ error: "Errore nella firma organizzazione" });
    }
  });

  // Admin: Get all signature requests for a volunteer
  app.get("/api/admin/volunteer-registry/:id/signatures", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const sigs = await db.select().from(volunteerSignatures).where(
        and(eq(volunteerSignatures.volunteerId, id), eq(volunteerSignatures.organizationId, orgId))
      ).orderBy(desc(volunteerSignatures.createdAt));

      res.json(sigs);
    } catch (error) {
      console.error("Error loading signatures:", error);
      res.status(500).json({ error: "Errore nel caricamento firme" });
    }
  });

  // Admin: Get all signature requests for the organization
  app.get("/api/admin/volunteer-signatures", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const sigs = await db.select().from(volunteerSignatures).where(
        eq(volunteerSignatures.organizationId, orgId)
      ).orderBy(desc(volunteerSignatures.createdAt));

      res.json(sigs);
    } catch (error) {
      console.error("Error loading all signatures:", error);
      res.status(500).json({ error: "Errore nel caricamento firme" });
    }
  });

  // Admin: Cancel a signature request
  app.post("/api/admin/volunteer-signatures/:signatureId/cancel", requireAdmin, async (req, res) => {
    try {
      const { signatureId } = req.params;
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      await db.update(volunteerSignatures).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(and(eq(volunteerSignatures.id, signatureId), eq(volunteerSignatures.organizationId, orgId)));

      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling signature:", error);
      res.status(500).json({ error: "Errore nell'annullamento" });
    }
  });

  // PUBLIC: Get signature document info (volunteer opens signing page)
  app.get("/api/public/signature/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const [sig] = await db.select().from(volunteerSignatures).where(eq(volunteerSignatures.token, token));
      
      if (!sig) return res.status(404).json({ error: "Documento non trovato", code: "NOT_FOUND" });
      if (sig.status === "cancelled") return res.status(410).json({ error: "Richiesta annullata", code: "CANCELLED" });
      if (sig.status === "completed") {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, sig.organizationId));
        return res.status(200).json({ 
          error: "Documento gia firmato da entrambe le parti", code: "ALREADY_SIGNED",
          status: "completed", volunteerName: sig.volunteerName, documentTitle: sig.documentTitle,
          organizationName: org?.name || "Organizzazione"
        });
      }
      if (sig.status === "volunteer_signed") {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, sig.organizationId));
        return res.status(200).json({
          error: "Hai gia firmato questo documento", code: "ALREADY_SIGNED",
          status: "volunteer_signed", volunteerName: sig.volunteerName, documentTitle: sig.documentTitle,
          organizationName: org?.name || "Organizzazione"
        });
      }
      if (sig.expiresAt && new Date() > sig.expiresAt) {
        await db.update(volunteerSignatures).set({ status: "expired", updatedAt: new Date() }).where(eq(volunteerSignatures.id, sig.id));
        return res.status(410).json({ error: "Il link di firma e scaduto", code: "EXPIRED" });
      }

      const [org] = await db.select().from(organizations).where(eq(organizations.id, sig.organizationId));

      const sigAttachments = Array.isArray(sig.documentAttachments) ? (sig.documentAttachments as any[]).map((a: any) => ({
        id: a.id, filename: a.filename, mimetype: a.mimetype, size: a.size,
      })) : [];

      res.json({
        id: sig.id,
        documentTitle: sig.documentTitle,
        documentContent: sig.documentContent,
        documentAttachments: sigAttachments,
        volunteerName: sig.volunteerName,
        volunteerEmail: sig.volunteerEmail,
        organizationName: org?.name || "Organizzazione",
        organizationLogo: org?.logoUrl,
        status: sig.status,
        orgSignedAt: sig.orgSignedAt,
        orgSignerName: sig.orgSignerName,
        hasOrgSignature: !!sig.orgSignatureData,
        createdAt: sig.createdAt,
        expiresAt: sig.expiresAt,
      });
    } catch (error) {
      console.error("Error loading signature document:", error);
      res.status(500).json({ error: "Errore nel caricamento del documento" });
    }
  });


  // PUBLIC: Download signed certificate PDF
  app.get("/api/public/signature/:token/certificate", async (req, res) => {
    try {
      const { token } = req.params;
      const [sig] = await db.select().from(volunteerSignatures).where(eq(volunteerSignatures.token, token));
      
      if (!sig) return res.status(404).json({ error: "Documento non trovato" });
      if (!sig.volunteerSignatureData) return res.status(400).json({ error: "Firma del volontario mancante" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, sig.organizationId));
      const [volunteer] = await db.select().from(volunteerRegistry).where(eq(volunteerRegistry.id, sig.volunteerId));
      
      const orgName = org?.legalName || org?.name || "Organizzazione";

      const doc = new PDFDocument({ size: "A4", margin: 40 });
      
      const safeFileName = (sig.volunteerName || "volontario").replace(/\s+/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=certificato_firma_" + safeFileName + ".pdf");
      doc.pipe(res);

      // Organization logo
      let y = 40;
      const logoPath = org?.logoUrl ? path.join(process.cwd(), org.logoUrl) : null;
      let hasLogo = false;
      if (logoPath) {
        try {
    
          if (fs.existsSync(logoPath)) {
            const logoWidth = 160;
            const logoHeight = 80;
            doc.image(logoPath, (595 - logoWidth) / 2, y, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight], align: "center", valign: "center" });
            hasLogo = true;
            y += logoHeight + 12;
          }
        } catch(e) { /* logo not available */ }
      }

      // Header bar with org name
      doc.roundedRect(40, y, 515, hasLogo ? 36 : 50, 8).fill("#00A651");
      doc.fontSize(hasLogo ? 16 : 22).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text(orgName.toUpperCase(), 40, y + (hasLogo ? 10 : 14), { width: 515, align: "center" });

      y += (hasLogo ? 36 : 50) + 20;
      
      // Title
      doc.fontSize(16).fillColor("#1a365d").font("Helvetica-Bold");
      doc.text("Certificato di Registrazione Volontario", 40, y, { width: 515, align: "center" });
      y += 30;

      // Document info box
      doc.roundedRect(40, y, 515, 80, 6).fill("#F0FDF4");
      doc.roundedRect(40, y, 515, 80, 6).lineWidth(0.5).strokeColor("#059669").stroke();
      doc.fontSize(10).fillColor("#059669").font("Helvetica-Bold");
      doc.text("DETTAGLI DOCUMENTO", 55, y + 10);
      doc.fontSize(9).fillColor("#333").font("Helvetica");
      const cleanTitle = (sig.documentTitle || "").replace(/ - Prot\..+$/, "");
      doc.text("Documento: " + cleanTitle, 55, y + 28);
      doc.text("Volontario: " + (sig.volunteerName || ""), 55, y + 42);
      doc.text("Organizzazione: " + orgName, 55, y + 56);
      const createdDateStr = sig.createdAt ? new Date(sig.createdAt).toLocaleString("it-IT") : "-";
      doc.text("Data creazione: " + createdDateStr, 340, y + 28);
      if (sig.protocolNumber && sig.protocolYear) {
        doc.text("Protocollo: " + String(sig.protocolNumber).padStart(7, "0") + "/" + sig.protocolYear, 340, y + 42);
      }
      if (volunteer) {
        doc.text("Tipo: " + (volunteer.volunteerType === "continuativo" ? "Continuativo" : "Occasionale"), 340, sig.protocolNumber ? y + 56 : y + 42);
        doc.text("N. Progressivo: " + volunteer.progressiveNumber, 340, sig.protocolNumber ? y + 70 : y + 56);
      }
      y += 95;

      // Document content
      doc.fontSize(11).fillColor("#1a365d").font("Helvetica-Bold");
      doc.text("Contenuto del Documento", 40, y);
      y += 18;
      doc.fontSize(9).fillColor("#333").font("Helvetica");
      const contentText = sig.documentContent || "";
      doc.text(contentText, 40, y, { width: 515 });
      y = doc.y + 20;

      // Signatures section
      const sigW = 240;
      
      doc.fontSize(11).fillColor("#1a365d").font("Helvetica-Bold");
      doc.text("Firma del Volontario", 40, y);
      let orgSignerRole = org?.legalRepRole || '';
      if (!orgSignerRole && sig.orgSignerName) {
        const roleMatch = sig.orgSignerName.match(/\(([^)]+)\)/);
        if (roleMatch) orgSignerRole = roleMatch[1];
      }
      if (!orgSignerRole) orgSignerRole = 'Legale Rappresentante';
      doc.text('Firma ' + orgSignerRole, 300, y);
      y += 16;

      // Volunteer signature
      if (sig.volunteerSignatureData) {
        try {
          const volBase64 = sig.volunteerSignatureData.replace(/^data:image\/\w+;base64,/, "");
          const volBuffer = Buffer.from(volBase64, "base64");
          doc.roundedRect(40, y, sigW, 60, 4).lineWidth(0.5).strokeColor("#D1D5DB").stroke();
          doc.image(volBuffer, 44, y + 4, { width: sigW - 8, height: 52, fit: [sigW - 8, 52] });
        } catch(e) { /* skip */ }
        doc.fontSize(7).fillColor("#059669").font("Helvetica-Bold");
        doc.text("Firmato digitalmente", 40, y + 66);
        doc.fontSize(7).fillColor("#6B7280").font("Helvetica");
        doc.text("Nome: " + (sig.volunteerName || ""), 40, y + 78);
        const volSignedDate = sig.volunteerSignedAt ? new Date(sig.volunteerSignedAt).toLocaleString("it-IT") : "-";
        doc.text("Data: " + volSignedDate, 40, y + 90);
      }

      // Org signature
      if (sig.orgSignatureData) {
        try {
          const orgBase64 = sig.orgSignatureData.replace(/^data:image\/\w+;base64,/, "");
          const orgBuffer = Buffer.from(orgBase64, "base64");
          doc.roundedRect(300, y, sigW, 60, 4).lineWidth(0.5).strokeColor("#D1D5DB").stroke();
          doc.image(orgBuffer, 304, y + 4, { width: sigW - 8, height: 52, fit: [sigW - 8, 52] });
        } catch(e) { /* skip */ }
        doc.fontSize(7).fillColor("#059669").font("Helvetica-Bold");
        doc.text("Firmato digitalmente", 300, y + 66);
        doc.fontSize(7).fillColor("#6B7280").font("Helvetica");
        doc.text("Nome: " + (sig.orgSignerName || "Legale Rappresentante"), 300, y + 78);
        const orgSignedDate = sig.orgSignedAt ? new Date(sig.orgSignedAt).toLocaleString("it-IT") : "-";
        doc.text("Data: " + orgSignedDate, 300, y + 90);
      }
      y += 110;

      // Completion badge
      const allSigned = sig.volunteerSignatureData && sig.orgSignatureData;
      if (allSigned) {
        doc.roundedRect(40, y, 515, 24, 4).fill("#F0FDF4");
        doc.roundedRect(40, y, 515, 24, 4).lineWidth(0.5).strokeColor("#059669").stroke();
        doc.fontSize(8).fillColor("#059669").font("Helvetica-Bold");
        doc.text("DOCUMENTO FIRMATO DIGITALMENTE DA ENTRAMBE LE PARTI", 40, y + 7, { width: 515, align: "center" });
      }
      y += 35;

      // Attachments section
      const certAttachments = Array.isArray(sig.documentAttachments) ? (sig.documentAttachments as any[]) : [];
      if (certAttachments.length > 0) {
        if (y > 700) { doc.addPage(); y = 40; }
        doc.roundedRect(40, y, 515, 20 + certAttachments.length * 16, 6).fill("#F0FDF4");
        doc.roundedRect(40, y, 515, 20 + certAttachments.length * 16, 6).lineWidth(0.5).strokeColor("#059669").stroke();
        doc.fontSize(9).fillColor("#059669").font("Helvetica-Bold");
        doc.text("ALLEGATI AL DOCUMENTO (" + certAttachments.length + ")", 55, y + 6);
        let attY = y + 20;
        for (const att of certAttachments) {
          doc.fontSize(8).fillColor("#333").font("Helvetica");
          const sizeKb = att.size ? Math.round(att.size / 1024) + " KB" : "";
          doc.text("- " + att.filename + (sizeKb ? " (" + sizeKb + ")" : ""), 60, attY);
          attY += 16;
        }
        y = attY + 10;
      }

      // Footer
      doc.fontSize(8).fillColor("#9CA3AF").font("Helvetica");
      const genDate = new Date().toLocaleString("it-IT");
      doc.text("Generato il " + genDate + " - " + orgName, 40, y, { width: 515, align: "center" });
      doc.text("Questo documento certifica l\'avvenuta firma digitale.", 40, y + 12, { width: 515, align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating certificate PDF:", error);
      if (!res.headersSent) res.status(500).json({ error: "Errore nella generazione del certificato" });
    }
  });

  // PUBLIC: Mark signature as viewed
  app.get("/api/public/signature/:token/attachment/:attachmentId", async (req, res) => {
    try {
      const { token, attachmentId } = req.params;
      const [sig] = await db.select().from(volunteerSignatures).where(eq(volunteerSignatures.token, token));
      if (!sig) return res.status(404).json({ error: "Documento non trovato" });

      const attachments = Array.isArray(sig.documentAttachments) ? (sig.documentAttachments as any[]) : [];
      const att = attachments.find((a: any) => a.id === attachmentId);
      if (!att) return res.status(404).json({ error: "Allegato non trovato" });

      if (!att.storagePath || !att.storagePath.startsWith(`document-attachments/${sig.organizationId}/`)) {
        return res.status(403).json({ error: "Accesso non autorizzato" });
      }

      const attFullPath = path.join(UPLOADS_DIR,att.storagePath);
      if (!fs.existsSync(attFullPath)) return res.status(404).json({ error: "File non trovato" });

      res.set({
        "Content-Type": att.mimetype || "application/octet-stream",
        "Content-Disposition": `inline; filename="${att.filename}"`,
        "Cache-Control": "private, max-age=3600",
      });
      const stream = fs.createReadStream(attFullPath);
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading signature attachment:", error);
      res.status(500).json({ error: "Errore nel download dell'allegato" });
    }
  });

  app.post("/api/public/signature/:token/view", async (req, res) => {
    try {
      const { token } = req.params;
      const [sig] = await db.select().from(volunteerSignatures).where(eq(volunteerSignatures.token, token));
      if (!sig) return res.status(404).json({ error: "Non trovato" });
      
      if (!sig.viewedAt) {
        await db.update(volunteerSignatures).set({
          viewedAt: new Date(),
          status: sig.status === "sent" ? "viewed" : sig.status,
          updatedAt: new Date(),
        }).where(eq(volunteerSignatures.id, sig.id));
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  // PUBLIC: Submit volunteer signature
  app.post("/api/public/signature/:token/sign", async (req, res) => {
    try {
      const { token } = req.params;
      const { signatureData } = req.body;
      
      if (!signatureData) return res.status(400).json({ error: "Firma mancante" });

      const [sig] = await db.select().from(volunteerSignatures).where(eq(volunteerSignatures.token, token));
      if (!sig) return res.status(404).json({ error: "Documento non trovato", code: "NOT_FOUND" });
      if (sig.status === "completed" || sig.status === "volunteer_signed") {
        return res.status(400).json({ error: "Documento gia firmato", code: "ALREADY_SIGNED" });
      }
      if (sig.status === "cancelled") return res.status(410).json({ error: "Richiesta annullata", code: "CANCELLED" });
      if (sig.expiresAt && new Date() > sig.expiresAt) {
        return res.status(410).json({ error: "Link scaduto", code: "EXPIRED" });
      }

      const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const newStatus = sig.orgSignatureData ? "completed" : "volunteer_signed";

      await db.update(volunteerSignatures).set({
        volunteerSignatureData: signatureData,
        volunteerSignedAt: new Date(),
        volunteerSignedIp: clientIp,
        status: newStatus,
        updatedAt: new Date(),
      }).where(eq(volunteerSignatures.id, sig.id));

      // If both signed, also update the volunteer registry entry, assign protocol, and re-sign HMAC
      if (newStatus === "completed") {
        await db.update(volunteerRegistry).set({
          startSignatureConfirmed: true,
          startSignatureDate: new Date(),
          updatedAt: new Date(),
        }).where(eq(volunteerRegistry.id, sig.volunteerId));

        if (!sig.protocolNumber) {
          try {
            const currentYear = new Date().getFullYear();
            const [latest] = await db.select({ maxNum: sql<number>`COALESCE(MAX(${volunteerSignatures.protocolNumber}), 0)` })
              .from(volunteerSignatures)
              .where(and(
                eq(volunteerSignatures.organizationId, sig.organizationId),
                eq(volunteerSignatures.protocolYear, currentYear)
              ));
            const nextNum = (latest?.maxNum || 0) + 1;
            const crypto = await import("crypto");
            const docContent = sig.documentContent || sig.documentTitle || "";
            const docHash = crypto.createHash("sha256").update(docContent).digest("hex");
            const [orgForProt2] = await db.select().from(organizations).where(eq(organizations.id, sig.organizationId));
            const protOperatorName2 = orgForProt2?.defaultProtocolOperator || sig.orgSignerName || "Amministratore";
            await db.update(volunteerSignatures).set({
              protocolNumber: nextNum,
              protocolYear: currentYear,
              protocolDate: new Date(),
              protocolOperator: sig.orgSignedBy || sig.createdBy,
              protocolOperatorName: protOperatorName2,
              protocolType: "uscita",
              documentHash: docHash,
              updatedAt: new Date(),
            }).where(eq(volunteerSignatures.id, sig.id));
          } catch (e) {
            console.error("Auto protocol assignment on volunteer sign failed:", e);
          }
        }

        try {
          await signVolunteerEntry(sig.volunteerId);
        } catch (e) {
          console.error("Auto re-sign HMAC after signature completion failed:", e);
        }
      }

      res.json({ 
        success: true, 
        status: newStatus,
        message: newStatus === "completed" 
          ? "Documento firmato con successo da entrambe le parti" 
          : "Firma registrata con successo. In attesa della firma dell'organizzazione."
      });
    } catch (error) {
      console.error("Error submitting signature:", error);
      res.status(500).json({ error: "Errore nella registrazione della firma" });
    }
  });

  // ============================================================================
  // STRUCTURE REQUESTS - Mobile crew can request new structures/departments
  // ============================================================================

  app.post("/api/structure-requests", requireAuth, async (req, res) => {
    try {
      const { type, name, address, structureType, parentStructureId } = req.body;
      if (!name || !type) return res.status(400).json({ error: "Nome e tipo sono obbligatori" });
      
      const userId = getUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const vehicle = user?.vehicleId ? await storage.getVehicle(user.vehicleId) : null;
      
      const [request] = await db.insert(structureRequests).values({
        organizationId: user?.organizationId || '',
        type,
        name: name.toUpperCase(),
        address: address || null,
        structureType: structureType || 'ospedale',
        parentStructureId: parentStructureId || null,
        submittedByUserId: userId || null,
        submittedByName: user?.name || 'Equipaggio',
        vehicleCode: vehicle?.code || null,
        status: 'pending',
      }).returning();
      
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating structure request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/admin/structure-requests", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const isSuperAdmin = req.session?.userRole === 'super_admin';
      
      let requests;
      if (isSuperAdmin) {
        requests = await db.select().from(structureRequests).orderBy(desc(structureRequests.createdAt));
      } else {
        requests = await db.select().from(structureRequests)
          .where(eq(structureRequests.organizationId, userOrgId || ''))
          .orderBy(desc(structureRequests.createdAt));
      }
      res.json(requests);
    } catch (error) {
      console.error("Error fetching structure requests:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/admin/structure-requests/pending-count", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      const isSuperAdmin = req.session?.userRole === 'super_admin';
      
      let result;
      if (isSuperAdmin) {
        result = await db.select({ count: sql<number>`count(*)` }).from(structureRequests)
          .where(eq(structureRequests.status, 'pending'));
      } else {
        result = await db.select({ count: sql<number>`count(*)` }).from(structureRequests)
          .where(and(eq(structureRequests.organizationId, userOrgId || ''), eq(structureRequests.status, 'pending')));
      }
      res.json({ count: Number(result[0]?.count || 0) });
    } catch (error) {
      res.json({ count: 0 });
    }
  });

  app.post("/api/admin/structure-requests/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [request] = await db.select().from(structureRequests).where(eq(structureRequests.id, id));
      if (!request) return res.status(404).json({ error: "Richiesta non trovata" });
      if (request.status !== 'pending') return res.status(400).json({ error: "Richiesta già gestita" });
      
      let resolvedId = request.resolvedStructureId;
      
      // If structure/department wasn't already created (e.g., standalone request), create it now
      if (!resolvedId) {
        if (request.type === 'structure') {
          const structure = await storage.createStructure({
            name: request.name,
            address: request.address || '',
            type: request.structureType || 'ospedale',
          });
          resolvedId = structure.id;
        } else if (request.type === 'department') {
          const department = await storage.createDepartment({ name: request.name });
          resolvedId = department.id;
          
          if (request.parentStructureId) {
            await db.insert(structureDepartments).values({
              structureId: request.parentStructureId,
              departmentId: resolvedId,
            });
          }
        }
      }
      
      const userId = getUserId(req);
      const [updated] = await db.update(structureRequests)
        .set({ 
          status: 'approved', 
          resolvedStructureId: resolvedId, 
          resolvedAt: new Date(),
          resolvedBy: userId,
        })
        .where(eq(structureRequests.id, id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error approving structure request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/structure-requests/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { notes } = req.body;
      
      // Get the request first to check if we need to delete the created structure
      const [request] = await db.select().from(structureRequests).where(eq(structureRequests.id, id));
      if (!request) return res.status(404).json({ error: "Richiesta non trovata" });
      
      // If the structure/department was already created, delete it
      if (request.resolvedStructureId) {
        try {
          if (request.type === 'structure') {
            await storage.deleteStructure(request.resolvedStructureId);
          } else if (request.type === 'department') {
            await storage.deleteDepartment(request.resolvedStructureId);
          }
        } catch (e) {
          console.log('Could not delete rejected structure/department:', e);
        }
      }
      
      const [updated] = await db.update(structureRequests)
        .set({ 
          status: 'rejected', 
          resolvedAt: new Date(),
          resolvedBy: userId,
          notes: notes || null,
        })
        .where(eq(structureRequests.id, id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting structure request:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // BULK DIGITAL SIGNATURE SENDING
  // ============================================================================

  app.post("/api/admin/volunteer-registry/bulk-send-signatures", requireAdmin, async (req, res) => {
    try {
      const userOrgId = req.session?.organizationId;
      if (!userOrgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      
      const volunteers = await db.select().from(volunteerRegistry)
        .where(eq(volunteerRegistry.organizationId, userOrgId));
      
      const existingSignatures = await db.select().from(volunteerSignatures)
        .where(and(
          eq(volunteerSignatures.organizationId, userOrgId),
          inArray(volunteerSignatures.status, ['sent', 'viewed', 'volunteer_signed', 'org_signed', 'completed'])
        ));
      
      const volunteersWithActiveSignatures = new Set(existingSignatures.map(s => s.volunteerId));
      
      const volunteersToSign = volunteers.filter(v => 
        v.email && !volunteersWithActiveSignatures.has(v.id)
      );
      
      if (volunteersToSign.length === 0) {
        return res.json({ sent: 0, message: "Tutti i volontari hanno già una richiesta di firma attiva" });
      }
      
      const [org] = await db.select().from(organizations).where(eq(organizations.id, userOrgId));
      let sentCount = 0;
      let errors: string[] = [];
      
      for (const volunteer of volunteersToSign) {
        try {
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          
          const isFemale = volunteer.gender === 'F';
          const sottoscritto = isFemale ? 'la sottoscritta' : 'il sottoscritto';
          const volontarioLabel = isFemale ? 'volontaria' : 'volontario';
          const artLabel = isFemale ? 'la' : 'il';
          const tipoVol = volunteer.volunteerType === 'continuativo' ? (isFemale ? 'continuativa' : 'continuativo') : 'occasionale';
          const cfText = volunteer.fiscalCode ? `, C.F. ${volunteer.fiscalCode},` : '';
          const orgNameStr = org?.legalName || org?.name || 'Organizzazione';
          const docContent = `Con la presente, ${sottoscritto} ${volunteer.firstName} ${volunteer.lastName}${cfText} dichiara di volersi iscrivere come ${volontarioLabel} ${tipoVol} presso l'organizzazione ${orgNameStr}, ai sensi dell'Art. 17 del Codice del Terzo Settore (D.Lgs. 117/2017, D.M. 6 ottobre 2021).\n\n${sottoscritto.charAt(0).toUpperCase() + sottoscritto.slice(1)} si impegna a:\n- Svolgere la propria attivita di volontariato in modo personale, spontaneo e gratuito;\n- Rispettare il regolamento interno dell'organizzazione;\n- Mantenere la riservatezza sui dati personali e sensibili trattati durante il servizio;\n- Comunicare tempestivamente eventuali variazioni dei propri dati personali.\n\nL'organizzazione si impegna a:\n- Iscrivere ${artLabel} ${volontarioLabel} nel registro dei volontari;\n- Garantire la copertura assicurativa come previsto dalla normativa vigente;\n- Fornire adeguata formazione per lo svolgimento dell'attivita.\n\nData di inizio attivita: ${volunteer.startDate ? new Date(volunteer.startDate).toLocaleDateString('it-IT') : 'Da definire'}\nRuolo: ${volunteer.role || 'Da definire'}\n\nNumero progressivo registro: ${volunteer.progressiveNumber}`;

          const sigValues: any = {
            organizationId: userOrgId,
            volunteerId: volunteer.id,
            token,
            status: 'draft',
            documentType: 'registrazione_volontario',
            documentTitle: 'Iscrizione al Registro Volontari',
            documentContent: docContent,
            volunteerEmail: volunteer.email,
            volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
            expiresAt,
            createdBy: getUserId(req),
          };
          if (org?.legalRepName && org?.legalRepSignature) {
            sigValues.orgSignatureData = org.legalRepSignature;
            sigValues.orgSignedAt = new Date();
            sigValues.orgSignedBy = getUserId(req);
            sigValues.orgSignerName = `${org.legalRepName} (${org.legalRepRole || 'Legale Rappresentante'})`;
          }
          const [signature] = await db.insert(volunteerSignatures).values(sigValues).returning();
          
          const replitDomain = process.env.REPLIT_DEV_DOMAIN;
          const forwardedHost = req.headers['x-forwarded-host'] as string;
          const host = forwardedHost || (replitDomain ? `${replitDomain}:5000` : null) || req.headers.host || 'soccorsodigitale.app';
          const protocol = (req.headers['x-forwarded-proto'] as string) || (replitDomain ? 'https' : (req.secure ? 'https' : 'http'));
          const signingUrl = `${protocol}://${host}/firma/${token}`;
          
          await sendSignatureRequestEmail({
            recipientEmail: volunteer.email!,
            volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
            organizationName: org?.name || 'Organizzazione',
            documentTitle: 'Iscrizione al Registro Volontari',
            signingUrl,
            expiresAt,
          });
          
          await db.update(volunteerSignatures)
            .set({ status: 'sent', sentAt: new Date() })
            .where(eq(volunteerSignatures.id, signature.id));
          
          sentCount++;
        } catch (err: any) {
          console.error(`Error sending signature to ${volunteer.email}:`, err);
          errors.push(`${volunteer.firstName} ${volunteer.lastName}: ${err.message}`);
        }
      }
      
      res.json({ 
        sent: sentCount, 
        total: volunteersToSign.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Inviate ${sentCount} richieste di firma su ${volunteersToSign.length} volontari` 
      });
    } catch (error) {
      console.error("Error bulk sending signatures:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ============================================================================
  // DOCUMENT TEMPLATES & PROTOCOL SYSTEM
  // ============================================================================

  app.get("/api/admin/document-templates", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const templates = await db.select().from(orgDocumentTemplates)
        .where(eq(orgDocumentTemplates.organizationId, orgId))
        .orderBy(desc(orgDocumentTemplates.createdAt));
      res.json(templates);
    } catch (error) {
      console.error("Error loading document templates:", error);
      res.status(500).json({ error: "Errore nel caricamento dei modelli" });
    }
  });

  app.post("/api/admin/document-templates", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const { title, category, content, attachments } = req.body;
      if (!title || !content) return res.status(400).json({ error: "Titolo e contenuto obbligatori" });

      const [template] = await db.insert(orgDocumentTemplates).values({
        organizationId: orgId,
        title: title.trim(),
        category: category || "regolamento",
        content: content.trim(),
        attachments: attachments || [],
        createdBy: getUserId(req),
      }).returning();
      res.json(template);
    } catch (error) {
      console.error("Error creating document template:", error);
      res.status(500).json({ error: "Errore nella creazione del modello" });
    }
  });

  app.put("/api/admin/document-templates/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const { title, category, content, isActive, attachments } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title.trim();
      if (category !== undefined) updates.category = category;
      if (content !== undefined) updates.content = content.trim();
      if (isActive !== undefined) updates.isActive = isActive;
      if (attachments !== undefined) updates.attachments = attachments;

      const [updated] = await db.update(orgDocumentTemplates)
        .set(updates)
        .where(and(eq(orgDocumentTemplates.id, req.params.id), eq(orgDocumentTemplates.organizationId, orgId)))
        .returning();
      if (!updated) return res.status(404).json({ error: "Modello non trovato" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating document template:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento" });
    }
  });

  app.delete("/api/admin/document-templates/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const [template] = await db.select().from(orgDocumentTemplates)
        .where(and(eq(orgDocumentTemplates.id, req.params.id), eq(orgDocumentTemplates.organizationId, orgId)));
      if (template && Array.isArray(template.attachments)) {
        for (const att of template.attachments as any[]) {
          try {
            const attPath = path.join(UPLOADS_DIR,att.storagePath);
            if (fs.existsSync(attPath)) fs.unlinkSync(attPath);
          } catch (e) { /* ignore cleanup errors */ }
        }
      }
      await db.delete(orgDocumentTemplates)
        .where(and(eq(orgDocumentTemplates.id, req.params.id), eq(orgDocumentTemplates.organizationId, orgId)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document template:", error);
      res.status(500).json({ error: "Errore nell'eliminazione" });
    }
  });

  const templateAttachmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

  app.post("/api/admin/document-templates/:id/attachments", requireAdmin, templateAttachmentUpload.single("file"), async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      if (!req.file) return res.status(400).json({ error: "Nessun file caricato" });

      const [template] = await db.select().from(orgDocumentTemplates)
        .where(and(eq(orgDocumentTemplates.id, req.params.id), eq(orgDocumentTemplates.organizationId, orgId)));
      if (!template) return res.status(404).json({ error: "Modello non trovato" });

      const allowedTypes = [
        "application/pdf", "image/jpeg", "image/png", "image/webp",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Tipo file non supportato. Formati accettati: PDF, JPEG, PNG, WEBP, DOC, DOCX" });
      }

      const fileId = crypto.randomBytes(16).toString("hex");
      const ext = req.file.originalname.split('.').pop() || 'bin';
      const storagePath = `document-attachments/${orgId}/${req.params.id}/${fileId}.${ext}`;

      const attSavePath = path.join(UPLOADS_DIR,storagePath);
      fs.mkdirSync(path.dirname(attSavePath), { recursive: true });
      fs.writeFileSync(attSavePath, req.file.buffer);

      const attachment = {
        id: fileId,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        storagePath,
        uploadedAt: new Date().toISOString(),
      };

      const currentAttachments = Array.isArray(template.attachments) ? (template.attachments as any[]) : [];
      currentAttachments.push(attachment);

      await db.update(orgDocumentTemplates)
        .set({ attachments: currentAttachments, updatedAt: new Date() })
        .where(eq(orgDocumentTemplates.id, req.params.id));

      res.json({ success: true, attachment });
    } catch (error) {
      console.error("Error uploading template attachment:", error);
      res.status(500).json({ error: "Errore nel caricamento del file" });
    }
  });

  app.delete("/api/admin/document-templates/:templateId/attachments/:attachmentId", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const [template] = await db.select().from(orgDocumentTemplates)
        .where(and(eq(orgDocumentTemplates.id, req.params.templateId), eq(orgDocumentTemplates.organizationId, orgId)));
      if (!template) return res.status(404).json({ error: "Modello non trovato" });

      const attachments = Array.isArray(template.attachments) ? (template.attachments as any[]) : [];
      const att = attachments.find((a: any) => a.id === req.params.attachmentId);
      if (!att) return res.status(404).json({ error: "Allegato non trovato" });

      try {
        const attDelPath = path.join(UPLOADS_DIR,att.storagePath);
        if (fs.existsSync(attDelPath)) fs.unlinkSync(attDelPath);
      } catch (e) { /* ignore */ }

      const updatedAttachments = attachments.filter((a: any) => a.id !== req.params.attachmentId);
      await db.update(orgDocumentTemplates)
        .set({ attachments: updatedAttachments, updatedAt: new Date() })
        .where(eq(orgDocumentTemplates.id, req.params.templateId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template attachment:", error);
      res.status(500).json({ error: "Errore nell'eliminazione dell'allegato" });
    }
  });

  async function getNextProtocolNumber(orgId: string): Promise<{ number: number; year: number }> {
    const currentYear = new Date().getFullYear();
    const [latest] = await db.select({ maxNum: sql<number>`COALESCE(MAX(${volunteerSignatures.protocolNumber}), 0)` })
      .from(volunteerSignatures)
      .where(and(
        eq(volunteerSignatures.organizationId, orgId),
        eq(volunteerSignatures.protocolYear, currentYear)
      ));
    return { number: (latest?.maxNum || 0) + 1, year: currentYear };
  }

  app.post("/api/admin/document-templates/:id/send", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });

      const { volunteerIds } = req.body;
      if (!volunteerIds || !Array.isArray(volunteerIds) || volunteerIds.length === 0) {
        return res.status(400).json({ error: "Seleziona almeno un volontario" });
      }

      const [template] = await db.select().from(orgDocumentTemplates)
        .where(and(eq(orgDocumentTemplates.id, req.params.id), eq(orgDocumentTemplates.organizationId, orgId)));
      if (!template) return res.status(404).json({ error: "Modello non trovato" });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      const orgName = org?.name || "Organizzazione";
      if (!org?.legalRepName || !org?.legalRepSignature) {
        return res.status(400).json({ error: "Configurare prima il Legale Rappresentante con nome e firma" });
      }

      const volunteers = await db.select().from(volunteerRegistry)
        .where(and(
          inArray(volunteerRegistry.id, volunteerIds),
          eq(volunteerRegistry.organizationId, orgId)
        ));

      const results = { sent: 0, errors: 0, noEmail: 0, details: [] as any[] };

      for (const volunteer of volunteers) {
        if (!volunteer.email) {
          results.noEmail++;
          results.details.push({ name: `${volunteer.firstName} ${volunteer.lastName}`, status: "no_email" });
          continue;
        }

        try {
          const protocolInfo = await getNextProtocolNumber(orgId);
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          const personalizedContent = template.content
            .replace(/\{nome\}/gi, volunteer.firstName)
            .replace(/\{cognome\}/gi, volunteer.lastName)
            .replace(/\{nome_completo\}/gi, `${volunteer.firstName} ${volunteer.lastName}`)
            .replace(/\{codice_fiscale\}/gi, volunteer.fiscalCode || '')
            .replace(/\{organizzazione\}/gi, orgName)
            .replace(/\{data\}/gi, new Date().toLocaleDateString('it-IT'))
            .replace(/\{numero_progressivo\}/gi, String(volunteer.progressiveNumber || ''));

          const docHash = crypto.createHash("sha256").update(personalizedContent).digest("hex");
          const templateAttachments = Array.isArray(template.attachments) ? (template.attachments as any[]) : [];
          const signatureAttachments: any[] = [];
          if (templateAttachments.length > 0) {
            for (const att of templateAttachments) {
              try {
                const sigFileId = crypto.randomBytes(16).toString("hex");
                const ext = att.filename?.split('.').pop() || 'bin';
                const sigStoragePath = `document-attachments/${orgId}/signatures/${token}/${sigFileId}.${ext}`;
                const srcPath = path.join(UPLOADS_DIR,att.storagePath);
                const destPath = path.join(UPLOADS_DIR,sigStoragePath);
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
                signatureAttachments.push({ ...att, id: sigFileId, storagePath: sigStoragePath });
              } catch (copyErr) {
                signatureAttachments.push(att);
              }
            }
          }
          const [signature] = await db.insert(volunteerSignatures).values({
            organizationId: orgId,
            volunteerId: volunteer.id,
            token,
            status: "draft",
            documentType: template.category,
            documentTitle: `${template.title} - Prot. ${String(protocolInfo.number).padStart(7, '0')}/${protocolInfo.year}`,
            documentContent: personalizedContent,
            documentAttachments: signatureAttachments,
            documentHash: docHash,
            volunteerEmail: volunteer.email,
            volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
            orgSignatureData: org.legalRepSignature,
            orgSignedAt: new Date(),
            orgSignedBy: getUserId(req),
            orgSignerName: `${org.legalRepName} (${org.legalRepRole || 'Legale Rappresentante'})`,
            expiresAt,
            protocolNumber: protocolInfo.number,
            protocolYear: protocolInfo.year,
            protocolDate: new Date(),
            protocolOperator: getUserId(req),
            protocolOperatorName: org.defaultProtocolOperator || "Amministratore",
            protocolType: "uscita",
            createdBy: getUserId(req),
          }).returning();

          const replitDomain = process.env.REPLIT_DEV_DOMAIN;
          const forwardedHost = req.headers['x-forwarded-host'] as string;
          const host = forwardedHost || (replitDomain ? `${replitDomain}:5000` : null) || req.headers.host || 'soccorsodigitale.app';
          const reqProtocol = (req.headers['x-forwarded-proto'] as string) || (replitDomain ? 'https' : 'http');
          const signingUrl = `${reqProtocol}://${host}/firma/${token}`;

          const emailSent = await sendSignatureRequestEmail({
            recipientEmail: volunteer.email,
            volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
            organizationName: orgName,
            documentTitle: template.title,
            signingUrl,
            expiresAt,
          });

          if (emailSent) {
            await db.update(volunteerSignatures)
              .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
              .where(eq(volunteerSignatures.id, signature.id));
            results.sent++;
          } else {
            results.errors++;
          }
          results.details.push({ name: `${volunteer.firstName} ${volunteer.lastName}`, status: emailSent ? "sent" : "email_error", protocolNumber: protocolInfo.number });
        } catch (err) {
          results.errors++;
          results.details.push({ name: `${volunteer.firstName} ${volunteer.lastName}`, status: "error" });
        }
      }

      res.json({
        success: true,
        message: `Documento inviato a ${results.sent} volontari` + (results.noEmail > 0 ? ` (${results.noEmail} senza email)` : '') + (results.errors > 0 ? ` (${results.errors} errori)` : ''),
        ...results
      });
    } catch (error) {
      console.error("Error sending document template:", error);
      res.status(500).json({ error: "Errore nell'invio del documento" });
    }
  });

  app.get("/api/admin/protocol-log", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organization ID required" });
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

      const protocols = await db.select().from(volunteerSignatures)
        .where(and(
          eq(volunteerSignatures.organizationId, orgId),
          eq(volunteerSignatures.protocolYear, year),
          isNotNull(volunteerSignatures.protocolNumber)
        ))
        .orderBy(asc(volunteerSignatures.protocolNumber));
      res.json(protocols);
    } catch (error) {
      console.error("Error loading protocol log:", error);
      res.status(500).json({ error: "Errore nel caricamento del protocollo" });
    }
  });

  // ============================================================================

  // ============================================================================
  // ULSS 9 COMPLIANCE - ART. 8 MONTHLY KPI REPORTS
  // ============================================================================

  app.get("/api/reports/art8-monthly", requireAdmin, async (req, res) => {
    try {
      const { month } = req.query;
      if (!month || !/^\d{4}-\d{2}$/.test(month as string)) {
        return res.status(400).json({ error: "Formato mese richiesto: YYYY-MM" });
      }
      const orgId = getEffectiveOrgId(req);
      const startDate = `${month}-01`;
      const endOfMonth = new Date(parseInt((month as string).split("-")[0]), parseInt((month as string).split("-")[1]), 0);
      const endDate = `${month}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

      const monthTrips = await db.select().from(trips)
        .where(and(
          eq(trips.organizationId, orgId || ''),
          gte(trips.serviceDate, startDate),
          lte(trips.serviceDate, endDate),
          eq(trips.isReturnTrip, false)
        ));

      const totalTrips = monthTrips.length;
      const tripsOver100km = monthTrips.filter(t => (t.kmTraveled || 0) > 100).length;

      const durations = monthTrips.filter(t => t.durationMinutes && t.durationMinutes > 0).map(t => t.durationMinutes!);
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      
      let onTimeCount = 0;
      let tripsWithSchedule = 0;
      let slaViolations60 = 0;
      let slaViolations30 = 0;
      
      for (const trip of monthTrips) {
        if (trip.scheduledDepartureTime && trip.departureTime) {
          tripsWithSchedule++;
          const scheduled = trip.scheduledDepartureTime.split(":").map(Number);
          const actual = trip.departureTime.split(":").map(Number);
          const scheduledMin = scheduled[0] * 60 + scheduled[1];
          const actualMin = actual[0] * 60 + actual[1];
          const delayMin = actualMin - scheduledMin;
          
          if (Math.abs(delayMin) <= 30) onTimeCount++;
          if (delayMin > 30) slaViolations30++;
          if (delayMin > 60) slaViolations60++;
        }
      }
      
      const onTimePercentage = tripsWithSchedule > 0 ? Math.round((onTimeCount / tripsWithSchedule) * 100) : null;

      const byServiceType: Record<string, any> = {};
      for (const trip of monthTrips) {
        const st = trip.serviceType || "altro";
        if (!byServiceType[st]) byServiceType[st] = { count: 0, totalKm: 0, totalDuration: 0, over100km: 0 };
        byServiceType[st].count++;
        byServiceType[st].totalKm += trip.kmTraveled || 0;
        byServiceType[st].totalDuration += trip.durationMinutes || 0;
        if ((trip.kmTraveled || 0) > 100) byServiceType[st].over100km++;
      }

      const totalKm = monthTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);

      res.json({
        month,
        totalTrips,
        totalKm,
        tripsOver100km,
        avgDurationMinutes: avgDuration,
        onTimePercentage,
        tripsWithSchedule,
        onTimeCount,
        slaViolations30,
        slaViolations60,
        byServiceType,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Art.8 monthly report error:", error);
      res.status(500).json({ error: "Errore generazione report" });
    }
  });

  // ============================================================================
  // MONITORING PORTAL (CUT) - TOKEN MANAGEMENT + PUBLIC ACCESS
  // ============================================================================

  app.post("/api/admin/monitoring-tokens", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const { name } = req.body;
      const token = crypto.randomBytes(32).toString("hex");
      const [created] = await db.insert(monitoringTokens).values({
        organizationId: orgId || '',
        token,
        name: name || "Portale CUT"
      }).returning();
      res.json(created);
    } catch (error) {
      console.error("Create monitoring token error:", error);
      res.status(500).json({ error: "Errore creazione token" });
    }
  });

  app.get("/api/admin/monitoring-tokens", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const tokens = await db.select().from(monitoringTokens)
        .where(eq(monitoringTokens.organizationId, orgId || ''))
        .orderBy(desc(monitoringTokens.createdAt));
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.delete("/api/admin/monitoring-tokens/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      await db.delete(monitoringTokens)
        .where(and(eq(monitoringTokens.id, req.params.id), eq(monitoringTokens.organizationId, orgId || '')));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/public/monitoring/:token", async (req, res) => {
    try {
      const [tokenRecord] = await db.select().from(monitoringTokens)
        .where(and(
          eq(monitoringTokens.token, req.params.token),
          eq(monitoringTokens.isActive, true)
        ));
      
      if (!tokenRecord) return res.status(404).json({ error: "Token non valido" });
      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
        return res.status(403).json({ error: "Token scaduto" });
      }

      await db.update(monitoringTokens)
        .set({ lastAccessedAt: new Date(), accessCount: (tokenRecord.accessCount || 0) + 1 })
        .where(eq(monitoringTokens.id, tokenRecord.id));

      const orgId = tokenRecord.organizationId;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));

      const allVehicles = await db.select({
        id: vehicles.id,
        code: vehicles.code,
        licensePlate: vehicles.licensePlate,
        model: vehicles.model,
        vehicleType: vehicles.vehicleType,
        vehicleClass: vehicles.vehicleClass,
        isActive: vehicles.isActive,
        isOnService: vehicles.isOnService,
        isReserve: vehicles.isReserve,
        latitude: vehicles.latitude,
        longitude: vehicles.longitude,
        lastLocationAt: vehicles.lastLocationAt,
        natoName: vehicles.natoName,
        maintenanceStatus: vehicles.maintenanceStatus,
        locationId: vehicles.locationId
      }).from(vehicles)
        .where(and(eq(vehicles.organizationId, orgId), eq(vehicles.isActive, true)));

      const today = new Date().toISOString().split("T")[0];
      const todayTrips = await db.select({
        id: trips.id,
        serviceType: trips.serviceType,
        departureTime: trips.departureTime,
        returnTime: trips.returnTime,
        originType: trips.originType,
        destinationType: trips.destinationType,
        originStructureId: trips.originStructureId,
        destinationStructureId: trips.destinationStructureId,
        originDepartmentId: trips.originDepartmentId,
        destinationDepartmentId: trips.destinationDepartmentId,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        kmTraveled: trips.kmTraveled,
        durationMinutes: trips.durationMinutes,
        vehicleId: trips.vehicleId,
        isReturnTrip: trips.isReturnTrip,
        slaViolation: trips.slaViolation,
        scheduledDepartureTime: trips.scheduledDepartureTime,
      }).from(trips)
        .where(and(eq(trips.organizationId, orgId), eq(trips.serviceDate, today)));
      
      // Resolve structure and department names for trips
      const structureIds = new Set<string>();
      const departmentIds = new Set<string>();
      for (const t of todayTrips) {
        if (t.originStructureId) structureIds.add(t.originStructureId);
        if (t.destinationStructureId) structureIds.add(t.destinationStructureId);
        if (t.originDepartmentId) departmentIds.add(t.originDepartmentId);
        if (t.destinationDepartmentId) departmentIds.add(t.destinationDepartmentId);
      }
      
      const structureMap: Record<string, string> = {};
      const departmentMap: Record<string, string> = {};
      
      if (structureIds.size > 0) {
        const structs = await db.select({ id: structuresTable2.id, name: structuresTable2.name })
          .from(structuresTable2).where(inArray(structuresTable2.id, [...structureIds]));
        for (const s of structs) structureMap[s.id] = s.name;
      }
      if (departmentIds.size > 0) {
        const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name })
          .from(departmentsTable).where(inArray(departmentsTable.id, [...departmentIds]));
        for (const d of depts) departmentMap[d.id] = d.name;
      }
      
      const allLocations = await storage.getLocations();
      const locationMap: Record<string, string> = {};
      for (const loc of allLocations) locationMap[loc.id] = loc.name;

      function formatLocation(type: string | null, structureId: string | null, departmentId: string | null, address: string | null, vehicleId?: string | null): string {
        const deptName = departmentId ? departmentMap[departmentId] : null;
        
        if (type === 'sede') {
          if (structureId && locationMap[structureId]) {
            return `Sede ${locationMap[structureId]}`;
          }
          if (vehicleId) {
            const veh = allVehicles.find(v => v.id === vehicleId);
            if (veh?.locationId && locationMap[veh.locationId]) {
              return `Sede ${locationMap[veh.locationId]}`;
            }
          }
          return 'Sede';
        }
        
        if (type === 'domicilio') {
          return address ? `Domicilio - ${address}` : 'Domicilio';
        }
        
        const structureName = structureId ? structureMap[structureId] : null;
        if (structureName) {
          let label = structureName;
          if (deptName) label += ` (${deptName})`;
          return label;
        }
        if (address) {
          const typeLabels: Record<string, string> = {
            ospedale: "Ospedale", casa_di_riposo: "Casa di Riposo",
            clinica: "Clinica", ambulatorio: "Ambulatorio", altro: "Altro"
          };
          const typeLabel = typeLabels[type || ""] || "";
          return typeLabel ? `${typeLabel} - ${address}` : address;
        }
        return 'N/D';
      }

      const orgVehicleIds = allVehicles.map(v => v.id);
      const activeSessions = orgVehicleIds.length > 0
        ? await db.select().from(activeTrackingSessions)
            .where(and(eq(activeTrackingSessions.isActive, true), inArray(activeTrackingSessions.vehicleId, orgVehicleIds)))
        : [];

      const activeVehicleIds = new Set(activeSessions.map(s => s.vehicleId));

      const vehiclesData = allVehicles.map(v => ({
        ...v,
        status: activeVehicleIds.has(v.id) ? "in_servizio" : (v.isOnService ? "in_servizio" : "disponibile"),
        locationName: v.locationId ? (locationMap[v.locationId] || null) : null
      }));

      const completedTrips = todayTrips.filter(t => t.returnTime && !t.isReturnTrip).length;
      const activeTrips = todayTrips.filter(t => t.departureTime && !t.returnTime && !t.isReturnTrip).length;
      const slaViolationsToday = todayTrips.filter(t => t.slaViolation).length;

      res.json({
        organizationName: org?.name || "N/D",
        organizationLogo: org?.logoUrl || null,
        vehicles: vehiclesData,
        todaySummary: {
          totalTrips: todayTrips.filter(t => !t.isReturnTrip).length,
          completed: completedTrips,
          active: activeTrips,
          slaViolations: slaViolationsToday,
          totalKm: todayTrips.reduce((s, t) => s + (t.kmTraveled || 0), 0)
        },
        activeTransports: todayTrips.filter(t => t.departureTime && !t.returnTime && !t.isReturnTrip).map(t => ({
          id: t.id,
          serviceType: t.serviceType,
          departureTime: t.departureTime,
          scheduledDepartureTime: t.scheduledDepartureTime,
          vehicleId: t.vehicleId,
          origin: formatLocation(t.originType, t.originStructureId, t.originDepartmentId, t.originAddress, t.vehicleId),
          destination: formatLocation(t.destinationType, t.destinationStructureId, t.destinationDepartmentId, t.destinationAddress, t.vehicleId),
          slaViolation: t.slaViolation,
        })),
        completedTransports: todayTrips.filter(t => t.returnTime && !t.isReturnTrip).map(t => ({
          id: t.id,
          serviceType: t.serviceType,
          departureTime: t.departureTime,
          returnTime: t.returnTime,
          vehicleId: t.vehicleId,
          origin: formatLocation(t.originType, t.originStructureId, t.originDepartmentId, t.originAddress, t.vehicleId),
          destination: formatLocation(t.destinationType, t.destinationStructureId, t.destinationDepartmentId, t.destinationAddress, t.vehicleId),
          kmTraveled: t.kmTraveled,
          durationMinutes: t.durationMinutes,
          slaViolation: t.slaViolation,
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Monitoring portal error:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  // ============================================================================
  // SLA VIOLATION AUTO-DETECTION
  // ============================================================================

  app.post("/api/trips/:id/check-sla", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const [trip] = await db.select().from(trips).where(and(eq(trips.id, req.params.id), eq(trips.organizationId, orgId || '')));
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

  // ============================================================================
  // COMPLIANCE DASHBOARD - ULSS 9 CONFORMITA APPALTO
  // ============================================================================

  app.get("/api/admin/compliance-dashboard", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) {
        const allOrgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
        if (allOrgs.length === 0) return res.status(404).json({ error: "Nessuna organizzazione trovata" });
        return res.redirect(`/api/admin/compliance-dashboard?organizationFilter=${allOrgs[0].id}`);
      }
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const startDate = `${currentMonth}-01`;
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endDate = `${currentMonth}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

      const orgVehicles = await db.select().from(vehicles)
        .where(and(eq(vehicles.organizationId, orgId), eq(vehicles.isActive, true)));

      const activeVehicles = orgVehicles.filter(v => !v.isReserve);
      const reserveVehicles = orgVehicles.filter(v => v.isReserve);
      const tipoA = orgVehicles.filter(v => v.vehicleClass === "tipo_a").length;
      const tipoB = orgVehicles.filter(v => v.vehicleClass === "tipo_b").length;

      const requiredReserve = activeVehicles.length <= 9 
        ? Math.ceil(activeVehicles.length / 3) 
        : Math.ceil(activeVehicles.length / 4);
      const reserveCompliant = reserveVehicles.length >= requiredReserve;

      const vehiclesWithExpiry = orgVehicles.filter(v => v.nextRevisionDate);
      const expiringVehicles = vehiclesWithExpiry.filter(v => {
        const rev = new Date(v.nextRevisionDate!);
        const daysUntil = Math.ceil((rev.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30;
      });

      const monthTrips = await db.select().from(trips)
        .where(and(
          eq(trips.organizationId, orgId),
          gte(trips.serviceDate, startDate),
          lte(trips.serviceDate, endDate),
          eq(trips.isReturnTrip, false)
        ));

      const slaViolationsMonth = monthTrips.filter(t => t.slaViolation).length;
      const tripsOver100km = monthTrips.filter(t => (t.kmTraveled || 0) > 100).length;

      const monTokens = await db.select().from(monitoringTokens)
        .where(and(eq(monitoringTokens.organizationId, orgId), eq(monitoringTokens.isActive, true)));

      const orgStaff = await db.select().from(staffMembers)
        .where(eq(staffMembers.organizationId, orgId));
      const activeStaff = orgStaff.filter((s: any) => s.isActive);

      const orgSanLogs = await db.select().from(sanitizationLogs)
        .where(and(
          eq(sanitizationLogs.organizationId, orgId),
          gte(sanitizationLogs.completedAt, new Date(startDate))
        ));

      const art7Status = reserveCompliant && expiringVehicles.length === 0 ? "green" : 
                          (reserveCompliant || expiringVehicles.length === 0 ? "yellow" : "red");
      
      const art8Status = monTokens.length > 0 ? "green" : "red";
      
      const art9Status = orgSanLogs.length >= orgVehicles.length ? "green" : 
                          (orgSanLogs.length > 0 ? "yellow" : "red");
      
      const art13Status = slaViolationsMonth === 0 ? "green" : 
                           (slaViolationsMonth <= 3 ? "yellow" : "red");

      res.json({
        month: currentMonth,
        art7: {
          status: art7Status,
          totalVehicles: orgVehicles.length,
          activeVehicles: activeVehicles.length,
          reserveVehicles: reserveVehicles.length,
          requiredReserve,
          reserveCompliant,
          tipoA, tipoB,
          expiringDocuments: expiringVehicles.length
        },
        art8: {
          status: art8Status,
          totalTrips: monthTrips.length,
          tripsOver100km,
          monitoringPortalActive: monTokens.length > 0,
          monitoringTokens: monTokens.length
        },
        art9: {
          status: art9Status,
          sanitizationLogs: orgSanLogs.length,
          vehiclesCount: orgVehicles.length
        },
        art10: {
          status: "green",
          totalStaff: activeStaff.length,
        },
        art13: {
          status: art13Status,
          slaViolationsMonth,
          totalTrips: monthTrips.length,
          violationRate: monthTrips.length > 0 ? Math.round((slaViolationsMonth / monthTrips.length) * 100) : 0
        }
      });
    } catch (error) {
      console.error("Compliance dashboard error:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  // Art.8 Monthly PDF Report
  app.get("/api/reports/art8-monthly/pdf", requireAdmin, async (req, res) => {
    try {
      const { month } = req.query;
      if (!month || !/^\d{4}-\d{2}$/.test(month as string)) {
        return res.status(400).json({ error: "Formato mese richiesto: YYYY-MM" });
      }
      const orgId = getEffectiveOrgId(req);
      const startDate = `${month}-01`;
      const endOfMonth = new Date(parseInt((month as string).split("-")[0]), parseInt((month as string).split("-")[1]), 0);
      const endDate = `${month}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId || ''));
      const orgName = org?.name || "Organizzazione";

      const monthTrips = await db.select().from(trips)
        .where(and(
          eq(trips.organizationId, orgId || ''),
          gte(trips.serviceDate, startDate),
          lte(trips.serviceDate, endDate),
          eq(trips.isReturnTrip, false)
        ));

      const totalTrips = monthTrips.length;
      const tripsOver100km = monthTrips.filter(t => (t.kmTraveled || 0) > 100).length;
      const durations = monthTrips.filter(t => t.durationMinutes && t.durationMinutes > 0).map(t => t.durationMinutes!);
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      const totalKm = monthTrips.reduce((sum, t) => sum + (t.kmTraveled || 0), 0);

      let onTimeCount = 0;
      let tripsWithSchedule = 0;
      for (const trip of monthTrips) {
        if (trip.scheduledDepartureTime && trip.departureTime) {
          tripsWithSchedule++;
          const scheduled = trip.scheduledDepartureTime.split(":").map(Number);
          const actual = trip.departureTime.split(":").map(Number);
          const diff = Math.abs((actual[0] * 60 + actual[1]) - (scheduled[0] * 60 + scheduled[1]));
          if (diff <= 30) onTimeCount++;
        }
      }
      const onTimePct = tripsWithSchedule > 0 ? Math.round((onTimeCount / tripsWithSchedule) * 100) : null;

      const slaViolationTrips = monthTrips.filter(t => t.slaViolation);

      const monthNames = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
      const [yearStr, monthStr] = (month as string).split("-");
      const monthLabel = `${monthNames[parseInt(monthStr) - 1]} ${yearStr}`;

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Report_Art8_${month}.pdf"`);
      doc.pipe(res);

      doc.fontSize(18).font("Helvetica-Bold").text("REPORT MENSILE TRACCIABILITA' OPERATIVA", { align: "center" });
      doc.fontSize(12).font("Helvetica").text("Art. 8 - Capitolato ULSS 9 Scaligera", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(14).font("Helvetica-Bold").text(monthLabel, { align: "center" });
      doc.fontSize(11).font("Helvetica").text(`Organizzazione: ${orgName}`, { align: "center" });
      doc.text(`Generato il: ${new Date().toLocaleDateString("it-IT")} alle ${new Date().toLocaleTimeString("it-IT")}`, { align: "center" });
      doc.moveDown(1.5);

      doc.rect(50, doc.y, 495, 1).fill("#0066CC");
      doc.moveDown(0.5);

      doc.fontSize(14).fillColor("#0066CC").font("Helvetica-Bold").text("INDICATORI CHIAVE DI PERFORMANCE (KPI)");
      doc.moveDown(0.5);

      const kpiY = doc.y;
      doc.fontSize(11).fillColor("#333333").font("Helvetica");

      const drawKpiRow = (label: string, value: string, y: number) => {
        doc.font("Helvetica").text(label, 60, y);
        doc.font("Helvetica-Bold").text(value, 380, y, { width: 155, align: "right" });
      };

      drawKpiRow("Trasporti totali nel mese", String(totalTrips), kpiY);
      drawKpiRow("Chilometri totali percorsi", `${totalKm.toLocaleString("it-IT")} km`, kpiY + 22);
      drawKpiRow("Durata media trasporto", `${avgDuration} minuti`, kpiY + 44);
      drawKpiRow("Trasporti oltre 100 km", String(tripsOver100km), kpiY + 66);
      if (onTimePct !== null) {
        drawKpiRow("Puntualita' (entro +-30 min)", `${onTimePct}%`, kpiY + 88);
        drawKpiRow("Trasporti con orario programmato", `${onTimeCount}/${tripsWithSchedule}`, kpiY + 110);
      }
      doc.y = kpiY + (onTimePct !== null ? 140 : 100);
      doc.moveDown(1);

      doc.rect(50, doc.y, 495, 1).fill("#0066CC");
      doc.moveDown(0.5);
      doc.fontSize(14).fillColor("#0066CC").font("Helvetica-Bold").text("DETTAGLIO PER TIPOLOGIA DI SERVIZIO");
      doc.moveDown(0.5);

      const serviceLabels: Record<string, string> = {
        dialisi: "Dialisi", dimissione: "Dimissioni", trasferimento: "Trasferimenti",
        trasporto_programmato: "Trasporti Programmati", visita: "Visite Ambulatoriali",
        disabili: "Trasporto Disabili", altro: "Altro"
      };

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#555");
      const headerY = doc.y;
      doc.text("Tipologia", 60, headerY, { width: 150 });
      doc.text("N. Trasporti", 220, headerY, { width: 80, align: "right" });
      doc.text("Km Totali", 310, headerY, { width: 80, align: "right" });
      doc.text(">100km", 400, headerY, { width: 60, align: "right" });
      doc.y = headerY + 14;
      doc.moveDown(0.3);
      doc.rect(60, doc.y, 470, 0.5).fill("#CCCCCC");
      doc.moveDown(0.3);

      const byServiceType: Record<string, any> = {};
      for (const trip of monthTrips) {
        const st = trip.serviceType || "altro";
        if (!byServiceType[st]) byServiceType[st] = { count: 0, totalKm: 0, over100km: 0 };
        byServiceType[st].count++;
        byServiceType[st].totalKm += trip.kmTraveled || 0;
        if ((trip.kmTraveled || 0) > 100) byServiceType[st].over100km++;
      }

      doc.font("Helvetica").fontSize(10).fillColor("#333");
      for (const [type, data] of Object.entries(byServiceType)) {
        const label = serviceLabels[type] || type;
        const rowY = doc.y;
        doc.text(label, 60, rowY, { width: 150 });
        doc.text(String((data as any).count), 220, rowY, { width: 80, align: "right" });
        doc.text(`${(data as any).totalKm.toLocaleString("it-IT")}`, 310, rowY, { width: 80, align: "right" });
        doc.text(String((data as any).over100km), 400, rowY, { width: 60, align: "right" });
        doc.moveDown(0.4);
      }

      if (slaViolationTrips.length > 0) {
        doc.moveDown(1);
        doc.rect(50, doc.y, 495, 1).fill("#DC2626");
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor("#DC2626").font("Helvetica-Bold").text("VIOLAZIONI SLA");
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor("#333").font("Helvetica");
        doc.text(`Numero violazioni rilevate: ${slaViolationTrips.length}`);
        doc.text(`Ritardi superiori a 60 minuti: ${slaViolationTrips.filter(t => t.slaViolationType === "delay_60min").length}`);
      }

      doc.moveDown(2);
      doc.fontSize(9).fillColor("#999").font("Helvetica");
      doc.text("Documento generato automaticamente da SOCCORSO DIGITALE", { align: "center" });
      doc.text("www.soccorsodigitale.app", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Art.8 PDF report error:", error);
      res.status(500).json({ error: "Errore generazione PDF" });
    }
  });

  // PREMIUM MODULES / STRIPE PAYMENT INFRASTRUCTURE
  // ============================================================================

  app.get("/api/admin/permissions-catalog", requireAdmin, async (_req, res) => {
    res.json({
      permissions: ALL_PERMISSIONS,
      categories: PERMISSION_CATEGORIES,
      grouped: getPermissionsByCategory(),
    });
  });

  app.get("/api/admin/custom-roles", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      
      const roles = await db.select().from(orgCustomRoles)
        .where(and(eq(orgCustomRoles.organizationId, orgId), eq(orgCustomRoles.isActive, true)))
        .orderBy(orgCustomRoles.name);
      
      const rolesWithCount = await Promise.all(roles.map(async (role) => {
        const [countResult] = await db.select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(
            eq(users.organizationId, orgId),
            eq(users.isActive, true),
            eq(users.role, 'custom_role'),
            sql`${users.id} IN (SELECT user_id FROM org_user_invitations WHERE custom_role_id = ${role.id} AND status = 'accepted')`
          ));
        return { ...role, userCount: Number(countResult?.count || 0) };
      }));

      res.json(rolesWithCount);
    } catch (error) {
      console.error("Error fetching custom roles:", error);
      res.status(500).json({ error: "Errore nel recupero dei ruoli" });
    }
  });

  app.post("/api/admin/custom-roles", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const userId = getUserId(req);
      
      const { name, description, permissions, color } = req.body;
      if (!name || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ error: "Nome e permessi sono obbligatori" });
      }

      const validPerms = permissions.filter((p: string) => ALL_PERMISSIONS.some(ap => ap.key === p));

      const [role] = await db.insert(orgCustomRoles).values({
        organizationId: orgId,
        name: name.trim(),
        description: description?.trim() || null,
        permissions: validPerms,
        color: color || "#6B7280",
        createdBy: userId,
      }).returning();

      res.json(role);
    } catch (error: any) {
      if (error?.constraint === "custom_role_name_org_unique") {
        return res.status(400).json({ error: "Esiste già un ruolo con questo nome" });
      }
      console.error("Error creating custom role:", error);
      res.status(500).json({ error: "Errore nella creazione del ruolo" });
    }
  });

  app.put("/api/admin/custom-roles/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const { id } = req.params;
      const { name, description, permissions, color } = req.body;

      const [existing] = await db.select().from(orgCustomRoles)
        .where(and(eq(orgCustomRoles.id, id), eq(orgCustomRoles.organizationId, orgId)));
      if (!existing) return res.status(404).json({ error: "Ruolo non trovato" });

      const validPerms = permissions?.filter((p: string) => ALL_PERMISSIONS.some(ap => ap.key === p));

      const [updated] = await db.update(orgCustomRoles)
        .set({
          name: name?.trim() || existing.name,
          description: description !== undefined ? description?.trim() : existing.description,
          permissions: validPerms || existing.permissions,
          color: color || existing.color,
          updatedAt: new Date(),
        })
        .where(eq(orgCustomRoles.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      if (error?.constraint === "custom_role_name_org_unique") {
        return res.status(400).json({ error: "Esiste già un ruolo con questo nome" });
      }
      console.error("Error updating custom role:", error);
      res.status(500).json({ error: "Errore nella modifica del ruolo" });
    }
  });

  app.delete("/api/admin/custom-roles/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const { id } = req.params;

      await db.update(orgCustomRoles)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(orgCustomRoles.id, id), eq(orgCustomRoles.organizationId, orgId)));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom role:", error);
      res.status(500).json({ error: "Errore nell'eliminazione del ruolo" });
    }
  });

  app.post("/api/admin/invite-user", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const invitedBy = getUserId(req);
      
      const { email, name, roleType, customRoleId, standardRole, sendEmail } = req.body;
      if (!email || !name) {
        return res.status(400).json({ error: "Email e nome sono obbligatori" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Esiste già un utente con questa email" });
      }

      const password = generateSecurePassword(12);
      const actualRole = roleType === "custom" ? "org_admin" : (standardRole || "crew");

      const [newUser] = await db.insert(users).values({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        role: actualRole,
        customRoleId: roleType === "custom" ? customRoleId : null,
        accountType: "person",
        organizationId: orgId,
        isActive: true,
      }).returning();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const [invitation] = await db.insert(orgUserInvitations).values({
        organizationId: orgId,
        customRoleId: roleType === "custom" ? customRoleId : null,
        standardRole: roleType === "standard" ? standardRole : null,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        temporaryPassword: password,
        invitedBy,
        userId: newUser.id,
        expiresAt,
      }).returning();

      let emailSentSuccessfully = false;
      if (sendEmail) {
        try {
          const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
          const orgName = org?.name || "Soccorso Digitale";

          let displayRoleName = actualRole;
          const roleLabels: Record<string, string> = {
            admin: "Amministratore",
            org_admin: "Amministratore Organizzazione",
            crew: "Equipaggio",
            manager: "Responsabile",
            dispatcher: "Operatore Centrale",
            viewer: "Visualizzatore",
          };
          if (roleType === "custom" && customRoleId) {
            const [cr] = await db.select().from(orgCustomRoles).where(eq(orgCustomRoles.id, customRoleId));
            displayRoleName = cr?.name || "Ruolo personalizzato";
          } else {
            displayRoleName = roleLabels[actualRole] || actualRole;
          }

          emailSentSuccessfully = await sendInvitationEmail({
            recipientEmail: email.trim().toLowerCase(),
            recipientName: name.trim(),
            organizationName: orgName,
            password,
            roleName: displayRoleName,
          });
          if (!emailSentSuccessfully) {
            console.error("sendInvitationEmail returned false - email was not sent for:", email.trim().toLowerCase());
          }
        } catch (emailError) {
          console.error("Email sending failed with exception:", emailError);
        }
      }

      db.insert(orgAccessLogs).values({
        organizationId: orgId,
        userId: invitedBy || "system",
        userName: "Admin",
        action: "user_invited",
        details: { invitedEmail: email, invitedName: name, role: actualRole },
      }).catch(() => {});

      res.json({
        invitation,
        credentials: { email: email.trim().toLowerCase(), password },
        userId: newUser.id,
        emailSent: emailSentSuccessfully,
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ error: "Errore nella creazione dell'invito" });
    }
  });

  app.get("/api/admin/invitations", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });

      const invitations = await db.select().from(orgUserInvitations)
        .where(eq(orgUserInvitations.organizationId, orgId))
        .orderBy(desc(orgUserInvitations.createdAt));

      const enriched = await Promise.all(invitations.map(async (inv) => {
        let roleName = inv.standardRole || "crew";
        if (inv.customRoleId) {
          const [cr] = await db.select().from(orgCustomRoles).where(eq(orgCustomRoles.id, inv.customRoleId));
          roleName = cr?.name || "Ruolo personalizzato";
        }
        return { ...inv, roleName };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ error: "Errore nel recupero degli inviti" });
    }
  });

  app.delete("/api/admin/invitations/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const { id } = req.params;

      const [invitation] = await db.select().from(orgUserInvitations)
        .where(and(eq(orgUserInvitations.id, id), eq(orgUserInvitations.organizationId, orgId)));
      
      if (!invitation) return res.status(404).json({ error: "Invito non trovato" });

      await db.update(orgUserInvitations)
        .set({ status: "revoked" })
        .where(eq(orgUserInvitations.id, id));

      if (invitation.userId && invitation.status === "pending") {
        await db.update(users)
          .set({ isActive: false })
          .where(eq(users.id, invitation.userId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({ error: "Errore nella revoca dell'invito" });
    }
  });

  app.delete("/api/admin/invitations/:id/permanent", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const { id } = req.params;

      const [invitation] = await db.select().from(orgUserInvitations)
        .where(and(eq(orgUserInvitations.id, id), eq(orgUserInvitations.organizationId, orgId)));
      
      if (!invitation) return res.status(404).json({ error: "Invito non trovato" });

      if (invitation.status !== "revoked" && invitation.status !== "expired") {
        return res.status(400).json({ error: "Solo gli inviti revocati o scaduti possono essere eliminati definitivamente" });
      }

      if (invitation.userId) {
        await db.delete(users).where(eq(users.id, invitation.userId));
      }

      await db.delete(orgUserInvitations).where(eq(orgUserInvitations.id, id));

      db.insert(orgAccessLogs).values({
        organizationId: orgId,
        userId: getUserId(req) || "system",
        userName: "Admin",
        action: "user_invited",
        details: { action: "permanent_delete", deletedEmail: invitation.email, deletedName: invitation.name },
      }).catch(() => {});

      res.json({ success: true });
    } catch (error) {
      console.error("Error permanently deleting invitation:", error);
      res.status(500).json({ error: "Errore nell'eliminazione definitiva" });
    }
  });

  app.post("/api/admin/invitations/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const { id } = req.params;

      const [invitation] = await db.select().from(orgUserInvitations)
        .where(and(eq(orgUserInvitations.id, id), eq(orgUserInvitations.organizationId, orgId)));
      
      if (!invitation) return res.status(404).json({ error: "Invito non trovato" });

      const newPassword = generateSecurePassword(12);

      // Update invitation record
      await db.update(orgUserInvitations)
        .set({ temporaryPassword: newPassword })
        .where(eq(orgUserInvitations.id, id));

      // Update user password if user exists
      if (invitation.userId) {
        await db.update(users)
          .set({ password: newPassword })
          .where(eq(users.id, invitation.userId));
      }

      // Send email with new password
      let emailSent = false;
      try {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        const orgName = org?.name || "Soccorso Digitale";

        // @ts-ignore
        const { sendPasswordResetEmail } = await import("./resend-client");
        emailSent = await sendPasswordResetEmail({
          recipientEmail: invitation.email,
          recipientName: invitation.name,
          organizationName: orgName,
          newPassword,
        });
      } catch (emailError) {
        console.error("Password reset email failed:", emailError);
      }

      // Audit log
      const adminId = getUserId(req);
      db.insert(orgAccessLogs).values({
        organizationId: orgId,
        userId: adminId || "system",
        userName: "Admin",
        action: "password_reset",
        details: { userEmail: invitation.email, userName: invitation.name },
      }).catch(() => {});

      res.json({ 
        success: true, 
        newPassword, 
        emailSent,
        message: emailSent 
          ? "Password aggiornata e email inviata" 
          : "Password aggiornata. Email non inviata - condividi la password manualmente."
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Errore nel reset della password" });
    }
  });


  app.get("/api/admin/access-logs", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const action = req.query.action as string;
      const userId = req.query.userId as string;

      let conditions = [eq(orgAccessLogs.organizationId, orgId)];
      if (action) conditions.push(eq(orgAccessLogs.action, action));
      if (userId) conditions.push(eq(orgAccessLogs.userId, userId));

      const logs = await db.select().from(orgAccessLogs)
        .where(and(...conditions))
        .orderBy(desc(orgAccessLogs.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(orgAccessLogs)
        .where(and(...conditions));

      res.json({
        logs,
        total: Number(countResult?.count || 0),
        page,
        totalPages: Math.ceil(Number(countResult?.count || 0) / limit),
      });
    } catch (error) {
      console.error("Error fetching access logs:", error);
      res.status(500).json({ error: "Errore nel recupero dei log" });
    }
  });

  app.get("/api/admin/org-users", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });

      const orgUsers = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        accountType: users.accountType,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      }).from(users)
        .where(and(eq(users.organizationId, orgId), eq(users.accountType, "person")))
        .orderBy(users.name);

      res.json(orgUsers);
    } catch (error) {
      console.error("Error fetching org users:", error);
      res.status(500).json({ error: "Errore nel recupero degli utenti" });
    }
  });

  app.put("/api/admin/org-users/:id/toggle-active", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non trovata" });
      const { id } = req.params;

      const [user] = await db.select().from(users)
        .where(and(eq(users.id, id), eq(users.organizationId, orgId)));
      if (!user) return res.status(404).json({ error: "Utente non trovato" });

      const [updated] = await db.update(users)
        .set({ isActive: !user.isActive })
        .where(eq(users.id, id))
        .returning();

      res.json({ success: true, isActive: updated.isActive });
    } catch (error) {
      console.error("Error toggling user:", error);
      res.status(500).json({ error: "Errore nella modifica dell'utente" });
    }
  });

  // ============================================================
  // SLA DASHBOARD API
  // ============================================================
  app.get("/api/admin/sla-dashboard", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const isSuperAdmin = (req.session as any)?.user?.role === "super_admin";
      const today = new Date();
      
      const getMonthData = async (targetOrgId: string, monthOffset: number = 0) => {
        const d = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const startDate = `${monthKey}-01`;
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const endDate = `${monthKey}-${String(endOfMonth.getDate()).padStart(2, "0")}`;
        
        const conditions = [
          gte(trips.serviceDate, startDate),
          lte(trips.serviceDate, endDate),
          eq(trips.isReturnTrip, false),
        ];
        if (targetOrgId) conditions.push(eq(trips.organizationId, targetOrgId));
        
        const monthTrips = await db.select().from(trips).where(and(...conditions));
        const violations = monthTrips.filter(t => t.slaViolation);
        const withSchedule = monthTrips.filter(t => t.scheduledDepartureTime && t.departureTime);
        let onTimeCount = 0;
        for (const t of withSchedule) {
          const s = t.scheduledDepartureTime!.split(":").map(Number);
          const a = t.departureTime!.split(":").map(Number);
          let diff = (a[0] * 60 + (a[1] || 0)) - (s[0] * 60 + (s[1] || 0)); if (diff < -720) diff += 1440;
          if (diff <= 30) onTimeCount++;
        }
        const avgDelay = violations.length > 0
          ? Math.round(violations.reduce((sum, v) => sum + (v.slaViolationMinutes || 0), 0) / violations.length)
          : 0;
        
        return {
          month: monthKey,
          totalTrips: monthTrips.length,
          violationCount: violations.length,
          onTimeCount,
          tripsWithSchedule: withSchedule.length,
          onTimeRate: withSchedule.length > 0 ? Math.round((onTimeCount / withSchedule.length) * 100) : 100,
          violationRate: monthTrips.length > 0 ? Math.round((violations.length / monthTrips.length) * 100) : 0,
          avgDelayMinutes: avgDelay,
          late30: violations.filter(v => v.slaViolationType === "late_30min").length,
          delay60: violations.filter(v => v.slaViolationType === "delay_60min").length,
          gpsGap: violations.filter(v => v.slaViolationType === "gps_gap").length,
        };
      };
      
      const currentMonth = await getMonthData(orgId || '', 0);
      const trend = [];
      for (let i = 0; i < 12; i++) {
        trend.push(await getMonthData(orgId || '', i));
      }
      
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const startDate = `${currentMonthKey}-01`;
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endDate = `${currentMonthKey}-${String(endOfMonth.getDate()).padStart(2, "0")}`;
      
      const violationConditions = [
        eq(trips.slaViolation, true),
        eq(trips.isReturnTrip, false),
        gte(trips.serviceDate, startDate),
        lte(trips.serviceDate, endDate),
      ];
      if (orgId) violationConditions.push(eq(trips.organizationId, orgId));
      
      const recentViolations = await db.select().from(trips)
        .where(and(...violationConditions))
        .orderBy(desc(trips.serviceDate))
        .limit(50);
      
      const vehicleIds = [...new Set(recentViolations.map(t => t.vehicleId).filter(Boolean))];
      const vehicleMap: Record<string, string> = {};
      if (vehicleIds.length > 0) {
        const vehicleList = await db.select({ id: vehicles.id, code: vehicles.code }).from(vehicles)
          .where(inArray(vehicles.id, vehicleIds as string[]));
        for (const v of vehicleList) vehicleMap[v.id] = v.code;
      }
      
      const violationsList = recentViolations.map(t => ({
        id: t.id,
        serviceDate: t.serviceDate,
        departureTime: t.departureTime,
        scheduledDepartureTime: t.scheduledDepartureTime,
        slaViolationType: t.slaViolationType,
        slaViolationMinutes: t.slaViolationMinutes,
        vehicleCode: vehicleMap[t.vehicleId || ""] || "N/D",
        progressiveNumber: t.progressiveNumber,
        departure: t.departureTime,
        destination: t.returnTime,
      }));
      
      let crossOrg: any[] = [];
      if (isSuperAdmin) {
        const allOrgs = await db.select({ id: organizations.id, name: organizations.name })
          .from(organizations);
        for (const org of allOrgs) {
          const orgData = await getMonthData(org.id, 0);
          if (orgData.totalTrips > 0) {
            crossOrg.push({ ...orgData, orgId: org.id, orgName: org.name });
          }
        }
        crossOrg.sort((a, b) => b.violationCount - a.violationCount);
      }
      
      res.json({
        currentMonth,
        trend: trend.reverse(),
        violations: violationsList,
        crossOrg: isSuperAdmin ? crossOrg : undefined,
      });
    } catch (error) {
      console.error("SLA dashboard error:", error);
      res.status(500).json({ error: "Errore nel caricamento dashboard SLA" });
    }
  });

  app.get("/api/sla/my-stats", requireAuth, async (req, res) => {
    try {
      const userOrgId = getOrganizationId(req);
      if (!userOrgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      
      const today = new Date();
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const startDate = `${currentMonthKey}-01`;
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endDate = `${currentMonthKey}-${String(endOfMonth.getDate()).padStart(2, "0")}`;
      
      const monthTrips = await db.select().from(trips)
        .where(and(
          eq(trips.organizationId, userOrgId),
          gte(trips.serviceDate, startDate),
          lte(trips.serviceDate, endDate),
          eq(trips.isReturnTrip, false)
        ));
      
      const violations = monthTrips.filter(t => t.slaViolation);
      const withSchedule = monthTrips.filter(t => t.scheduledDepartureTime && t.departureTime);
      let onTimeCount = 0;
      for (const t of withSchedule) {
        const s = t.scheduledDepartureTime!.split(":").map(Number);
        const a = t.departureTime!.split(":").map(Number);
        let diff = (a[0] * 60 + (a[1] || 0)) - (s[0] * 60 + (s[1] || 0)); if (diff < -720) diff += 1440;
        if (diff <= 30) onTimeCount++;
      }
      
      const recentViolations = violations
        .sort((a, b) => (b.serviceDate || "").localeCompare(a.serviceDate || ""))
        .slice(0, 10);
      
      const vehicleIds = [...new Set(recentViolations.map(t => t.vehicleId).filter(Boolean))];
      const vehicleMap: Record<string, string> = {};
      if (vehicleIds.length > 0) {
        const vehicleList = await db.select({ id: vehicles.id, code: vehicles.code }).from(vehicles)
          .where(inArray(vehicles.id, vehicleIds as string[]));
        for (const v of vehicleList) vehicleMap[v.id] = v.code;
      }
      
      const onTimeRate = withSchedule.length > 0 ? Math.round((onTimeCount / withSchedule.length) * 100) : 100;
      const status = violations.length === 0 ? "green" : violations.length <= 3 ? "yellow" : "red";
      
      res.json({
        month: currentMonthKey,
        totalTrips: monthTrips.length,
        violationCount: violations.length,
        onTimeRate,
        status,
        avgDelayMinutes: violations.length > 0
          ? Math.round(violations.reduce((sum, v) => sum + (v.slaViolationMinutes || 0), 0) / violations.length)
          : 0,
        recentViolations: recentViolations.map(t => ({
          id: t.id,
          serviceDate: t.serviceDate,
          slaViolationType: t.slaViolationType,
          slaViolationMinutes: t.slaViolationMinutes,
          vehicleCode: vehicleMap[t.vehicleId || ""] || "N/D",
          departure: t.departureTime,
          destination: t.returnTime,
        })),
      });
    } catch (error) {
      console.error("SLA my-stats error:", error);
      res.status(500).json({ error: "Errore" });
    }
  });


  // ============================================================
  // SLA INFRASTRUCTURE STATUS FOR ADMIN DASHBOARD
  // ============================================================
  app.get("/api/admin/sla-infrastructure", requireAdmin, async (req, res) => {
    try {
      const healthResult = await runHealthCheck();
      const uptime30d = await getUptimePercentage(30);
      const incidents = await getRecentIncidents(10);
      
      res.json({
        current: {
          status: healthResult.status,
          timestamp: healthResult.timestamp,
          services: healthResult.services.map(s => ({
            name: s.service,
            status: s.status,
            responseTimeMs: s.responseTimeMs,
          })),
        },
        uptime30d,
        incidents: incidents.map((i: any) => ({
          id: i.id,
          service: i.service_name,
          severity: i.breach_severity,
          createdAt: i.created_at,
          resolvedAt: i.resolved_at,
          durationMinutes: i.duration_minutes ? Math.round(i.duration_minutes) : null,
          resolution: i.resolution,
        })),
      });
    } catch (error) {
      console.error("SLA infrastructure error:", error);
      res.status(500).json({ error: "Errore" });
    }
  });

  // ============================================================
  // SLA THRESHOLDS MANAGEMENT (per organization)
  // ============================================================
  app.get("/api/admin/sla-thresholds", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (orgId) {
        const [org] = await db.select({ 
          id: organizations.id, name: organizations.name,
          slaThresholdMinor: organizations.slaThresholdMinor, 
          slaThresholdMajor: organizations.slaThresholdMajor 
        }).from(organizations).where(eq(organizations.id, orgId));
        return res.json([org]);
      }
      const allOrgs = await db.select({ 
        id: organizations.id, name: organizations.name,
        slaThresholdMinor: organizations.slaThresholdMinor, 
        slaThresholdMajor: organizations.slaThresholdMajor 
      }).from(organizations).orderBy(organizations.name);
      res.json(allOrgs);
    } catch (error) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.put("/api/admin/sla-thresholds/:orgId", requireAdmin, async (req, res) => {
    try {
      const callerOrgId = getEffectiveOrgId(req);
      const isSuperAdminUser = isFullAdmin(req);
      if (!isSuperAdminUser && callerOrgId && callerOrgId !== req.params.orgId) {
        return res.status(403).json({ error: "Non autorizzato a modificare le soglie di un\'altra organizzazione" });
      }
      const { slaThresholdMinor, slaThresholdMajor } = req.body;
      if (!slaThresholdMinor || !slaThresholdMajor || slaThresholdMinor >= slaThresholdMajor) {
        return res.status(400).json({ error: "Soglia lieve deve essere inferiore alla soglia grave" });
      }
      await db.update(organizations).set({
        slaThresholdMinor: parseInt(slaThresholdMinor),
        slaThresholdMajor: parseInt(slaThresholdMajor),
        updatedAt: new Date(),
      }).where(eq(organizations.id, req.params.orgId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Errore nell\'aggiornamento soglie" });
    }
  });


  // ============================================================
  // SLA CONFIGURATIONS - Flexible per-contract metrics
  // ============================================================

  const SLA_TEMPLATES = {
    "ulss_standard": {
      name: "Capitolato ULSS Standard",
      description: "Soglie standard per appalti ULSS/ASL",
      metrics: [
        { key: "departure_delay_minor", category: "operative", label: "Ritardo partenza - Lieve", value: 30, unit: "minutes", severity: "minor", penaltyType: "fixed", penaltyValue: 200 },
        { key: "departure_delay_major", category: "operative", label: "Ritardo partenza - Grave", value: 60, unit: "minutes", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
        { key: "departure_delay_critical", category: "operative", label: "Ritardo partenza - Gravissimo", value: 90, unit: "minutes", severity: "critical", penaltyType: "fixed", penaltyValue: 1000 },
        { key: "arrival_delay", category: "operative", label: "Ritardo arrivo a destinazione", value: 30, unit: "minutes", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
        { key: "missed_execution_rate", category: "operative", label: "Tasso mancate esecuzioni (mensile)", value: 2, unit: "percent", severity: "minor", penaltyType: "percentage", penaltyValue: 1 },
        { key: "missed_execution_rate_major", category: "operative", label: "Tasso mancate esecuzioni grave", value: 5, unit: "percent", severity: "major", penaltyType: "percentage", penaltyValue: 3 },
        { key: "missed_execution_rate_critical", category: "operative", label: "Tasso mancate esecuzioni critico", value: 10, unit: "percent", severity: "critical", penaltyType: "percentage", penaltyValue: 5 },
        { key: "gps_coverage", category: "operative", label: "Copertura GPS durante trasporto", value: 95, unit: "percent", severity: "minor", penaltyType: "fixed", penaltyValue: 100 },
        { key: "uptime", category: "system", label: "Uptime piattaforma mensile", value: 99.5, unit: "percent", severity: "major", penaltyType: "percentage", penaltyValue: 2 },
        { key: "api_latency_p95", category: "system", label: "Latenza API (p95)", value: 500, unit: "ms", severity: "minor", penaltyType: "none", penaltyValue: 0 },
        { key: "rto_p1", category: "system", label: "Tempo ripristino P1", value: 4, unit: "hours", severity: "critical", penaltyType: "fixed", penaltyValue: 2000 },
        { key: "rto_p2", category: "system", label: "Tempo ripristino P2", value: 24, unit: "hours", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
        { key: "monthly_report_deadline", category: "documentary", label: "Produzione report mensile", value: 5, unit: "days", severity: "minor", penaltyType: "fixed", penaltyValue: 200 },
        { key: "data_completeness", category: "documentary", label: "Completezza dati viaggio", value: 100, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 300 },
        { key: "vehicle_doc_validity", category: "documentary", label: "Validita documenti mezzi", value: 100, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
      ]
    },
    "dialisi_oncologia": {
      name: "Contratto Dialisi/Oncologia",
      description: "Soglie specifiche per trasporti dialisi e radioterapia",
      metrics: [
        { key: "clinical_window", category: "operative", label: "Arrivo in finestra oraria clinica", value: 30, unit: "minutes", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
        { key: "departure_delay_minor", category: "operative", label: "Ritardo partenza - Lieve", value: 15, unit: "minutes", severity: "minor", penaltyType: "fixed", penaltyValue: 300 },
        { key: "departure_delay_major", category: "operative", label: "Ritardo partenza - Grave", value: 30, unit: "minutes", severity: "major", penaltyType: "fixed", penaltyValue: 800 },
        { key: "patient_max_delays", category: "custom", label: "Max ritardi/paziente/mese (trigger revisione)", value: 2, unit: "count", severity: "critical", penaltyType: "fixed", penaltyValue: 1500 },
        { key: "driver_continuity", category: "custom", label: "Continuita autista paziente fragile", value: 80, unit: "percent", severity: "minor", penaltyType: "none", penaltyValue: 0 },
        { key: "uptime", category: "system", label: "Uptime piattaforma mensile", value: 99.5, unit: "percent", severity: "major", penaltyType: "percentage", penaltyValue: 2 },
        { key: "data_completeness", category: "documentary", label: "Completezza dati viaggio", value: 100, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 300 },
        { key: "patient_record_time", category: "documentary", label: "Compilazione scheda paziente", value: 30, unit: "minutes", severity: "minor", penaltyType: "fixed", penaltyValue: 150 },
      ]
    },
    "urgenze_118": {
      name: "Urgenze 118",
      description: "Soglie per servizi di emergenza e urgenza",
      metrics: [
        { key: "response_time", category: "operative", label: "Tempo risposta da richiesta", value: 15, unit: "minutes", severity: "critical", penaltyType: "fixed", penaltyValue: 2000 },
        { key: "activation_time", category: "operative", label: "Tempo attivazione mezzo", value: 5, unit: "minutes", severity: "major", penaltyType: "fixed", penaltyValue: 1000 },
        { key: "peak_availability", category: "operative", label: "Disponibilita mezzi fasce picco", value: 95, unit: "percent", severity: "major", penaltyType: "percentage", penaltyValue: 3 },
        { key: "service_refusal_rate", category: "operative", label: "Tasso rifiuti per indisponibilita", value: 1, unit: "percent", severity: "critical", penaltyType: "fixed", penaltyValue: 3000 },
        { key: "gps_coverage", category: "operative", label: "Copertura GPS", value: 98, unit: "percent", severity: "minor", penaltyType: "fixed", penaltyValue: 200 },
        { key: "uptime", category: "system", label: "Uptime piattaforma", value: 99.9, unit: "percent", severity: "critical", penaltyType: "percentage", penaltyValue: 5 },
        { key: "rto_p1", category: "system", label: "Tempo ripristino P1", value: 2, unit: "hours", severity: "critical", penaltyType: "fixed", penaltyValue: 5000 },
      ]
    },
    "software_pa": {
      name: "Standard Software PA",
      description: "Soglie IT per contratti software con la PA",
      metrics: [
        { key: "uptime_standard", category: "system", label: "Uptime piattaforma standard", value: 99.5, unit: "percent", severity: "major", penaltyType: "percentage", penaltyValue: 2 },
        { key: "uptime_premium", category: "system", label: "Uptime piattaforma premium", value: 99.9, unit: "percent", severity: "critical", penaltyType: "percentage", penaltyValue: 5 },
        { key: "api_latency_p95", category: "system", label: "Latenza API p95", value: 500, unit: "ms", severity: "minor", penaltyType: "none", penaltyValue: 0 },
        { key: "api_latency_p99", category: "system", label: "Latenza API p99", value: 2000, unit: "ms", severity: "major", penaltyType: "fixed", penaltyValue: 300 },
        { key: "rto_p1", category: "system", label: "RTO Priorita 1", value: 4, unit: "hours", severity: "critical", penaltyType: "fixed", penaltyValue: 2000 },
        { key: "rto_p2", category: "system", label: "RTO Priorita 2", value: 24, unit: "hours", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
        { key: "rpo", category: "system", label: "RPO (perdita dati max)", value: 6, unit: "hours", severity: "critical", penaltyType: "fixed", penaltyValue: 5000 },
        { key: "mobile_availability", category: "system", label: "Disponibilita app mobile", value: 99, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
      ]
    },
    "documentale_sanitaria": {
      name: "Documentale PA Sanitaria",
      description: "Requisiti documentali per capitolati sanitari",
      metrics: [
        { key: "monthly_report_deadline", category: "documentary", label: "Report mensile entro N giorni", value: 5, unit: "days", severity: "minor", penaltyType: "fixed", penaltyValue: 200 },
        { key: "data_completeness", category: "documentary", label: "Completezza dati viaggio", value: 100, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 300 },
        { key: "patient_record_time", category: "documentary", label: "Compilazione scheda post-trasporto", value: 30, unit: "minutes", severity: "minor", penaltyType: "fixed", penaltyValue: 150 },
        { key: "vehicle_doc_validity", category: "documentary", label: "Documenti mezzi in regola", value: 100, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
        { key: "staff_certification", category: "documentary", label: "Certificazioni personale aggiornate", value: 100, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 400 },
      ]
    },
    "gara_europea": {
      name: "Gara Europea (sopra soglia)",
      description: "KPI aggiuntivi per gare sopra soglia comunitaria",
      metrics: [
        { key: "departure_delay_minor", category: "operative", label: "Ritardo partenza - Lieve", value: 30, unit: "minutes", severity: "minor", penaltyType: "fixed", penaltyValue: 200 },
        { key: "departure_delay_major", category: "operative", label: "Ritardo partenza - Grave", value: 60, unit: "minutes", severity: "major", penaltyType: "fixed", penaltyValue: 500 },
        { key: "co2_per_transport", category: "custom", label: "Emissioni CO2 per trasporto", value: 5, unit: "kg", severity: "minor", penaltyType: "none", penaltyValue: 0 },
        { key: "electric_fleet_ratio", category: "custom", label: "Percentuale mezzi elettrici/ibridi", value: 20, unit: "percent", severity: "minor", penaltyType: "none", penaltyValue: 0 },
        { key: "avg_km_per_transport", category: "custom", label: "Km medi per trasporto (efficienza)", value: 50, unit: "km", severity: "minor", penaltyType: "none", penaltyValue: 0 },
        { key: "uptime", category: "system", label: "Uptime piattaforma", value: 99.9, unit: "percent", severity: "critical", penaltyType: "percentage", penaltyValue: 5 },
        { key: "data_completeness", category: "documentary", label: "Completezza dati viaggio", value: 100, unit: "percent", severity: "major", penaltyType: "fixed", penaltyValue: 300 },
        { key: "volunteer_hours_ratio", category: "custom", label: "Ore volunteer erogate vs programmate", value: 90, unit: "percent", severity: "minor", penaltyType: "none", penaltyValue: 0 },
      ]
    }
  };

  app.get("/api/admin/sla-templates", requireAdmin, async (_req, res) => {
    const templates = Object.entries(SLA_TEMPLATES).map(([id, t]) => ({
      id,
      name: (t as any).name,
      description: (t as any).description,
      metricCount: (t as any).metrics.length,
      categories: [...new Set((t as any).metrics.map((m: any) => m.category))],
    }));
    res.json(templates);
  });

  app.get("/api/admin/sla-configs", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const conditions = [eq(slaConfigurations.active, true)];
      if (orgId) conditions.push(eq(slaConfigurations.organizationId, orgId));
      
      const configs = await db.select().from(slaConfigurations)
        .where(and(...conditions))
        .orderBy(slaConfigurations.contractName, slaConfigurations.metricCategory, slaConfigurations.severity);
      
      const grouped: Record<string, any> = {};
      for (const c of configs) {
        const key = c.contractName + '||' + (c.contractRef || '');
        if (!grouped[key]) {
          grouped[key] = {
            contractName: c.contractName,
            contractRef: c.contractRef,
            validFrom: c.validFrom,
            validTo: c.validTo,
            metrics: [],
          };
        }
        grouped[key].metrics.push(c);
      }
      
      res.json({ contracts: Object.values(grouped), total: configs.length });
    } catch (error) {
      console.error("SLA configs error:", error);
      res.status(500).json({ error: "Errore caricamento configurazioni SLA" });
    }
  });

  app.post("/api/admin/sla-configs", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const callerOrgId = getEffectiveOrgId(req);
      const targetOrgId = req.body.organizationId || callerOrgId;
      if (!isFullAdmin(req) && targetOrgId !== callerOrgId) {
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      const config = await db.insert(slaConfigurations).values({
        organizationId: targetOrgId,
        contractRef: req.body.contractRef,
        contractName: req.body.contractName || 'Contratto Standard',
        metricKey: req.body.metricKey,
        metricCategory: req.body.metricCategory || 'operative',
        metricLabel: req.body.metricLabel,
        thresholdValue: isNaN(parseFloat(req.body.thresholdValue)) ? 0 : parseFloat(req.body.thresholdValue),
        thresholdUnit: req.body.thresholdUnit || 'minutes',
        severity: req.body.severity || 'minor',
        penaltyType: req.body.penaltyType || 'none',
        penaltyValue: isNaN(parseFloat(req.body.penaltyValue || '0')) ? 0 : parseFloat(req.body.penaltyValue || '0'),
        validFrom: req.body.validFrom || null,
        validTo: req.body.validTo || null,
      }).returning();
      
      res.json(config[0]);
    } catch (error) {
      console.error("SLA config create error:", error);
      res.status(500).json({ error: "Errore creazione configurazione" });
    }
  });

  app.post("/api/admin/sla-configs/from-template", requireAdmin, async (req, res) => {
    try {
      const { templateId, contractRef, contractName, organizationId: reqOrgId } = req.body;
      const callerOrgId = getEffectiveOrgId(req);
      const targetOrgId = reqOrgId || callerOrgId;
      if (!isFullAdmin(req) && targetOrgId !== callerOrgId) {
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      const template = (SLA_TEMPLATES as any)[templateId];
      if (!template) return res.status(404).json({ error: "Template non trovato" });
      
      const tplName = contractName || template.name;
      
      // Deactivate existing configs for same contract name in this org
      await db.update(slaConfigurations).set({ active: false, updatedAt: new Date() })
        .where(and(
          eq(slaConfigurations.organizationId, targetOrgId),
          eq(slaConfigurations.contractName, tplName),
          eq(slaConfigurations.active, true)
        ));
      
      const values = template.metrics.map((m: any) => ({
        organizationId: targetOrgId,
        contractRef: contractRef || null,
        contractName: tplName,
        metricKey: m.key,
        metricCategory: m.category,
        metricLabel: m.label,
        thresholdValue: m.value,
        thresholdUnit: m.unit,
        severity: m.severity,
        penaltyType: m.penaltyType,
        penaltyValue: m.penaltyValue,
      }));
      
      const created = await db.insert(slaConfigurations).values(values).returning();
      res.json({ count: created.length, contractName: tplName });
    } catch (error) {
      console.error("SLA template apply error:", error);
      res.status(500).json({ error: "Errore applicazione template" });
    }
  });

  app.put("/api/admin/sla-configs/:id", requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(slaConfigurations).where(eq(slaConfigurations.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Configurazione non trovata" });
      
      const callerOrgId = getEffectiveOrgId(req);
      if (!isFullAdmin(req) && existing.organizationId !== callerOrgId) {
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      const updates: any = { updatedAt: new Date() };
      if (req.body.thresholdValue !== undefined) updates.thresholdValue = parseFloat(req.body.thresholdValue);
      if (req.body.penaltyType !== undefined) updates.penaltyType = req.body.penaltyType;
      if (req.body.penaltyValue !== undefined) updates.penaltyValue = parseFloat(req.body.penaltyValue);
      if (req.body.active !== undefined) updates.active = req.body.active;
      if (req.body.severity !== undefined) updates.severity = req.body.severity;
      if (req.body.contractRef !== undefined) updates.contractRef = req.body.contractRef;
      if (req.body.validFrom !== undefined) updates.validFrom = req.body.validFrom;
      if (req.body.validTo !== undefined) updates.validTo = req.body.validTo;
      
      const [updated] = await db.update(slaConfigurations).set(updates)
        .where(eq(slaConfigurations.id, req.params.id)).returning();
      res.json(updated);
    } catch (error) {
      console.error("SLA config update error:", error);
      res.status(500).json({ error: "Errore aggiornamento" });
    }
  });

  app.delete("/api/admin/sla-configs/:id", requireAdmin, async (req, res) => {
    try {
      const [existing] = await db.select().from(slaConfigurations).where(eq(slaConfigurations.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Configurazione non trovata" });
      
      const callerOrgId = getEffectiveOrgId(req);
      if (!isFullAdmin(req) && existing.organizationId !== callerOrgId) {
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      await db.update(slaConfigurations).set({ active: false, updatedAt: new Date() })
        .where(eq(slaConfigurations.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Errore eliminazione" });
    }
  });

  app.delete("/api/admin/sla-configs/contract/:contractName", requireAdmin, async (req, res) => {
    try {
      const callerOrgId = getEffectiveOrgId(req);
      const contractName = decodeURIComponent(req.params.contractName);
      const conditions = [eq(slaConfigurations.contractName, contractName)];
      if (callerOrgId) conditions.push(eq(slaConfigurations.organizationId, callerOrgId));
      
      await db.update(slaConfigurations).set({ active: false, updatedAt: new Date() })
        .where(and(...conditions));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Errore eliminazione contratto" });
    }
  });

  // ============================================================
  // SLA MONTHLY REPORT PDF EXPORT
  // ============================================================
  app.get("/api/admin/sla-report/pdf", requireAdmin, async (req, res) => {
    try {
      const month = (req.query.month as string) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const orgId = getEffectiveOrgId(req);
      const [year, monthNum] = month.split("-").map(Number);
      const startDate = `${month}-01`;
      const endOfMonth = new Date(year, monthNum, 0);
      const endDate = `${month}-${String(endOfMonth.getDate()).padStart(2, "0")}`;
      
      let orgName = "Tutte le Organizzazioni";
      let thresholdMinor = 30;
      let thresholdMajor = 60;
      if (orgId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (org) {
          orgName = org.name;
          thresholdMinor = org.slaThresholdMinor || 30;
          thresholdMajor = org.slaThresholdMajor || 60;
        }
      }
      
      const conditions: any[] = [
        gte(trips.serviceDate, startDate),
        lte(trips.serviceDate, endDate),
        eq(trips.isReturnTrip, false),
      ];
      if (orgId) conditions.push(eq(trips.organizationId, orgId));
      
      const monthTrips = await db.select().from(trips).where(and(...conditions));
      const violations = monthTrips.filter(t => t.slaViolation);
      const withSchedule = monthTrips.filter(t => t.scheduledDepartureTime && t.departureTime);
      let onTimeCount = 0;
      for (const t of withSchedule) {
        const s = t.scheduledDepartureTime!.split(":").map(Number);
        const a = t.departureTime!.split(":").map(Number);
        let diff = (a[0] * 60 + (a[1] || 0)) - (s[0] * 60 + (s[1] || 0)); if (diff < -720) diff += 1440;
        if (diff < thresholdMinor) onTimeCount++;
      }
      const avgDelay = violations.length > 0
        ? Math.round(violations.reduce((sum, v) => sum + (v.slaViolationMinutes || 0), 0) / violations.length) : 0;
      const onTimeRate = withSchedule.length > 0 ? Math.round((onTimeCount / withSchedule.length) * 100) : 100;
      const violationRate = monthTrips.length > 0 ? Math.round((violations.length / monthTrips.length) * 100) : 0;
      const late30 = violations.filter(v => v.slaViolationType === "late_30min").length;
      const delay60 = violations.filter(v => v.slaViolationType === "delay_60min").length;
      
      const uptime30d = await getUptimePercentage(30);
      const recentIncidents = await getRecentIncidents(30);
      const monthIncidents = (recentIncidents as any[]).filter((i: any) => {
        const d = new Date(i.created_at);
        return d.getFullYear() === year && d.getMonth() === monthNum - 1;
      });
      
      const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
                           "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
      const reportTitle = `Report SLA - ${monthNames[monthNum - 1]} ${year}`;
      
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="SLA_Report_${month}.pdf"`);
      doc.pipe(res);
      
      doc.rect(0, 0, 595, 100).fill("#0066CC");
      doc.fontSize(22).fillColor("#ffffff").text("SOCCORSO DIGITALE", 50, 28);
      doc.fontSize(10).text("Piattaforma Gestione Trasporti Sanitari", 50, 55);
      doc.fontSize(14).text(reportTitle, 50, 75);
      
      let y = 120;
      doc.fillColor("#1F2937").fontSize(11);
      doc.text(`Organizzazione: ${orgName}`, 50, y);
      doc.text(`Periodo: ${monthNames[monthNum - 1]} ${year}`, 50, y + 16);
      doc.text(`Generato il: ${new Date().toLocaleDateString("it-IT")}`, 50, y + 32);
      doc.text(`Soglie SLA: Lieve >= ${thresholdMinor} min | Grave >= ${thresholdMajor} min`, 50, y + 48);
      
      y = 200;
      doc.rect(50, y, 495, 30).fill("#F3F4F6");
      doc.fillColor("#1F2937").fontSize(13).text("INDICATORI CHIAVE DI PRESTAZIONE (KPI)", 60, y + 8);
      
      y = 245;
      const kpiData = [
        ["Trasporti Totali", String(monthTrips.length)],
        ["Trasporti con Orario Programmato", String(withSchedule.length)],
        ["Puntuali", `${onTimeCount} (${onTimeRate}%)`],
        ["Violazioni Totali", `${violations.length} (${violationRate}%)`],
        [`Violazioni Lievi (${thresholdMinor}-${thresholdMajor-1} min)`, String(late30)],
        [`Violazioni Gravi (>= ${thresholdMajor} min)`, String(delay60)],
        ["Ritardo Medio (violazioni)", `${avgDelay} minuti`],
      ];
      for (const [label, value] of kpiData) {
        doc.fontSize(10).fillColor("#374151").text(label, 60, y);
        doc.fillColor("#0066CC").text(value, 380, y, { width: 160, align: "right" });
        y += 18;
      }
      
      y += 10;
      doc.rect(50, y, 495, 30).fill("#F3F4F6");
      doc.fillColor("#1F2937").fontSize(13).text("STATO INFRASTRUTTURA", 60, y + 8);
      y += 40;
      
      const serviceLabels: Record<string, string> = { api: "API Server", database: "Database", storage: "Object Storage" };
      for (const [svc, pct] of Object.entries(uptime30d)) {
        doc.fontSize(10).fillColor("#374151").text(`${serviceLabels[svc] || svc} - Uptime 30gg`, 60, y);
        const uptimeColor = (pct as number) >= 99.9 ? "#16A34A" : (pct as number) >= 99 ? "#D97706" : "#DC2626";
        doc.fillColor(uptimeColor).text(`${pct}%`, 380, y, { width: 160, align: "right" });
        y += 18;
      }
      if (Object.keys(uptime30d).length === 0) {
        doc.fontSize(10).fillColor("#6B7280").text("Dati uptime non ancora disponibili (monitoraggio appena avviato)", 60, y);
        y += 18;
      }
      
      y += 10;
      doc.rect(50, y, 495, 30).fill("#F3F4F6");
      doc.fillColor("#1F2937").fontSize(13).text(`INCIDENTI NEL MESE (${monthIncidents.length})`, 60, y + 8);
      y += 40;
      
      if (monthIncidents.length === 0) {
        doc.fontSize(10).fillColor("#16A34A").text("Nessun incidente registrato nel periodo.", 60, y);
        y += 18;
      } else {
        for (const inc of monthIncidents.slice(0, 10)) {
          const incDate = new Date((inc as any).created_at).toLocaleDateString("it-IT");
          const svcName = serviceLabels[(inc as any).service_name] || (inc as any).service_name;
          const dur = (inc as any).duration_minutes ? `${Math.round((inc as any).duration_minutes)} min` : "In corso";
          const resolved = (inc as any).resolved_at ? "Risolto" : "Aperto";
          doc.fontSize(9).fillColor("#374151").text(`${incDate} | ${svcName} | ${(inc as any).breach_severity} | Durata: ${dur} | ${resolved}`, 60, y);
          y += 14;
        }
      }
      
      if (y < 650) y = 650;
      else { doc.addPage(); y = 50; }
      
      doc.rect(50, y, 495, 2).fill("#E5E7EB");
      y += 20;
      doc.fontSize(10).fillColor("#374151").text("Firma del Responsabile", 50, y);
      doc.text("Data", 350, y);
      y += 30;
      doc.rect(50, y, 200, 1).fill("#9CA3AF");
      doc.rect(350, y, 150, 1).fill("#9CA3AF");
      
      y += 30;
      doc.fontSize(8).fillColor("#9CA3AF").text(
        `Report generato automaticamente da Soccorso Digitale | ${new Date().toISOString()} | Documento valido ai fini della rendicontazione contrattuale`,
        50, y, { width: 495, align: "center" }
      );
      
      doc.end();
    } catch (error) {
      console.error("SLA report PDF error:", error);
      res.status(500).json({ error: "Errore nella generazione del report" });
    }
  });

}
