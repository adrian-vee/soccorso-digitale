import type { Express } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { Resend } from "resend";
import { pool } from "../db";
import { requireSuperAdmin } from "../auth-middleware";

const upload = multer({ storage: multer.memoryStorage() });

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function replaceTplVars(text: string, org: any): string {
  const unsubUrl = `https://soccorsodigitale.app/api/crm/unsubscribe/${org.id}`;
  return text
    .replace(/{{org_name}}/g, org.name || "")
    .replace(/{{city}}/g, org.city || "")
    .replace(/{{region}}/g, org.region || "")
    .replace(/{{unsubscribe_url}}/g, unsubUrl);
}

export function registerCrmRoutes(app: Express) {

  // ── STATS ──────────────────────────────────────────────
  app.get("/api/crm/stats", requireSuperAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'new')          AS new_count,
          COUNT(*) FILTER (WHERE status = 'contacted')    AS contacted_count,
          COUNT(*) FILTER (WHERE status = 'interested')   AS interested_count,
          COUNT(*) FILTER (WHERE status = 'customer')     AS customer_count,
          COUNT(*) FILTER (WHERE email IS NOT NULL)       AS with_email,
          COUNT(*) FILTER (WHERE last_contacted_at > NOW() - INTERVAL '7 days') AS contacted_last_week
        FROM crm_organizations
      `);
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ORGANIZZAZIONI ─────────────────────────────────────

  app.get("/api/crm/organizations", requireSuperAdmin, async (req, res) => {
    try {
      const { search, region, type, status, page = "1", limit = "50" } =
        req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(name ILIKE $${params.length} OR email ILIKE $${params.length} OR city ILIKE $${params.length})`
        );
      }
      if (region && region !== "all") {
        params.push(region);
        conditions.push(`region = $${params.length}`);
      }
      if (type && type !== "all") {
        params.push(type);
        conditions.push(`type = $${params.length}`);
      }
      if (status && status !== "all") {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [dataRes, countRes] = await Promise.all([
        pool.query(
          `SELECT * FROM crm_organizations ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limitNum, offset]
        ),
        pool.query(`SELECT COUNT(*) FROM crm_organizations ${where}`, params),
      ]);

      res.json({
        data: dataRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: pageNum,
        limit: limitNum,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/crm/organizations", requireSuperAdmin, async (req, res) => {
    try {
      const allowed = [
        "name","type","region","province","city","address","email","email_secondary",
        "phone","website","pec","codice_fiscale","source","num_ambulances",
        "num_volunteers","conv_118","notes","status","tags",
      ];
      const fields: Record<string, any> = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) fields[k] = req.body[k];
      }
      const keys = Object.keys(fields);
      if (!fields.name) return res.status(400).json({ error: "name obbligatorio" });

      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO crm_organizations (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        Object.values(fields)
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/crm/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      const allowed = [
        "name","type","region","province","city","address","email","email_secondary",
        "phone","website","pec","codice_fiscale","status","num_ambulances",
        "num_volunteers","conv_118","notes","tags",
      ];
      const fields: Record<string, any> = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) fields[k] = req.body[k];
      }
      const keys = Object.keys(fields);
      if (!keys.length) return res.status(400).json({ error: "Nessun campo da aggiornare" });

      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
      const result = await pool.query(
        `UPDATE crm_organizations SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
        [...Object.values(fields), req.params.id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Non trovata" });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/crm/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM crm_organizations WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── IMPORT CSV / EXCEL ─────────────────────────────────
  app.post(
    "/api/crm/organizations/import",
    requireSuperAdmin,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "File mancante" });

        let records: any[] = [];
        const name = req.file.originalname.toLowerCase();

        if (name.endsWith(".csv")) {
          records = parse(req.file.buffer, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
          const wb = XLSX.read(req.file.buffer, { type: "buffer" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          records = XLSX.utils.sheet_to_json(ws);
        } else {
          return res.status(400).json({ error: "Formato non supportato. Usa .csv o .xlsx" });
        }

        let imported = 0;
        let skipped = 0;

        for (const row of records) {
          const orgName = row.name || row.Name || row.Nome || row.NOME;
          if (!orgName) { skipped++; continue; }

          const email = row.email || row.Email || row.EMAIL || null;

          if (email) {
            const existing = await pool.query(
              "SELECT id FROM crm_organizations WHERE email = $1",
              [email]
            );
            if (existing.rows.length) { skipped++; continue; }
          }

          await pool.query(
            `INSERT INTO crm_organizations
               (name, email, phone, city, region, province, type, website, notes, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'csv_import')
             ON CONFLICT DO NOTHING`,
            [
              orgName,
              email,
              row.phone || row.Phone || row.Telefono || null,
              row.city || row.City || row.Città || row.citta || null,
              row.region || row.Region || row.Regione || null,
              row.province || row.Province || row.Provincia || null,
              row.type || row.Type || row.Tipo || "altro",
              row.website || row.Website || row.Sito || null,
              row.notes || row.Notes || row.Note || null,
            ]
          );
          imported++;
        }

        res.json({ success: true, imported, skipped, total: records.length });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── TEMPLATE ───────────────────────────────────────────

  app.get("/api/crm/templates", requireSuperAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM crm_email_templates WHERE is_active = true ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/crm/templates", requireSuperAdmin, async (req, res) => {
    try {
      const { name, subject, body_html, body_text, category } = req.body;
      if (!name || !subject || !body_html)
        return res.status(400).json({ error: "name, subject e body_html obbligatori" });
      const result = await pool.query(
        `INSERT INTO crm_email_templates (name, subject, body_html, body_text, category)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, subject, body_html, body_text || "", category || "custom"]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── INVIO EMAIL SINGOLA ────────────────────────────────

  app.post("/api/crm/send-single", requireSuperAdmin, async (req, res) => {
    try {
      const { organization_id, template_id, custom_subject, custom_message } = req.body;
      if (!organization_id) return res.status(400).json({ error: "organization_id obbligatorio" });

      const orgRes = await pool.query(
        "SELECT * FROM crm_organizations WHERE id = $1",
        [organization_id]
      );
      if (!orgRes.rows.length) return res.status(404).json({ error: "Organizzazione non trovata" });
      const org = orgRes.rows[0];
      if (!org.email) return res.status(400).json({ error: "Organizzazione senza email" });

      let subject = custom_subject || "";
      let bodyHtml = custom_message || "";

      if (template_id) {
        const tplRes = await pool.query(
          "SELECT * FROM crm_email_templates WHERE id = $1",
          [template_id]
        );
        if (tplRes.rows.length) {
          const tpl = tplRes.rows[0];
          if (!subject) subject = tpl.subject;
          if (!bodyHtml) bodyHtml = tpl.body_html;
        }
      }

      if (!subject || !bodyHtml)
        return res.status(400).json({ error: "subject e body obbligatori" });

      subject = replaceTplVars(subject, org);
      bodyHtml = replaceTplVars(bodyHtml, org);

      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      const { data, error } = await getResend().emails.send({
        from: fromEmail,
        to: org.email,
        subject,
        html: bodyHtml,
      });

      if (error) throw new Error((error as any).message || "Errore Resend");

      await pool.query(
        `INSERT INTO crm_email_logs (organization_id, email_to, status, sent_at)
         VALUES ($1, $2, 'sent', NOW())`,
        [organization_id, org.email]
      );

      await pool.query(
        `UPDATE crm_organizations
         SET last_contacted_at = NOW(),
             status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END,
             updated_at = NOW()
         WHERE id = $1`,
        [organization_id]
      );

      res.json({ success: true, messageId: data?.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UNSUBSCRIBE (pubblico) ─────────────────────────────

  app.get("/api/crm/unsubscribe/:orgId", async (req, res) => {
    try {
      await pool.query(
        `UPDATE crm_organizations SET status = 'not_interested', updated_at = NOW() WHERE id = $1`,
        [req.params.orgId]
      );
      res.send(`<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px;">
        <h2 style="color:#1E3A8A;">Iscrizione cancellata</h2>
        <p style="color:#334155;">Hai rimosso il tuo indirizzo dalla nostra lista.<br>Non riceverai altre comunicazioni.</p>
      </body></html>`);
    } catch {
      res.status(500).send("Errore");
    }
  });
}
