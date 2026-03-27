/**
 * Email Enrichment via Hunter.io — trova email da dominio per org senza email.
 */
import { Pool } from "pg";

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

function extractDomain(website: string): string | null {
  try {
    const url = new URL(
      website.startsWith("http") ? website : `https://${website}`
    );
    return url.hostname.replace("www.", "");
  } catch {
    return null;
  }
}

async function findEmailByDomain(
  domain: string
): Promise<{ email: string; confidence: number } | null> {
  if (!HUNTER_API_KEY) return null;

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&limit=1`;
    const res = await fetch(url);
    const data = (await res.json()) as any;

    if (data.data?.emails?.length > 0) {
      const best = data.data.emails[0];
      return { email: best.value, confidence: best.confidence || 0 };
    }
  } catch {}
  return null;
}

export async function runEmailEnrichment(
  jobId: string,
  pool: Pool
): Promise<void> {
  const orgs = await pool.query(
    `SELECT id, name, website FROM crm_organizations
     WHERE website IS NOT NULL AND email IS NULL AND enriched_at IS NULL
     ORDER BY created_at DESC`
  );

  const total = orgs.rows.length;
  await pool.query(
    `UPDATE crm_discovery_jobs SET status = 'running', started_at = NOW(), total = $1 WHERE id = $2`,
    [total, jobId]
  );

  let found = 0;
  for (let i = 0; i < orgs.rows.length; i++) {
    const org = orgs.rows[i];
    const domain = extractDomain(org.website);

    if (domain) {
      const result = await findEmailByDomain(domain);
      if (result && result.confidence >= 70) {
        await pool.query(
          `UPDATE crm_organizations SET email = $1, hunter_confidence = $2, enriched_at = NOW() WHERE id = $3`,
          [result.email, result.confidence, org.id]
        );
        found++;
      }
    }

    // Marca comunque come elaborata per non riprocessarla
    await pool.query(
      `UPDATE crm_organizations SET enriched_at = NOW() WHERE id = $1 AND enriched_at IS NULL`,
      [org.id]
    );

    await pool.query(
      `UPDATE crm_discovery_jobs SET progress = $1, found = $2 WHERE id = $3`,
      [i + 1, found, jobId]
    );

    // Rate limit Hunter.io: max ~1 req/sec
    await new Promise((r) => setTimeout(r, 1200));
  }

  await pool.query(
    `UPDATE crm_discovery_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [jobId]
  );
}
