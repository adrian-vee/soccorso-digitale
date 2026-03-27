/**
 * Email Enrichment via Apollo.io — fallback per org senza email dopo Hunter.io.
 * Usa People Search per trovare contatti, con fallback su Organization Search.
 */
import { Pool } from "pg";

async function findEmailViaApollo(
  orgName: string,
  domain: string | null
): Promise<{ email: string; confidence: number } | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  // Prova 1: Organization Search per trovare l'azienda e i contatti
  try {
    const body: any = {
      api_key: apiKey,
      q_organization_name: orgName,
      page: 1,
      per_page: 1,
    };
    if (domain) body.q_organization_domains = [domain];

    const res = await fetch("https://api.apollo.io/v1/organizations/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const org = data.organizations?.[0];
      if (org?.phone_numbers?.[0]) {
        // Apollo non restituisce email dirette via org search senza piano a pagamento
        // Salviamo il numero di telefono se trovato e cerchiamo contatti
      }
    }
  } catch {}

  // Prova 2: People Search — trova un contatto chiave nell'organizzazione
  try {
    const body: any = {
      api_key: apiKey,
      q_organization_name: orgName,
      person_titles: ["direttore", "responsabile", "presidente", "coordinatore", "segretario"],
      page: 1,
      per_page: 3,
    };
    if (domain) body.q_organization_domains = [domain];

    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;

    const people = data.people || [];
    for (const person of people) {
      // Apollo restituisce email oscurate (es. j***@example.com) sul piano free
      // Sul piano base+ restituisce email complete
      const email = person.email;
      if (email && !email.includes("***") && email.includes("@")) {
        return { email, confidence: 75 };
      }
    }
  } catch {}

  return null;
}

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

export async function runApolloEnrichment(
  jobId: string,
  pool: Pool
): Promise<void> {
  // Org senza email che Hunter non ha trovato (enriched_at IS NOT NULL ma email IS NULL)
  // oppure org mai elaborate (enriched_at IS NULL)
  const orgs = await pool.query(
    `SELECT id, name, website FROM crm_organizations
     WHERE email IS NULL
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
    const domain = org.website ? extractDomain(org.website) : null;

    const result = await findEmailViaApollo(org.name, domain);
    if (result) {
      await pool.query(
        `UPDATE crm_organizations SET email = $1, hunter_confidence = $2, enriched_at = NOW() WHERE id = $3`,
        [result.email, result.confidence, org.id]
      );
      found++;
    }

    await pool.query(
      `UPDATE crm_discovery_jobs SET progress = $1, found = $2 WHERE id = $3`,
      [i + 1, found, jobId]
    );

    // Rate limit Apollo: max 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  await pool.query(
    `UPDATE crm_discovery_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [jobId]
  );
}
