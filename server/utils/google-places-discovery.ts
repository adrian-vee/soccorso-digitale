/**
 * Google Places Discovery Engine — cerca organizzazioni sanitarie per provincia.
 */
import { Pool } from "pg";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const PROVINCE_COORDS: Record<
  string,
  { lat: number; lng: number; name: string; region: string }
> = {
  MI: { lat: 45.4642, lng: 9.19, name: "Milano", region: "Lombardia" },
  RM: { lat: 41.9028, lng: 12.4964, name: "Roma", region: "Lazio" },
  NA: { lat: 40.8518, lng: 14.2681, name: "Napoli", region: "Campania" },
  TO: { lat: 45.0703, lng: 7.6869, name: "Torino", region: "Piemonte" },
  VR: { lat: 45.4384, lng: 10.9916, name: "Verona", region: "Veneto" },
  VE: { lat: 45.4408, lng: 12.3155, name: "Venezia", region: "Veneto" },
  PD: { lat: 45.4064, lng: 11.8768, name: "Padova", region: "Veneto" },
  VI: { lat: 45.5455, lng: 11.5354, name: "Vicenza", region: "Veneto" },
  TV: { lat: 45.6671, lng: 12.2437, name: "Treviso", region: "Veneto" },
  BS: { lat: 45.5416, lng: 10.2118, name: "Brescia", region: "Lombardia" },
  BG: { lat: 45.6983, lng: 9.6773, name: "Bergamo", region: "Lombardia" },
  BO: {
    lat: 44.4949,
    lng: 11.3426,
    name: "Bologna",
    region: "Emilia-Romagna",
  },
  FI: { lat: 43.7696, lng: 11.2558, name: "Firenze", region: "Toscana" },
  GE: { lat: 44.4056, lng: 8.9463, name: "Genova", region: "Liguria" },
  PA: { lat: 38.1157, lng: 13.3615, name: "Palermo", region: "Sicilia" },
  CT: { lat: 37.5079, lng: 15.083, name: "Catania", region: "Sicilia" },
  BA: { lat: 41.1171, lng: 16.8719, name: "Bari", region: "Puglia" },
  TA: { lat: 40.4765, lng: 17.2293, name: "Taranto", region: "Puglia" },
  AN: { lat: 43.6158, lng: 13.5189, name: "Ancona", region: "Marche" },
  PE: { lat: 42.3589, lng: 14.1063, name: "Pescara", region: "Abruzzo" },
  CA: { lat: 39.2238, lng: 9.1217, name: "Cagliari", region: "Sardegna" },
  TN: {
    lat: 46.0679,
    lng: 11.1211,
    name: "Trento",
    region: "Trentino-Alto Adige",
  },
  BZ: {
    lat: 46.4983,
    lng: 11.3548,
    name: "Bolzano",
    region: "Trentino-Alto Adige",
  },
  TS: {
    lat: 45.6496,
    lng: 13.7768,
    name: "Trieste",
    region: "Friuli-Venezia Giulia",
  },
  UD: {
    lat: 46.0711,
    lng: 13.235,
    name: "Udine",
    region: "Friuli-Venezia Giulia",
  },
  PG: { lat: 43.1121, lng: 12.3888, name: "Perugia", region: "Umbria" },
  AO: { lat: 45.7369, lng: 7.32, name: "Aosta", region: "Valle d'Aosta" },
  CZ: { lat: 38.9012, lng: 16.5882, name: "Catanzaro", region: "Calabria" },
  RC: {
    lat: 38.1104,
    lng: 15.647,
    name: "Reggio Calabria",
    region: "Calabria",
  },
  CB: { lat: 41.5602, lng: 14.6682, name: "Campobasso", region: "Molise" },
  PZ: { lat: 40.6403, lng: 15.8056, name: "Potenza", region: "Basilicata" },
};

const SEARCH_KEYWORDS = [
  "croce verde",
  "croce bianca",
  "pubblica assistenza",
  "ambulanza",
  "trasporto sanitario",
  "misericordia",
  "volontari soccorso",
  "pronto soccorso volontari",
];

async function searchPlacesInArea(
  query: string,
  lat: number,
  lng: number,
  radius = 30000
): Promise<any[]> {
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_PLACES_API_KEY non configurata");

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(query)}&language=it&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  const data = (await res.json()) as any;

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places error: ${data.status} - ${data.error_message || ""}`
    );
  }

  return data.results || [];
}

async function getPlaceDetails(placeId: string): Promise<any> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,geometry&language=it&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  const data = (await res.json()) as any;
  return data.result || {};
}

function detectOrgType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("croce rossa") || n.includes("cri")) return "croce_rossa";
  if (n.includes("misericordia")) return "misericordia";
  if (n.includes("croce verde") || n.includes("croce bianca"))
    return "pubblica_assistenza";
  if (n.includes("pubblica assistenza")) return "pubblica_assistenza";
  if (n.includes("ambulanza") || n.includes("trasporto"))
    return "ambulanza_privata";
  return "altro";
}

export async function runGooglePlacesDiscovery(
  jobId: string,
  provinces: string[],
  pool: Pool
): Promise<void> {
  const targets =
    provinces.length > 0
      ? provinces.map((p) => PROVINCE_COORDS[p]).filter(Boolean)
      : Object.values(PROVINCE_COORDS);

  const totalSteps = targets.length * SEARCH_KEYWORDS.length;
  let step = 0;
  let found = 0;
  let duplicates = 0;

  await pool.query(
    `UPDATE crm_discovery_jobs SET status = 'running', started_at = NOW(), total = $1 WHERE id = $2`,
    [totalSteps, jobId]
  );

  for (const province of targets) {
    for (const keyword of SEARCH_KEYWORDS) {
      try {
        const results = await searchPlacesInArea(
          keyword,
          province.lat,
          province.lng
        );

        for (const place of results) {
          const existing = await pool.query(
            "SELECT id FROM crm_organizations WHERE google_place_id = $1",
            [place.place_id]
          );
          if (existing.rows.length > 0) {
            duplicates++;
            continue;
          }

          let details: any = {};
          try {
            details = await getPlaceDetails(place.place_id);
            await new Promise((r) => setTimeout(r, 200));
          } catch {}

          await pool.query(
            `INSERT INTO crm_organizations
             (name, type, city, region, address, phone, website, google_place_id, latitude, longitude, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'google_places')
             ON CONFLICT (google_place_id) DO NOTHING`,
            [
              place.name,
              detectOrgType(place.name || ""),
              province.name,
              province.region,
              details.formatted_address || place.vicinity || null,
              details.formatted_phone_number || null,
              details.website || null,
              place.place_id,
              details.geometry?.location?.lat ||
                place.geometry?.location?.lat ||
                null,
              details.geometry?.location?.lng ||
                place.geometry?.location?.lng ||
                null,
            ]
          );
          found++;
        }

        step++;
        await pool.query(
          `UPDATE crm_discovery_jobs SET progress = $1, found = $2, duplicates = $3 WHERE id = $4`,
          [step, found, duplicates, jobId]
        );

        // Rate limiting: ~2 req/sec
        await new Promise((r) => setTimeout(r, 500));
      } catch (err: any) {
        console.error(
          `[Discovery] ${province.name} / ${keyword}:`,
          err.message
        );
      }
    }
  }

  await pool.query(
    `UPDATE crm_discovery_jobs SET status = 'completed', completed_at = NOW(), progress = $1 WHERE id = $2`,
    [totalSteps, jobId]
  );
}
