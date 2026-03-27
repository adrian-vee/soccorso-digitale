/**
 * Campaign Queue — invio massivo email con rate limiting in-memory.
 * Usa il pool condiviso del DB, non crea connessioni proprie.
 */
import { Resend } from "resend";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { pool } from "../db";

const resend = new Resend(process.env.RESEND_API_KEY);

interface CampaignState {
  running: boolean;
  paused: boolean;
  processed: number;
  total: number;
}

// Stato in-memory delle campagne attive
const activeCampaigns = new Map<string, CampaignState>();

export function getCampaignStatus(campaignId: string): CampaignState | undefined {
  return activeCampaigns.get(campaignId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function decryptSmtpPassword(encrypted: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("FATAL: SESSION_SECRET environment variable is required for SMTP decryption");
  const key = Buffer.from(secret, "utf8").slice(0, 32);
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export async function startCampaign(campaignId: string): Promise<void> {
  try {
    // Carica campagna
    const campResult = await pool.query(
      "SELECT * FROM crm_campaigns WHERE id = $1",
      [campaignId]
    );
    if (!campResult.rows.length) throw new Error("Campagna non trovata");
    const campaign = campResult.rows[0];

    // Carica template
    const tplResult = await pool.query(
      "SELECT * FROM crm_email_templates WHERE id = $1",
      [campaign.template_id]
    );
    if (!tplResult.rows.length) throw new Error("Template non trovato");
    const template = tplResult.rows[0];

    // Costruisci filtri destinatari
    const filters = campaign.filters || {};
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
    if (filters.not_contacted_days) {
      const days = parseInt(filters.not_contacted_days);
      whereConditions.push(
        `(last_contacted_at IS NULL OR last_contacted_at < NOW() - INTERVAL '${days} days')`
      );
    }

    // Escludi già inviati per questa campagna
    whereConditions.push(
      `id NOT IN (
        SELECT organization_id FROM crm_email_logs
        WHERE campaign_id = $${paramIdx} AND status NOT IN ('queued','bounced')
      )`
    );
    params.push(campaignId);

    const where = `WHERE ${whereConditions.join(" AND ")}`;
    const orgsResult = await pool.query(
      `SELECT * FROM crm_organizations ${where} ORDER BY created_at DESC`,
      params
    );
    const orgs = orgsResult.rows;

    // Aggiorna stato campagna
    await pool.query(
      `UPDATE crm_campaigns SET status = 'sending', total_recipients = $1, sent_at = NOW() WHERE id = $2`,
      [orgs.length, campaignId]
    );

    // Stato in-memory
    activeCampaigns.set(campaignId, {
      running: true,
      paused: false,
      processed: 0,
      total: orgs.length,
    });

    // Carica SMTP se configurato
    let smtpTransporter: any = null;
    if (campaign.send_method === "smtp" && campaign.smtp_config_id) {
      const smtpResult = await pool.query(
        "SELECT * FROM crm_smtp_configs WHERE id = $1",
        [campaign.smtp_config_id]
      );
      if (smtpResult.rows.length) {
        const smtp = smtpResult.rows[0];
        const password = decryptSmtpPassword(smtp.password_encrypted);
        smtpTransporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465,
          auth: { user: smtp.username, pass: password },
        });
      }
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    // Loop invio
    for (const org of orgs) {
      const state = activeCampaigns.get(campaignId);
      if (!state?.running) break;

      // Attendi se in pausa
      while (activeCampaigns.get(campaignId)?.paused) {
        await sleep(1000);
        if (!activeCampaigns.get(campaignId)?.running) break;
      }
      if (!activeCampaigns.get(campaignId)?.running) break;

      try {
        const unsubUrl = `https://soccorsodigitale.app/api/crm/unsubscribe/${org.id}`;
        const pixelId = crypto.randomUUID();

        let subject = template.subject
          .replace(/{{org_name}}/g, org.name || "")
          .replace(/{{city}}/g, org.city || "")
          .replace(/{{region}}/g, org.region || "")
          .replace(/{{org_type}}/g, org.type || "")
          .replace(/{{unsubscribe_url}}/g, unsubUrl);

        let bodyHtml = template.body_html
          .replace(/{{org_name}}/g, org.name || "")
          .replace(/{{city}}/g, org.city || "")
          .replace(/{{region}}/g, org.region || "")
          .replace(/{{org_type}}/g, org.type || "")
          .replace(/{{unsubscribe_url}}/g, unsubUrl);

        // Pre-insert log
        const logResult = await pool.query(
          `INSERT INTO crm_email_logs (campaign_id, organization_id, email_to, status, tracking_pixel_id)
           VALUES ($1, $2, $3, 'queued', $4) RETURNING id`,
          [campaignId, org.id, org.email, pixelId]
        );
        const logId = logResult.rows[0].id;

        // Pixel tracking
        const pixelUrl = `https://soccorsodigitale.app/api/crm/track/open/${pixelId}`;
        bodyHtml = bodyHtml.includes("</body>")
          ? bodyHtml.replace("</body>", `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt=""></body>`)
          : bodyHtml + `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="">`;

        // Click tracking
        bodyHtml = bodyHtml.replace(
          /href="(https?:\/\/(?!soccorsodigitale\.app\/api\/crm\/unsubscribe)[^"]+)"/g,
          (_: string, url: string) =>
            `href="https://soccorsodigitale.app/api/crm/track/click/${logId}?url=${encodeURIComponent(url)}"`
        );

        // Invia
        if (smtpTransporter) {
          await smtpTransporter.sendMail({
            from: fromEmail,
            to: org.email,
            subject,
            html: bodyHtml,
          });
        } else {
          const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: org.email,
            subject,
            html: bodyHtml,
          });
          if (error) throw new Error((error as any).message);
          await pool.query(
            "UPDATE crm_email_logs SET message_id = $1 WHERE id = $2",
            [data?.id, logId]
          );
        }

        await pool.query(
          `UPDATE crm_email_logs SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [logId]
        );
        await pool.query(
          `UPDATE crm_campaigns SET total_sent = total_sent + 1 WHERE id = $1`,
          [campaignId]
        );
        await pool.query(
          `UPDATE crm_organizations
           SET last_contacted_at = NOW(),
               status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END
           WHERE id = $1`,
          [org.id]
        );

        const s = activeCampaigns.get(campaignId);
        if (s) s.processed++;
      } catch (emailErr: any) {
        console.error(`[Campaign ${campaignId}] Errore invio a ${org.email}:`, emailErr.message);
        await pool.query(
          `UPDATE crm_email_logs SET status = 'bounced', bounce_reason = $1
           WHERE campaign_id = $2 AND organization_id = $3 AND status = 'queued'`,
          [emailErr.message, campaignId, org.id]
        );
        await pool.query(
          "UPDATE crm_campaigns SET total_bounced = total_bounced + 1 WHERE id = $1",
          [campaignId]
        );
      }

      // Rate limiting: max send_speed email/sec (default 1/sec)
      const delayMs = Math.max(200, 1000 / Math.max(1, campaign.send_speed || 1));
      await sleep(delayMs);
    }

    // Completamento
    if (activeCampaigns.get(campaignId)?.running) {
      await pool.query(
        `UPDATE crm_campaigns SET status = 'sent', completed_at = NOW() WHERE id = $1`,
        [campaignId]
      );
    }

    activeCampaigns.delete(campaignId);
  } catch (err: any) {
    await pool.query(
      `UPDATE crm_campaigns SET status = 'draft', error_message = $1 WHERE id = $2`,
      [err.message, campaignId]
    );
    activeCampaigns.delete(campaignId);
    throw err;
  }
}

export function pauseCampaign(campaignId: string): void {
  const state = activeCampaigns.get(campaignId);
  if (state) state.paused = true;
}

export function resumeCampaign(campaignId: string): void {
  const state = activeCampaigns.get(campaignId);
  if (state) state.paused = false;
}

export function stopCampaign(campaignId: string): void {
  const state = activeCampaigns.get(campaignId);
  if (state) {
    state.running = false;
    state.paused = false;
  }
}
