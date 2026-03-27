/**
 * Google Places Discovery Engine — cerca organizzazioni sanitarie per provincia.
 */
import { Pool } from "pg";

// GOOGLE_API_KEY letta a runtime dentro ogni funzione (non a livello di modulo)

const PROVINCE_COORDS: Record<
  string,
  { lat: number; lng: number; name: string; region: string }
> = {
  // ABRUZZO
  AQ: { lat: 42.3498, lng: 13.3995, name: "L'Aquila", region: "Abruzzo" },
  PE: { lat: 42.3589, lng: 14.1063, name: "Pescara", region: "Abruzzo" },
  CH: { lat: 42.3508, lng: 14.1685, name: "Chieti", region: "Abruzzo" },
  TE: { lat: 42.6589, lng: 13.7036, name: "Teramo", region: "Abruzzo" },
  // BASILICATA
  PZ: { lat: 40.6403, lng: 15.8056, name: "Potenza", region: "Basilicata" },
  MT: { lat: 40.6664, lng: 16.6044, name: "Matera", region: "Basilicata" },
  // CALABRIA
  CZ: { lat: 38.9012, lng: 16.5882, name: "Catanzaro", region: "Calabria" },
  RC: { lat: 38.1104, lng: 15.6470, name: "Reggio Calabria", region: "Calabria" },
  CS: { lat: 39.3008, lng: 16.2530, name: "Cosenza", region: "Calabria" },
  KR: { lat: 39.0848, lng: 17.1272, name: "Crotone", region: "Calabria" },
  VV: { lat: 38.6754, lng: 16.1019, name: "Vibo Valentia", region: "Calabria" },
  // CAMPANIA
  NA: { lat: 40.8518, lng: 14.2681, name: "Napoli", region: "Campania" },
  SA: { lat: 40.6824, lng: 14.7681, name: "Salerno", region: "Campania" },
  AV: { lat: 40.9143, lng: 14.7900, name: "Avellino", region: "Campania" },
  BN: { lat: 41.1297, lng: 14.7782, name: "Benevento", region: "Campania" },
  CE: { lat: 41.0741, lng: 14.3321, name: "Caserta", region: "Campania" },
  // EMILIA-ROMAGNA
  BO: { lat: 44.4949, lng: 11.3426, name: "Bologna", region: "Emilia-Romagna" },
  MO: { lat: 44.6465, lng: 10.9252, name: "Modena", region: "Emilia-Romagna" },
  PR: { lat: 44.8015, lng: 10.3279, name: "Parma", region: "Emilia-Romagna" },
  RE: { lat: 44.6989, lng: 10.6297, name: "Reggio Emilia", region: "Emilia-Romagna" },
  FE: { lat: 44.8381, lng: 11.6198, name: "Ferrara", region: "Emilia-Romagna" },
  RA: { lat: 44.4175, lng: 12.2035, name: "Ravenna", region: "Emilia-Romagna" },
  FC: { lat: 44.2227, lng: 12.0407, name: "Forlì-Cesena", region: "Emilia-Romagna" },
  RN: { lat: 44.0678, lng: 12.5695, name: "Rimini", region: "Emilia-Romagna" },
  PC: { lat: 45.0526, lng: 9.6930, name: "Piacenza", region: "Emilia-Romagna" },
  // FRIULI-VENEZIA GIULIA
  TS: { lat: 45.6496, lng: 13.7768, name: "Trieste", region: "Friuli-Venezia Giulia" },
  UD: { lat: 46.0711, lng: 13.2350, name: "Udine", region: "Friuli-Venezia Giulia" },
  GO: { lat: 45.9416, lng: 13.6219, name: "Gorizia", region: "Friuli-Venezia Giulia" },
  PN: { lat: 46.0626, lng: 12.6638, name: "Pordenone", region: "Friuli-Venezia Giulia" },
  // LAZIO
  RM: { lat: 41.9028, lng: 12.4964, name: "Roma", region: "Lazio" },
  LT: { lat: 41.5077, lng: 12.9026, name: "Latina", region: "Lazio" },
  FR: { lat: 41.6360, lng: 13.3424, name: "Frosinone", region: "Lazio" },
  VT: { lat: 42.4168, lng: 12.1073, name: "Viterbo", region: "Lazio" },
  RI: { lat: 42.4044, lng: 12.8657, name: "Rieti", region: "Lazio" },
  // LIGURIA
  GE: { lat: 44.4056, lng: 8.9463, name: "Genova", region: "Liguria" },
  SV: { lat: 44.3069, lng: 8.4822, name: "Savona", region: "Liguria" },
  IM: { lat: 43.8921, lng: 8.0307, name: "Imperia", region: "Liguria" },
  SP: { lat: 44.1024, lng: 9.8240, name: "La Spezia", region: "Liguria" },
  // LOMBARDIA
  MI: { lat: 45.4642, lng: 9.1900, name: "Milano", region: "Lombardia" },
  BS: { lat: 45.5416, lng: 10.2118, name: "Brescia", region: "Lombardia" },
  BG: { lat: 45.6983, lng: 9.6773, name: "Bergamo", region: "Lombardia" },
  MN: { lat: 45.1564, lng: 10.7914, name: "Mantova", region: "Lombardia" },
  CO: { lat: 45.8081, lng: 9.0852, name: "Como", region: "Lombardia" },
  VA: { lat: 45.8206, lng: 8.8257, name: "Varese", region: "Lombardia" },
  LC: { lat: 45.8566, lng: 9.3980, name: "Lecco", region: "Lombardia" },
  LO: { lat: 45.3136, lng: 9.5034, name: "Lodi", region: "Lombardia" },
  MB: { lat: 45.5845, lng: 9.2744, name: "Monza", region: "Lombardia" },
  PV: { lat: 45.1847, lng: 9.1582, name: "Pavia", region: "Lombardia" },
  CR: { lat: 45.1333, lng: 10.0229, name: "Cremona", region: "Lombardia" },
  SO: { lat: 46.1699, lng: 9.8699, name: "Sondrio", region: "Lombardia" },
  // MARCHE
  AN: { lat: 43.6158, lng: 13.5189, name: "Ancona", region: "Marche" },
  PS: { lat: 43.9100, lng: 12.9136, name: "Pesaro-Urbino", region: "Marche" },
  MC: { lat: 43.3003, lng: 13.4534, name: "Macerata", region: "Marche" },
  AP: { lat: 42.8554, lng: 13.5748, name: "Ascoli Piceno", region: "Marche" },
  FM: { lat: 43.1562, lng: 13.7176, name: "Fermo", region: "Marche" },
  // MOLISE
  CB: { lat: 41.5602, lng: 14.6682, name: "Campobasso", region: "Molise" },
  IS: { lat: 41.5924, lng: 14.2295, name: "Isernia", region: "Molise" },
  // PIEMONTE
  TO: { lat: 45.0703, lng: 7.6869, name: "Torino", region: "Piemonte" },
  AL: { lat: 44.9128, lng: 8.6150, name: "Alessandria", region: "Piemonte" },
  AT: { lat: 44.8986, lng: 8.2064, name: "Asti", region: "Piemonte" },
  BI: { lat: 45.5628, lng: 8.0580, name: "Biella", region: "Piemonte" },
  CN: { lat: 44.3841, lng: 7.5427, name: "Cuneo", region: "Piemonte" },
  NO: { lat: 45.4458, lng: 8.6218, name: "Novara", region: "Piemonte" },
  VB: { lat: 46.1277, lng: 8.2732, name: "Verbania", region: "Piemonte" },
  VC: { lat: 45.3225, lng: 8.4188, name: "Vercelli", region: "Piemonte" },
  // PUGLIA
  BA: { lat: 41.1171, lng: 16.8719, name: "Bari", region: "Puglia" },
  TA: { lat: 40.4765, lng: 17.2293, name: "Taranto", region: "Puglia" },
  LE: { lat: 40.3516, lng: 18.1750, name: "Lecce", region: "Puglia" },
  BR: { lat: 40.6327, lng: 17.9408, name: "Brindisi", region: "Puglia" },
  FG: { lat: 41.4622, lng: 15.5446, name: "Foggia", region: "Puglia" },
  BT: { lat: 41.2294, lng: 16.2952, name: "Barletta-Andria-Trani", region: "Puglia" },
  // SARDEGNA
  CA: { lat: 39.2238, lng: 9.1217, name: "Cagliari", region: "Sardegna" },
  SS: { lat: 40.7259, lng: 8.5556, name: "Sassari", region: "Sardegna" },
  NU: { lat: 40.3187, lng: 9.3281, name: "Nuoro", region: "Sardegna" },
  OR: { lat: 39.9036, lng: 8.5938, name: "Oristano", region: "Sardegna" },
  SU: { lat: 39.3145, lng: 9.3255, name: "Sud Sardegna", region: "Sardegna" },
  // SICILIA
  PA: { lat: 38.1157, lng: 13.3615, name: "Palermo", region: "Sicilia" },
  CT: { lat: 37.5079, lng: 15.0830, name: "Catania", region: "Sicilia" },
  ME: { lat: 38.1938, lng: 15.5540, name: "Messina", region: "Sicilia" },
  AG: { lat: 37.3111, lng: 13.5765, name: "Agrigento", region: "Sicilia" },
  CL: { lat: 37.4882, lng: 14.0561, name: "Caltanissetta", region: "Sicilia" },
  EN: { lat: 37.5672, lng: 14.2794, name: "Enna", region: "Sicilia" },
  RG: { lat: 36.9249, lng: 14.7252, name: "Ragusa", region: "Sicilia" },
  SR: { lat: 37.0755, lng: 15.2866, name: "Siracusa", region: "Sicilia" },
  TP: { lat: 37.9934, lng: 12.6113, name: "Trapani", region: "Sicilia" },
  // TOSCANA
  FI: { lat: 43.7696, lng: 11.2558, name: "Firenze", region: "Toscana" },
  LI: { lat: 43.5485, lng: 10.3106, name: "Livorno", region: "Toscana" },
  LU: { lat: 43.8430, lng: 10.5050, name: "Lucca", region: "Toscana" },
  MS: { lat: 44.0352, lng: 10.1425, name: "Massa-Carrara", region: "Toscana" },
  PI: { lat: 43.7228, lng: 10.4017, name: "Pisa", region: "Toscana" },
  PT: { lat: 43.9297, lng: 10.9073, name: "Pistoia", region: "Toscana" },
  PO: { lat: 43.8802, lng: 11.0924, name: "Prato", region: "Toscana" },
  AR: { lat: 43.4636, lng: 11.8799, name: "Arezzo", region: "Toscana" },
  SI: { lat: 43.3186, lng: 11.3307, name: "Siena", region: "Toscana" },
  GR: { lat: 42.7629, lng: 11.1114, name: "Grosseto", region: "Toscana" },
  // TRENTINO-ALTO ADIGE
  TN: { lat: 46.0679, lng: 11.1211, name: "Trento", region: "Trentino-Alto Adige" },
  BZ: { lat: 46.4983, lng: 11.3548, name: "Bolzano", region: "Trentino-Alto Adige" },
  // UMBRIA
  PG: { lat: 43.1121, lng: 12.3888, name: "Perugia", region: "Umbria" },
  TR: { lat: 42.5636, lng: 12.6430, name: "Terni", region: "Umbria" },
  // VALLE D'AOSTA
  AO: { lat: 45.7369, lng: 7.3200, name: "Aosta", region: "Valle d'Aosta" },
  // VENETO
  VR: { lat: 45.4384, lng: 10.9916, name: "Verona", region: "Veneto" },
  VE: { lat: 45.4408, lng: 12.3155, name: "Venezia", region: "Veneto" },
  PD: { lat: 45.4064, lng: 11.8768, name: "Padova", region: "Veneto" },
  VI: { lat: 45.5455, lng: 11.5354, name: "Vicenza", region: "Veneto" },
  TV: { lat: 45.6671, lng: 12.2437, name: "Treviso", region: "Veneto" },
  RO: { lat: 45.0711, lng: 11.7905, name: "Rovigo", region: "Veneto" },
  BL: { lat: 46.1371, lng: 12.2165, name: "Belluno", region: "Veneto" },
};

const SEARCH_KEYWORDS = [
  // Cattura TUTTE le croci (rossa, verde, bianca, azzurra, viola, gialla, ecc.)
  'croce',

  // Cattura tutte le misericordie
  'misericordia',

  // Cattura pubblica assistenza e varianti
  'pubblica assistenza',

  // Ambulanze private e cooperative
  'ambulanza',
  'trasporto sanitario',
  'trasporto infermi',
  'trasporto disabili',
  'trasporto dialisi',

  // Volontariato sanitario generico
  'soccorso volontari',
  'associazione soccorso',
  'volontariato sanitario',

  // Cooperative sociali sanitarie
  'cooperativa sociale sanitaria',
  'cooperativa trasporto sanitario',

  // Emergenza
  'emergenza urgenza',
  'pronto soccorso volontari',
];

async function searchPlacesInArea(
  query: string,
  lat: number,
  lng: number,
  radius = 30000
): Promise<any[]> {
  const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
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
  const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
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
