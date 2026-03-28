/**
 * pdf-templates.routes.ts
 *
 * CRUD per i template di mappatura colonne PDF.
 * Ogni organizzazione ha i propri template — isolamento multi-tenant garantito.
 *
 * Endpoints:
 *   GET    /api/pdf-templates           → lista template org
 *   GET    /api/pdf-templates/:id       → dettaglio
 *   POST   /api/pdf-templates           → crea
 *   PUT    /api/pdf-templates/:id       → aggiorna
 *   DELETE /api/pdf-templates/:id       → elimina
 *   POST   /api/pdf-templates/parse-sample   → carica PDF, estrai tabella grezza
 *   POST   /api/pdf-templates/:id/test       → testa template su PDF
 */

import type { Express } from "express";
import multer from "multer";
import { db } from "../db";
import { pdfTemplates } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin, getEffectiveOrgId, getUserId } from "../auth-middleware";
import { parseSampleTable, applyTemplateMapping, SYSTEM_FIELDS, type TemplateConfig } from "../pdf-table-parser";

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf"));
  },
});

// ─── Startup: crea tabella se mancante ───────────────────────────────────────

export async function ensurePdfTemplatesTable() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS pdf_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR NOT NULL,
        name TEXT NOT NULL DEFAULT 'Template Principale',
        column_mapping JSONB NOT NULL DEFAULT '{}',
        skip_header_rows INTEGER DEFAULT 1,
        skip_footer_rows INTEGER DEFAULT 0,
        date_format TEXT DEFAULT 'DD/MM/YYYY',
        time_format TEXT DEFAULT 'HH:mm',
        sample_headers JSONB DEFAULT '[]',
        sample_row JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_by VARCHAR
      );
      CREATE INDEX IF NOT EXISTS idx_pdf_templates_org
        ON pdf_templates(organization_id)
        WHERE is_active = true;
    `);
  } catch (err) {
    console.warn("[pdf-templates] Table setup warning (may already exist):", (err as Error).message);
  }
}

// ─── Helper: verifica ownership ───────────────────────────────────────────────

async function getOwnedTemplate(id: string, orgId: string | null) {
  const where = orgId
    ? and(eq(pdfTemplates.id, id), eq(pdfTemplates.organizationId, orgId))
    : eq(pdfTemplates.id, id);
  const [tpl] = await db.select().from(pdfTemplates).where(where);
  return tpl ?? null;
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerPdfTemplateRoutes(app: Express) {

  // GET /api/pdf-templates — lista template dell'org
  app.get("/api/pdf-templates", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non identificata" });

      const templates = await db.select().from(pdfTemplates)
        .where(eq(pdfTemplates.organizationId, orgId));

      res.json({ templates });
    } catch (err) {
      console.error("[pdf-templates] GET /", err);
      res.status(500).json({ error: "Errore nel recupero template" });
    }
  });

  // GET /api/pdf-templates/fields — lista campi sistema disponibili per il mapping
  app.get("/api/pdf-templates/fields", requireAdmin, (_req, res) => {
    res.json({ fields: SYSTEM_FIELDS });
  });

  // GET /api/pdf-templates/:id — dettaglio
  app.get("/api/pdf-templates/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const tpl = await getOwnedTemplate(req.params.id, orgId);
      if (!tpl) return res.status(404).json({ error: "Template non trovato" });
      res.json({ template: tpl });
    } catch (err) {
      console.error("[pdf-templates] GET /:id", err);
      res.status(500).json({ error: "Errore nel recupero template" });
    }
  });

  // POST /api/pdf-templates — crea nuovo template
  app.post("/api/pdf-templates", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Organizzazione non identificata" });
      const userId = getUserId(req);

      const {
        name = "Template Principale",
        columnMapping = {},
        skipHeaderRows = 1,
        skipFooterRows = 0,
        dateFormat = "DD/MM/YYYY",
        timeFormat = "HH:mm",
        sampleHeaders = [],
        sampleRow = [],
      } = req.body;

      const [created] = await db.insert(pdfTemplates).values({
        organizationId: orgId,
        name,
        columnMapping,
        skipHeaderRows,
        skipFooterRows,
        dateFormat,
        timeFormat,
        sampleHeaders,
        sampleRow,
        createdBy: userId ?? undefined,
      }).returning();

      res.status(201).json({ template: created });
    } catch (err) {
      console.error("[pdf-templates] POST /", err);
      res.status(500).json({ error: "Errore nella creazione template" });
    }
  });

  // PUT /api/pdf-templates/:id — aggiorna
  app.put("/api/pdf-templates/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const existing = await getOwnedTemplate(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Template non trovato" });

      const allowed = [
        "name", "columnMapping", "skipHeaderRows", "skipFooterRows",
        "dateFormat", "timeFormat", "sampleHeaders", "sampleRow", "isActive",
      ] as const;
      const updates: Partial<typeof existing> = { updatedAt: new Date() };
      for (const key of allowed) {
        if (req.body[key] !== undefined) (updates as any)[key] = req.body[key];
      }

      const [updated] = await db.update(pdfTemplates)
        .set(updates)
        .where(eq(pdfTemplates.id, req.params.id))
        .returning();

      res.json({ template: updated });
    } catch (err) {
      console.error("[pdf-templates] PUT /:id", err);
      res.status(500).json({ error: "Errore nell'aggiornamento template" });
    }
  });

  // DELETE /api/pdf-templates/:id — elimina (soft via isActive=false)
  app.delete("/api/pdf-templates/:id", requireAdmin, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req);
      const existing = await getOwnedTemplate(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Template non trovato" });

      await db.update(pdfTemplates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(pdfTemplates.id, req.params.id));

      res.json({ success: true });
    } catch (err) {
      console.error("[pdf-templates] DELETE /:id", err);
      res.status(500).json({ error: "Errore nell'eliminazione template" });
    }
  });

  // POST /api/pdf-templates/parse-sample — carica PDF, estrai tabella grezza
  // Must be before /:id routes to avoid conflict
  app.post("/api/pdf-templates/parse-sample", requireAdmin, pdfUpload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nessun file PDF caricato" });
      }

      const result = await parseSampleTable(req.file.buffer);

      if (result.headers.length === 0) {
        return res.status(422).json({
          error: "Impossibile rilevare una struttura tabellare nel PDF. Verifica che il PDF contenga una tabella con colonne ben definite.",
          rawTextPreview: result.rawText.slice(0, 500),
        });
      }

      res.json({
        success: true,
        headers: result.headers,
        rows: result.rows,
        totalRows: result.totalRows,
      });
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      console.error("[pdf-templates] POST /parse-sample:", msg);
      res.status(500).json({ error: "Errore nel parsing del PDF", detail: msg });
    }
  });

  // POST /api/pdf-templates/:id/test — testa template su un PDF
  app.post("/api/pdf-templates/:id/test", requireAdmin, pdfUpload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nessun file PDF caricato" });
      }

      const orgId = getEffectiveOrgId(req);
      const tpl = await getOwnedTemplate(req.params.id, orgId);
      if (!tpl) return res.status(404).json({ error: "Template non trovato" });

      const { headers, rows, totalRows } = await parseSampleTable(req.file.buffer);

      const config = tpl.columnMapping as TemplateConfig;
      if (!config?.mappings || config.mappings.length === 0) {
        return res.status(422).json({ error: "Il template non ha mappature configurate" });
      }

      const parsed = applyTemplateMapping(rows, config, {
        skipFooterRows: tpl.skipFooterRows ?? 0,
      });

      res.json({
        success: true,
        rawHeaders: headers,
        totalRows,
        parsedRows: parsed.slice(0, 10),
        sampleCount: Math.min(parsed.length, 10),
      });
    } catch (err) {
      console.error("[pdf-templates] POST /:id/test", err);
      res.status(500).json({ error: "Errore nel test del template" });
    }
  });
}
