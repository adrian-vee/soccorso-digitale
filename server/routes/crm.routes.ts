import type { Express } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { Resend } from "resend";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { pool } from "../db";
import { requireSuperAdmin } from "../auth-middleware";
import {
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  getCampaignStatus,
} from "../utils/campaign-queue";
import { runGooglePlacesDiscovery } from "../utils/google-places-discovery";
import { runEmailEnrichment } from "../utils/email-enrichment";

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
    .replace(/{{org_type}}/g, org.type || "")
    .replace(/{{unsubscribe_url}}/g, unsubUrl);
}

function getSmtpKey(): Buffer {
  return Buffer.from(
    process.env.SESSION_SECRET || "soccorsodigitale2026secretkey!!!",
    "utf8"
  ).slice(0, 32);
}

function encryptPassword(password: string): string {
  const key = getSmtpKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptPassword(encrypted: string): string {
  const key = getSmtpKey();
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function registerCrmRoutes(app: Express) {

  // ── TRACKING: Pixel apertura 1×1 GIF ─────────────────────

  app.get("/api/crm/track/open/:pixelId", async (req, res) => {
    try {
      await pool.query(
        `UPDATE crm_email_logs
         SET status = 'opened', opened_at = COALESCE(opened_at, NOW())
         WHERE tracking_pixel_id = $1`,
        [req.params.pixelId]
      );
    } catch { /* non bloccare la risposta */ }

    const gif1x1 = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": gif1x1.length,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    });
    res.end(gif1x1);
  });

  // ── TRACKING: Click redirect ───────────────────────────────

  app.get("/api/crm/track/click/:logId", async (req, res) => {
    const redirectUrl = (req.query.url as string) || "https://soccorsodigitale.app";
    try {
      await pool.query(
        `UPDATE crm_email_logs
         SET status = 'clicked', clicked_at = COALESCE(clicked_at, NOW())
         WHERE id = $1`,
        [req.params.logId]
      );
    } catch { /* non bloccare il redirect */ }
    res.redirect(302, redirectUrl);
  });

  // ── WEBHOOK RESEND ─────────────────────────────────────────

  app.post("/api/crm/webhooks/resend", async (req, res) => {
    try {
      const { type, data } = req.body;
      const messageId = data?.email_id || data?.message_id;

      switch (type) {
        case "email.delivered":
          await pool.query(
            `UPDATE crm_email_logs SET status = 'delivered' WHERE message_id = $1`,
            [messageId]
          );
          break;
        case "email.opened":
          await pool.query(
            `UPDATE crm_email_logs
             SET status = 'opened', opened_at = COALESCE(opened_at, NOW())
             WHERE message_id = $1`,
            [messageId]
          );
          break;
        case "email.clicked":
          await pool.query(
            `UPDATE crm_email_logs
             SET status = 'clicked', clicked_at = COALESCE(clicked_at, NOW())
             WHERE message_id = $1`,
            [messageId]
          );
          break;
        case "email.bounced":
          await pool.query(
            `UPDATE crm_email_logs
             SET status = 'bounced', bounced_at = NOW(), bounce_reason = $2
             WHERE message_id = $1`,
            [messageId, data?.reason || "bounce"]
          );
          await pool.query(
            `UPDATE crm_organizations SET status = 'bounced', updated_at = NOW()
             WHERE email = $1`,
            [data?.to]
          );
          break;
        case "email.complained":
          await pool.query(
            `INSERT INTO crm_unsubscribes (email) VALUES ($1) ON CONFLICT DO NOTHING`,
            [data?.to]
          );
          await pool.query(
            `UPDATE crm_organizations SET status = 'not_interested', updated_at = NOW()
             WHERE email = $1`,
            [data?.to]
          );
          break;
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("CRM Webhook error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── STATS ──────────────────────────────────────────────────

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

  // ── ORGANIZZAZIONI ─────────────────────────────────────────

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

  // Import must be registered BEFORE /:id to avoid route conflict
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

        // Mapping tipologie dal testo libero all'enum DB
        const TYPE_MAP: Record<string, string> = {
          "croce rossa":                    "croce_rossa",
          "cri":                            "croce_rossa",
          "misericordia":                   "misericordia",
          "pubblica assistenza":            "pubblica_assistenza",
          "pubblica assistenza / ipab":     "pubblica_assistenza",
          "volontariato":                   "pubblica_assistenza",
          "ambulanza privata":              "ambulanza_privata",
          "ambulanza":                      "ambulanza_privata",
          "cooperativa sociale":            "cooperativa",
          "cooperativa":                    "cooperativa",
          "impresa sociale / amb. privata": "ambulanza_privata",
          "impresa sociale":                "ambulanza_privata",
        };

        function mapType(raw: string | undefined): string {
          if (!raw) return "altro";
          return TYPE_MAP[raw.trim().toLowerCase()] ?? "altro";
        }

        let imported = 0;
        let skipped = 0;
        const skipReasons: string[] = [];

        for (const row of records) {
          const orgName =
            row["Nome Organizzazione"] ||
            row.name || row.Name || row.Nome || row.NOME ||
            null;

          const email =
            row["Email"] || row.email || row.Email || row.EMAIL || null;

          // Salta solo se mancano ENTRAMBI nome ed email
          if (!orgName && !email) {
            skipped++;
            if (skipReasons.length < 5) {
              skipReasons.push(`Riga ${imported + skipped}: saltata — né nome né email (keys: ${Object.keys(row).join(", ")})`);
            }
            continue;
          }

          if (email) {
            const existing = await pool.query(
              "SELECT id FROM crm_organizations WHERE email = $1",
              [email]
            );
            if (existing.rows.length) {
              skipped++;
              if (skipReasons.length < 5) {
                skipReasons.push(`Riga ${imported + skipped}: saltata — email duplicata: ${email}`);
              }
              continue;
            }
          }

          const rawType =
            row["Tipologia"] || row.type || row.Type || row.Tipo || row.Tipologia || null;

          await pool.query(
            `INSERT INTO crm_organizations
               (name, email, phone, city, region, province, type, website, notes, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'csv_import')
             ON CONFLICT DO NOTHING`,
            [
              orgName || null,
              email,
              row["Telefono"] || row.phone || row.Phone || row.Telefono || null,
              row["Città"] || row.city || row.City || row.Città || row.citta || null,
              row["Regione"] || row.region || row.Region || row.Regione || null,
              row["Provincia"] || row.province || row.Province || row.Provincia || null,
              mapType(rawType),
              row["Sito Web"] || row.website || row.Website || row.Sito || null,
              row["Note"] || row.notes || row.Notes || row.Note || null,
            ]
          );
          imported++;
        }

        res.json({
          success: true,
          imported,
          skipped,
          total: records.length,
          debug: skipReasons,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

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
        `UPDATE crm_organizations SET ${setClause}, updated_at = NOW()
         WHERE id = $${keys.length + 1} RETURNING *`,
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

  // ── TEMPLATE ───────────────────────────────────────────────

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
      const { name, subject, body_html, body_text, category, preview_text } = req.body;
      if (!name || !subject || !body_html)
        return res.status(400).json({ error: "name, subject e body_html obbligatori" });
      const result = await pool.query(
        `INSERT INTO crm_email_templates (name, subject, body_html, body_text, category, preview_text)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, subject, body_html, body_text || "", category || "custom", preview_text || null]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/crm/templates/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { name, subject, body_html, body_text, category, preview_text } = req.body;
      if (!name || !subject || !body_html)
        return res.status(400).json({ error: "name, subject e body_html obbligatori" });
      const result = await pool.query(
        `UPDATE crm_email_templates
         SET name=$1, subject=$2, body_html=$3, body_text=$4, category=$5, preview_text=$6,
             version = COALESCE(version, 1) + 1, updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [name, subject, body_html, body_text || "", category || "custom", preview_text || null, req.params.id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Template non trovato" });
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/crm/templates/:id", requireSuperAdmin, async (req, res) => {
    try {
      // Soft delete
      await pool.query(
        "UPDATE crm_email_templates SET is_active = false WHERE id = $1",
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── INVIO EMAIL SINGOLA (con tracking) ────────────────────

  app.post("/api/crm/send-single", requireSuperAdmin, async (req, res) => {
    try {
      const { organization_id, template_id, custom_subject, custom_message, send_method, smtp_config_id } = req.body;
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

      // Pre-insert log to get ID for click tracking
      const trackingPixelId = crypto.randomUUID();
      const logRes = await pool.query(
        `INSERT INTO crm_email_logs (organization_id, email_to, status, tracking_pixel_id)
         VALUES ($1, $2, 'queued', $3) RETURNING id`,
        [organization_id, org.email, trackingPixelId]
      );
      const logId = logRes.rows[0].id;

      // Inject tracking pixel
      const pixelUrl = `https://soccorsodigitale.app/api/crm/track/open/${trackingPixelId}`;
      if (bodyHtml.includes("</body>")) {
        bodyHtml = bodyHtml.replace(
          "</body>",
          `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt=""></body>`
        );
      } else {
        bodyHtml += `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="">`;
      }

      // Wrap external links for click tracking (skip unsubscribe)
      bodyHtml = bodyHtml.replace(
        /href="(https?:\/\/(?!soccorsodigitale\.app\/api\/crm\/unsubscribe)[^"]+)"/g,
        (_match: string, url: string) => {
          const trackUrl = `https://soccorsodigitale.app/api/crm/track/click/${logId}?url=${encodeURIComponent(url)}`;
          return `href="${trackUrl}"`;
        }
      );

      let messageId: string | null = null;

      if (send_method === "smtp" && smtp_config_id) {
        const smtpRes = await pool.query(
          "SELECT * FROM crm_smtp_configs WHERE id = $1",
          [smtp_config_id]
        );
        if (!smtpRes.rows.length) throw new Error("Config SMTP non trovata");
        const smtp = smtpRes.rows[0];
        const password = decryptPassword(smtp.password_encrypted);

        const transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465,
          auth: { user: smtp.username, pass: password },
        });

        const info = await transporter.sendMail({
          from: `"${smtp.from_name || "Soccorso Digitale"}" <${smtp.from_email}>`,
          to: org.email,
          subject,
          html: bodyHtml,
        });
        messageId = (info as any).messageId || null;
      } else {
        const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
        const { data, error } = await getResend().emails.send({
          from: fromEmail,
          to: org.email,
          subject,
          html: bodyHtml,
        });
        if (error) throw new Error((error as any).message || "Errore Resend");
        messageId = data?.id || null;
      }

      // Update log with sent status and message_id
      await pool.query(
        `UPDATE crm_email_logs SET status = 'sent', sent_at = NOW(), message_id = $1 WHERE id = $2`,
        [messageId, logId]
      );

      await pool.query(
        `UPDATE crm_organizations
         SET last_contacted_at = NOW(),
             status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END,
             updated_at = NOW()
         WHERE id = $1`,
        [organization_id]
      );

      res.json({ success: true, messageId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── SMTP CONFIG ────────────────────────────────────────────

  app.get("/api/crm/smtp", requireSuperAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, host, port, username, from_name, from_email, is_default, daily_limit
         FROM crm_smtp_configs ORDER BY created_at DESC`
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/crm/smtp", requireSuperAdmin, async (req, res) => {
    try {
      const { name, host, port, username, password, from_name, from_email, is_default, daily_limit } = req.body;
      if (!name || !host || !port || !username || !password || !from_email)
        return res.status(400).json({ error: "Tutti i campi SMTP sono obbligatori" });

      const passwordEncrypted = encryptPassword(password);

      if (is_default) {
        await pool.query("UPDATE crm_smtp_configs SET is_default = false");
      }

      const result = await pool.query(
        `INSERT INTO crm_smtp_configs
           (name, host, port, username, password_encrypted, from_name, from_email, is_default, daily_limit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, name, host, port, username, from_name, from_email, is_default, daily_limit`,
        [name, host, parseInt(port), username, passwordEncrypted, from_name || null, from_email, is_default || false, daily_limit || 200]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SMTP test must be before /:id
  app.post("/api/crm/smtp/test", requireSuperAdmin, async (req, res) => {
    try {
      const { smtp_id, test_email } = req.body;
      if (!smtp_id || !test_email)
        return res.status(400).json({ error: "smtp_id e test_email obbligatori" });

      const config = await pool.query(
        "SELECT * FROM crm_smtp_configs WHERE id = $1",
        [smtp_id]
      );
      if (!config.rows.length) return res.status(404).json({ error: "Config non trovata" });
      const smtp = config.rows[0];

      const password = decryptPassword(smtp.password_encrypted);

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.username, pass: password },
      });

      await transporter.sendMail({
        from: `"${smtp.from_name || "Soccorso Digitale"}" <${smtp.from_email}>`,
        to: test_email,
        subject: "Test SMTP — Soccorso Digitale CRM",
        html: "<p>Test connessione SMTP riuscito! Il tuo server di posta è configurato correttamente.</p>",
      });

      res.json({ success: true, message: `Email di test inviata a ${test_email}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/crm/smtp/:id", requireSuperAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM crm_smtp_configs WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CAMPAGNE ───────────────────────────────────────────────

  app.get("/api/crm/campaigns", requireSuperAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*,
          t.name AS template_name,
          t.subject AS template_subject
        FROM crm_campaigns c
        LEFT JOIN crm_email_templates t ON c.template_id = t.id
        ORDER BY c.created_at DESC
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/crm/campaigns", requireSuperAdmin, async (req, res) => {
    try {
      const { name, description, template_id, send_method, smtp_config_id, filters, scheduled_at, send_speed } = req.body;
      if (!name || !template_id) return res.status(400).json({ error: "name e template_id obbligatori" });

      const result = await pool.query(
        `INSERT INTO crm_campaigns
           (name, description, template_id, send_method, smtp_config_id, filters, scheduled_at, send_speed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          name,
          description || null,
          template_id,
          send_method || "resend",
          smtp_config_id || null,
          JSON.stringify(filters || {}),
          scheduled_at || null,
          send_speed || 1,
        ]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Specific sub-routes must come before /:id

  app.post("/api/crm/campaigns/:id/send", requireSuperAdmin, async (req, res) => {
    try {
      const camp = await pool.query("SELECT * FROM crm_campaigns WHERE id = $1", [req.params.id]);
      if (!camp.rows.length) return res.status(404).json({ error: "Campagna non trovata" });
      if (camp.rows[0].status === "sending") return res.status(400).json({ error: "Campagna già in invio" });
      if (camp.rows[0].status === "sent") return res.status(400).json({ error: "Campagna già completata" });

      // Risponde subito, poi avvia in background
      res.json({ success: true, message: "Campagna avviata" });
      startCampaign(req.params.id).catch((err) =>
        console.error("[Campaign] Error:", err.message)
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/crm/campaigns/:id/pause", requireSuperAdmin, async (req, res) => {
    try {
      pauseCampaign(req.params.id);
      await pool.query(
        `UPDATE crm_campaigns SET status = 'paused', paused_at = NOW() WHERE id = $1`,
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/crm/campaigns/:id/resume", requireSuperAdmin, async (req, res) => {
    try {
      await pool.query(
        `UPDATE crm_campaigns SET status = 'sending', paused_at = NULL WHERE id = $1`,
        [req.params.id]
      );
      resumeCampaign(req.params.id);
      res.json({ success: true });
      // Se il processo in-memory non è più attivo (server riavviato), rilancia
      if (!getCampaignStatus(req.params.id)) {
        startCampaign(req.params.id).catch((err) =>
          console.error("[Campaign resume] Error:", err.message)
        );
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/crm/campaigns/:id/stop", requireSuperAdmin, async (req, res) => {
    try {
      stopCampaign(req.params.id);
      await pool.query(
        `UPDATE crm_campaigns SET status = 'draft' WHERE id = $1`,
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/crm/campaigns/:id/stats", requireSuperAdmin, async (req, res) => {
    try {
      const [campResult, logsResult] = await Promise.all([
        pool.query("SELECT * FROM crm_campaigns WHERE id = $1", [req.params.id]),
        pool.query(
          `SELECT status, COUNT(*) AS count FROM crm_email_logs
           WHERE campaign_id = $1 GROUP BY status`,
          [req.params.id]
        ),
      ]);
      if (!campResult.rows.length) return res.status(404).json({ error: "Campagna non trovata" });
      const camp = campResult.rows[0];

      const statusCounts = logsResult.rows.reduce((acc: any, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});

      const total = camp.total_sent || 0;
      const inMemoryState = getCampaignStatus(req.params.id);

      res.json({
        ...camp,
        status_counts: statusCounts,
        open_rate: total > 0 ? ((camp.total_opened / total) * 100).toFixed(1) : "0",
        click_rate: total > 0 ? ((camp.total_clicked / total) * 100).toFixed(1) : "0",
        bounce_rate: total > 0 ? ((camp.total_bounced / total) * 100).toFixed(1) : "0",
        in_progress: inMemoryState?.running || false,
        progress_pct: inMemoryState
          ? Math.round((inMemoryState.processed / Math.max(1, inMemoryState.total)) * 100)
          : camp.status === "sent" ? 100 : 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/crm/campaigns/:id/preview", requireSuperAdmin, async (req, res) => {
    try {
      const camp = await pool.query("SELECT * FROM crm_campaigns WHERE id = $1", [req.params.id]);
      if (!camp.rows.length) return res.status(404).json({ error: "Campagna non trovata" });

      const filters = camp.rows[0].filters || {};
      const whereConditions: string[] = [
        "email IS NOT NULL",
        "status != 'bounced'",
        "status != 'not_interested'",
      ];
      const params: any[] = [];
      let paramIdx = 1;

      if (filters.region?.length > 0) {
        whereConditions.push(`region = ANY($${paramIdx})`);
        params.push(filters.region);
        paramIdx++;
      }
      if (filters.type?.length > 0) {
        whereConditions.push(`type = ANY($${paramIdx})`);
        params.push(filters.type);
        paramIdx++;
      }
      if (filters.status?.length > 0) {
        whereConditions.push(`status = ANY($${paramIdx})`);
        params.push(filters.status);
        paramIdx++;
      }

      const where = `WHERE ${whereConditions.join(" AND ")}`;
      const [countResult, sampleResult] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM crm_organizations ${where}`, params),
        pool.query(
          `SELECT name, email, city, region, type FROM crm_organizations ${where} LIMIT 5`,
          params
        ),
      ]);

      res.json({
        total: parseInt(countResult.rows[0].count),
        sample: sampleResult.rows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ANALYTICS ─────────────────────────────────────────────

  app.get("/api/crm/analytics", requireSuperAdmin, async (_req, res) => {
    try {
      const [globalStats, recentCampaigns, topRegions] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS total_campaigns,
            COALESCE(SUM(total_sent), 0) AS total_sent,
            COALESCE(SUM(total_opened), 0) AS total_opened,
            COALESCE(SUM(total_clicked), 0) AS total_clicked,
            COALESCE(SUM(total_bounced), 0) AS total_bounced,
            ROUND(AVG(CASE WHEN total_sent > 0 THEN (total_opened::float / total_sent * 100) END)::numeric, 1) AS avg_open_rate,
            ROUND(AVG(CASE WHEN total_sent > 0 THEN (total_clicked::float / total_sent * 100) END)::numeric, 1) AS avg_click_rate
          FROM crm_campaigns WHERE status = 'sent'
        `),
        pool.query(`
          SELECT id, name, status, total_sent, total_opened, total_clicked, total_bounced,
            ROUND(CASE WHEN total_sent > 0 THEN (total_opened::float / total_sent * 100) END::numeric, 1) AS open_rate,
            sent_at
          FROM crm_campaigns WHERE status = 'sent'
          ORDER BY sent_at DESC LIMIT 10
        `),
        pool.query(`
          SELECT region, COUNT(*) AS count,
            COUNT(CASE WHEN status = 'customer' THEN 1 END) AS customers
          FROM crm_organizations
          WHERE region IS NOT NULL
          GROUP BY region ORDER BY count DESC LIMIT 10
        `),
      ]);

      res.json({
        global: globalStats.rows[0],
        recent_campaigns: recentCampaigns.rows,
        top_regions: topRegions.rows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── DISCOVERY ────────────────────────────────────────────

  app.get("/api/crm/discovery/jobs", requireSuperAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM crm_discovery_jobs ORDER BY created_at DESC LIMIT 20"
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(
    "/api/crm/discovery/jobs/:id",
    requireSuperAdmin,
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT * FROM crm_discovery_jobs WHERE id = $1",
          [req.params.id]
        );
        if (!result.rows.length)
          return res.status(404).json({ error: "Job non trovato" });
        const job = result.rows[0];
        res.json({
          ...job,
          progress_pct:
            job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/crm/discovery/google-places",
    requireSuperAdmin,
    async (req, res) => {
      try {
        if (!process.env.GOOGLE_PLACES_API_KEY) {
          return res
            .status(400)
            .json({ error: "GOOGLE_PLACES_API_KEY non configurata su Railway" });
        }

        const { provinces = [] } = req.body;
        const jobResult = await pool.query(
          `INSERT INTO crm_discovery_jobs (type, params) VALUES ('google_places', $1) RETURNING *`,
          [JSON.stringify({ provinces })]
        );
        const job = jobResult.rows[0];

        res.json({
          success: true,
          jobId: job.id,
          message: "Discovery avviata in background",
        });

        runGooglePlacesDiscovery(job.id, provinces, pool).catch((err) => {
          pool.query(
            `UPDATE crm_discovery_jobs SET status = 'error', error_message = $1 WHERE id = $2`,
            [err.message, job.id]
          );
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/crm/discovery/enrich",
    requireSuperAdmin,
    async (_req, res) => {
      try {
        if (!process.env.HUNTER_API_KEY) {
          return res.status(400).json({
            error:
              "HUNTER_API_KEY non configurata. Vai su hunter.io per ottenerla.",
          });
        }

        const jobResult = await pool.query(
          `INSERT INTO crm_discovery_jobs (type) VALUES ('email_enrichment') RETURNING *`
        );
        const job = jobResult.rows[0];

        res.json({
          success: true,
          jobId: job.id,
          message: "Enrichment avviato in background",
        });

        runEmailEnrichment(job.id, pool).catch((err) => {
          pool.query(
            `UPDATE crm_discovery_jobs SET status = 'error', error_message = $1 WHERE id = $2`,
            [err.message, job.id]
          );
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // ── STATS (per discovery tab enrichment counter) ──────────

  app.get("/api/crm/stats", requireSuperAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN email IS NOT NULL THEN 1 END) AS with_email,
          COUNT(CASE WHEN website IS NOT NULL AND email IS NULL THEN 1 END) AS enrichable
        FROM crm_organizations
      `);
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── MAP DATA (distribuzione per regione) ─────────────────

  app.get("/api/crm/map-data", requireSuperAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          region,
          COUNT(*) AS total,
          COUNT(CASE WHEN email IS NOT NULL THEN 1 END) AS with_email,
          COUNT(CASE WHEN status = 'customer' THEN 1 END) AS customers,
          COUNT(CASE WHEN status = 'interested' THEN 1 END) AS interested
        FROM crm_organizations
        WHERE region IS NOT NULL
        GROUP BY region
        ORDER BY total DESC
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UNSUBSCRIBE (pubblico, pagina professionale) ──────────

  app.get("/api/crm/unsubscribe/:orgId", async (req, res) => {
    try {
      const org = await pool.query(
        "SELECT name, email FROM crm_organizations WHERE id = $1",
        [req.params.orgId]
      );
      if (org.rows.length) {
        await pool.query(
          `UPDATE crm_organizations SET status = 'not_interested', updated_at = NOW() WHERE id = $1`,
          [req.params.orgId]
        );
        await pool.query(
          `INSERT INTO crm_unsubscribes (email, organization_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [org.rows[0].email, req.params.orgId]
        );
      }
      res.send(`<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Iscrizione cancellata — Soccorso Digitale</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F2F2F7;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}</style>
</head>
<body>
<div style="background:#fff;border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <img src="https://soccorsodigitale.app/images/69b0dc9033646175674e6d28_logoicon.svg" height="40" style="margin-bottom:24px;opacity:0.6;" alt="Soccorso Digitale">
  <h2 style="font-size:20px;font-weight:700;color:#0B2347;margin-bottom:12px;">Iscrizione cancellata</h2>
  <p style="font-size:14px;color:#64748B;line-height:1.6;">Hai rimosso il tuo indirizzo dalla nostra lista.<br>Non riceverai altre comunicazioni da Soccorso Digitale.</p>
  <p style="font-size:12px;color:#94A3B8;margin-top:24px;">Se hai cancellato per errore, scrivi a <a href="mailto:info@soccorsodigitale.app" style="color:#1E3A8A;">info@soccorsodigitale.app</a></p>
</div>
</body>
</html>`);
    } catch {
      res.status(500).send("Errore");
    }
  });
}
