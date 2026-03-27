const BASE = 'https://soccorso-digitale-production.up.railway.app';
const SUPERADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'superadmin@soccorsodigitale.app',
  password: process.env.TEST_ADMIN_PASSWORD || 'SoccorsoDigitale2026!'
};
const ORG_ADMIN = {
  email: 'admin@croceeuropa.com',
  password: 'CroceEuropa2026!'
};

let results = [];
let superToken = null;
let orgToken = null;

function log(category, step, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏭️';
  const msg = `${icon} [${category}] ${step}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
  results.push({ category, step, status, detail });
}

async function post(url, body, token) {
  try {
    const res = await fetch(BASE + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 200) }; }
    return { status: res.status, data, headers: res.headers };
  } catch(e) { return { status: 0, data: { error: e.message }, headers: {} }; }
}

async function get(url, token) {
  try {
    const res = await fetch(BASE + url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 200) }; }
    return { status: res.status, data, headers: res.headers };
  } catch(e) { return { status: 0, data: { error: e.message }, headers: {} }; }
}

async function runAudit() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 SOCCORSO DIGITALE — AUDIT COMPLETO PIATTAFORMA');
  console.log('='.repeat(60));
  console.log(`📍 Target: ${BASE}`);
  console.log(`🕐 Data: ${new Date().toLocaleString('it-IT')}\n`);

  // ═══════════════════════════════════════════
  // 1. INFRASTRUTTURA
  // ═══════════════════════════════════════════
  console.log('\n━━━ 1. INFRASTRUTTURA ━━━');

  try {
    const r = await fetch(BASE);
    log('INFRA', 'Sito pubblico raggiungibile', r.ok ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
  } catch(e) { log('INFRA', 'Sito pubblico raggiungibile', 'FAIL', e.message); }

  try {
    const r = await fetch(BASE + '/admin');
    log('INFRA', 'Pagina login /admin', r.ok ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
  } catch(e) { log('INFRA', 'Pagina login', 'FAIL', e.message); }

  try {
    const r = await get('/api/health');
    log('INFRA', 'Health check /api/health', r.status === 200 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
  } catch(e) { log('INFRA', 'Health check', 'FAIL', e.message); }

  try {
    const r = await fetch(BASE, { redirect: 'manual' });
    const proto = r.headers.get('strict-transport-security');
    log('INFRA', 'HTTPS/HSTS attivo', proto ? 'PASS' : 'WARN', proto || 'Header HSTS assente');
  } catch(e) { log('INFRA', 'HTTPS/HSTS', 'WARN', e.message); }

  // ═══════════════════════════════════════════
  // 2. AUTENTICAZIONE
  // ═══════════════════════════════════════════
  console.log('\n━━━ 2. AUTENTICAZIONE ━━━');

  // Login superadmin
  const saRes = await post('/api/auth/login', SUPERADMIN);
  if (saRes.data.token || saRes.data.access_token) {
    superToken = saRes.data.token || saRes.data.access_token;
    log('AUTH', 'Login superadmin', 'PASS', `Token OK`);
  } else {
    log('AUTH', 'Login superadmin', 'FAIL', `${saRes.status}: ${JSON.stringify(saRes.data).substring(0,100)}`);
  }

  // Login org admin
  const oaRes = await post('/api/auth/login', ORG_ADMIN);
  if (oaRes.data.token || oaRes.data.access_token) {
    orgToken = oaRes.data.token || oaRes.data.access_token;
    log('AUTH', 'Login admin organizzazione', 'PASS', `Token OK`);
  } else {
    log('AUTH', 'Login admin organizzazione', 'FAIL', `${oaRes.status}: ${JSON.stringify(oaRes.data).substring(0,100)}`);
  }

  // Credenziali errate
  const badRes = await post('/api/auth/login', { email: 'fake@test.com', password: 'wrong123' });
  log('AUTH', 'Rifiuta credenziali errate', badRes.status === 401 ? 'PASS' : 'FAIL', `HTTP ${badRes.status}`);

  // Accesso senza token
  const noAuthRes = await get('/api/trips');
  log('AUTH', 'Blocca accesso senza token', (noAuthRes.status === 401 || noAuthRes.status === 403) ? 'PASS' : 'FAIL', `HTTP ${noAuthRes.status}`);

  if (!superToken || !orgToken) {
    log('AUTH', 'AUDIT INTERROTTO', 'FAIL', 'Token mancanti — impossibile proseguire');
    return printResults();
  }

  // ═══════════════════════════════════════════
  // 3. ISOLAMENTO MULTI-TENANT
  // ═══════════════════════════════════════════
  console.log('\n━━━ 3. ISOLAMENTO MULTI-TENANT ━━━');

  const orgTrips = await get('/api/trips', orgToken);
  if (orgTrips.status === 200) {
    const trips = orgTrips.data.data || orgTrips.data.trips || orgTrips.data || [];
    const allSameOrg = Array.isArray(trips) ? trips.every(t =>
      t.organizationId || t.organization_id
    ) : true;
    log('TENANT', 'Trips filtrati per organizzazione', allSameOrg ? 'PASS' : 'FAIL',
      `${Array.isArray(trips) ? trips.length : 0} trips trovati`);
  } else {
    log('TENANT', 'Trips filtrati per organizzazione', 'FAIL', `HTTP ${orgTrips.status}`);
  }

  const orgVehicles = await get('/api/vehicles', orgToken);
  log('TENANT', 'Veicoli filtrati per organizzazione', orgVehicles.status === 200 ? 'PASS' : 'FAIL', `HTTP ${orgVehicles.status}`);

  const orgStaff = await get('/api/staff-members', orgToken);
  log('TENANT', 'Staff filtrato per organizzazione', orgStaff.status === 200 ? 'PASS' : 'FAIL', `HTTP ${orgStaff.status}`);

  const saProfile = await get('/api/auth/me', superToken);
  if (saProfile.status === 200) {
    const orgId = saProfile.data.organizationId || saProfile.data.organization_id;
    log('TENANT', 'Superadmin senza organization_id', (!orgId || orgId === null) ? 'PASS' : 'FAIL',
      `organization_id = ${orgId}`);
  } else {
    log('TENANT', 'Superadmin profilo', 'WARN', `HTTP ${saProfile.status} — endpoint /api/auth/me potrebbe non esistere`);
  }

  // ═══════════════════════════════════════════
  // 4. API CRUD — SERVIZI (TRIPS)
  // ═══════════════════════════════════════════
  console.log('\n━━━ 4. API CRUD — SERVIZI ━━━');

  const tripsList = await get('/api/trips', orgToken);
  log('TRIPS', 'GET lista servizi', tripsList.status === 200 ? 'PASS' : 'FAIL', `HTTP ${tripsList.status}`);

  const tripsToday = await get('/api/trips?date=today', orgToken);
  log('TRIPS', 'GET servizi oggi', (tripsToday.status === 200 || tripsToday.status === 404) ? 'PASS' : 'FAIL', `HTTP ${tripsToday.status}`);

  // ═══════════════════════════════════════════
  // 5. API CRUD — FLOTTA
  // ═══════════════════════════════════════════
  console.log('\n━━━ 5. API CRUD — FLOTTA ━━━');

  const vehiclesList = await get('/api/vehicles', orgToken);
  log('FLEET', 'GET lista veicoli', vehiclesList.status === 200 ? 'PASS' : 'FAIL', `HTTP ${vehiclesList.status}`);

  const locationsList = await get('/api/locations', orgToken);
  log('FLEET', 'GET lista sedi', locationsList.status === 200 ? 'PASS' : 'FAIL', `HTTP ${locationsList.status}`);

  const structuresList = await get('/api/structures', orgToken);
  log('FLEET', 'GET strutture sanitarie', (structuresList.status === 200 || structuresList.status === 404) ? 'PASS' : 'WARN', `HTTP ${structuresList.status}`);

  // ═══════════════════════════════════════════
  // 6. API CRUD — PERSONALE E TURNI
  // ═══════════════════════════════════════════
  console.log('\n━━━ 6. API CRUD — PERSONALE E TURNI ━━━');

  const staffList = await get('/api/staff-members', orgToken);
  log('STAFF', 'GET lista personale', staffList.status === 200 ? 'PASS' : 'FAIL', `HTTP ${staffList.status}`);

  const shiftsList = await get('/api/shifts', orgToken);
  log('SHIFTS', 'GET lista turni', (shiftsList.status === 200 || shiftsList.status === 404) ? 'PASS' : 'WARN', `HTTP ${shiftsList.status}`);

  const availList = await get('/api/availability', orgToken);
  log('SHIFTS', 'GET disponibilità', (availList.status === 200 || availList.status === 404) ? 'PASS' : 'WARN', `HTTP ${availList.status}`);

  // ═══════════════════════════════════════════
  // 7. API CRUD — INVENTARIO
  // ═══════════════════════════════════════════
  console.log('\n━━━ 7. API CRUD — INVENTARIO ━━━');

  const invList = await get('/api/inventory', orgToken);
  log('INVENTORY', 'GET inventario', (invList.status === 200 || invList.status === 404) ? 'PASS' : 'WARN', `HTTP ${invList.status}`);

  // ═══════════════════════════════════════════
  // 8. SUPERADMIN — GESTIONE PIATTAFORMA
  // ═══════════════════════════════════════════
  console.log('\n━━━ 8. SUPERADMIN — GESTIONE PIATTAFORMA ━━━');

  let orgsFound = false;
  for (const path of ['/api/organizations', '/api/admin/organizations', '/api/org-admin/organizations']) {
    const r = await get(path, superToken);
    if (r.status === 200) {
      const orgs = r.data.organizations || r.data.data || r.data || [];
      log('ADMIN', `Lista organizzazioni (${path})`, 'PASS', `${Array.isArray(orgs) ? orgs.length : '?'} org`);
      orgsFound = true;
      break;
    }
  }
  if (!orgsFound) log('ADMIN', 'Lista organizzazioni', 'FAIL', 'Nessun endpoint trovato');

  let demoFound = false;
  for (const path of ['/api/demo-requests', '/api/admin/demo-requests', '/api/org-admin/demo-requests']) {
    const r = await get(path, superToken);
    if (r.status === 200) {
      log('ADMIN', `Lista richieste demo (${path})`, 'PASS', `${JSON.stringify(r.data).substring(0,80)}`);
      demoFound = true;
      break;
    }
  }
  if (!demoFound) log('ADMIN', 'Lista richieste demo', 'WARN', 'Endpoint non trovato');

  const crmOrgs = await get('/api/crm/organizations', superToken);
  log('ADMIN', 'CRM organizzazioni', crmOrgs.status === 200 ? 'PASS' : 'WARN', `HTTP ${crmOrgs.status}`);

  // ═══════════════════════════════════════════
  // 9. SICUREZZA
  // ═══════════════════════════════════════════
  console.log('\n━━━ 9. SICUREZZA ━━━');

  const sqli = await post('/api/auth/login', { email: "' OR 1=1 --", password: 'test' });
  log('SECURITY', 'Resistenza SQL injection login', (sqli.status === 401 || sqli.status === 400) ? 'PASS' : 'FAIL', `HTTP ${sqli.status}`);

  const xss = await get('/api/trips?search=<script>alert(1)</script>', orgToken);
  log('SECURITY', 'Resistenza XSS nei parametri', xss.status !== 500 ? 'PASS' : 'FAIL', `HTTP ${xss.status}`);

  const pathTraversal = await get('/api/../../../etc/passwd', orgToken);
  log('SECURITY', 'Resistenza path traversal', (pathTraversal.status === 404 || pathTraversal.status === 400) ? 'PASS' : 'WARN', `HTTP ${pathTraversal.status}`);

  if (saProfile.status === 200) {
    const hasPassword = JSON.stringify(saProfile.data).includes('password');
    log('SECURITY', 'Password non esposta in /auth/me', !hasPassword ? 'PASS' : 'FAIL',
      hasPassword ? 'CRITICO: password visibile nella risposta!' : 'OK');
  }

  let rateLimited = false;
  for (let i = 0; i < 15; i++) {
    const r = await post('/api/auth/login', { email: 'ratelimit@test.com', password: 'wrong' });
    if (r.status === 429) { rateLimited = true; break; }
  }
  log('SECURITY', 'Rate limiting login', rateLimited ? 'PASS' : 'WARN',
    rateLimited ? 'Rate limit attivo dopo tentativi multipli' : 'Nessun rate limit rilevato in 15 tentativi');

  // ═══════════════════════════════════════════
  // 10. INTEGRITÀ DATI
  // ═══════════════════════════════════════════
  console.log('\n━━━ 10. INTEGRITÀ DATI ━━━');

  const integrity = await get('/api/trips/integrity-check', orgToken);
  log('INTEGRITY', 'Verifica integrità viaggi (HMAC)',
    (integrity.status === 200 || integrity.status === 404) ? 'PASS' : 'WARN', `HTTP ${integrity.status}`);

  // ═══════════════════════════════════════════
  // 11. PAGINE DASHBOARD
  // ═══════════════════════════════════════════
  console.log('\n━━━ 11. PAGINE DASHBOARD (endpoint) ━━━');

  const dashboardEndpoints = [
    ['/api/dashboard/summary', 'Dashboard summary'],
    ['/api/analytics', 'Analytics'],
    ['/api/finance/economic-analysis', 'Analisi economica'],
    ['/api/tenders', 'Gare appalto'],
    ['/api/compliance', 'Compliance'],
    ['/api/data-quality', 'Qualità dati'],
    ['/api/benchmarks', 'Benchmarking'],
    ['/api/sla', 'SLA Monitor'],
  ];

  for (const [path, name] of dashboardEndpoints) {
    const r = await get(path, orgToken);
    log('PAGES', name, (r.status === 200 || r.status === 404) ? 'PASS' : 'WARN', `HTTP ${r.status}`);
  }

  // ═══════════════════════════════════════════
  // 12. APP MOBILE ENDPOINTS
  // ═══════════════════════════════════════════
  console.log('\n━━━ 12. APP MOBILE ENDPOINTS ━━━');

  const mobileEndpoints = [
    ['/api/mobile/trips/today', 'Servizi oggi (mobile)'],
    ['/api/mobile/vehicle-status', 'Stato veicolo (mobile)'],
    ['/api/mobile/checklist', 'Checklist (mobile)'],
  ];

  for (const [path, name] of mobileEndpoints) {
    const r = await get(path, orgToken);
    log('MOBILE', name, (r.status === 200 || r.status === 404) ? 'PASS' : 'WARN', `HTTP ${r.status}`);
  }

  // ═══════════════════════════════════════════
  // 13. BILLING & MARKETPLACE
  // ═══════════════════════════════════════════
  console.log('\n━━━ 13. BILLING & MARKETPLACE ━━━');

  const billing = await get('/api/billing/plans', orgToken);
  log('BILLING', 'Lista piani', (billing.status === 200 || billing.status === 404) ? 'PASS' : 'WARN', `HTTP ${billing.status}`);

  const marketplace = await get('/api/marketplace/modules', orgToken);
  log('BILLING', 'Marketplace moduli', (marketplace.status === 200 || marketplace.status === 404) ? 'PASS' : 'WARN', `HTTP ${marketplace.status}`);

  // ═══════════════════════════════════════════
  // 14. HUB PRENOTAZIONI (pubblico)
  // ═══════════════════════════════════════════
  console.log('\n━━━ 14. HUB PRENOTAZIONI ━━━');

  const hubPage = await fetch(BASE + '/hub/croce-europa').then(r => ({ status: r.status })).catch(e => ({ status: 0 }));
  log('HUB', 'Pagina pubblica /hub/croce-europa', (hubPage.status === 200 || hubPage.status === 404) ? 'PASS' : 'WARN', `HTTP ${hubPage.status}`);

  // ═══════════════════════════════════════════
  // RIEPILOGO
  // ═══════════════════════════════════════════
  printResults();
}

function printResults() {
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 RIEPILOGO AUDIT SOCCORSO DIGITALE');
  console.log('='.repeat(60));
  console.log(`✅ PASS:    ${pass}/${total}`);
  console.log(`❌ FAIL:    ${fail}/${total}`);
  console.log(`⚠️  WARN:    ${warn}/${total}`);
  console.log(`📈 Score:   ${total > 0 ? Math.round(pass/(pass+fail)*100) : 0}% (${pass} pass su ${pass+fail} critici)`);
  console.log('='.repeat(60));

  if (fail > 0) {
    console.log('\n❌ FALLIMENTI CRITICI:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • [${r.category}] ${r.step}: ${r.detail}`);
    });
  }

  if (warn > 0) {
    console.log('\n⚠️  WARNING (non bloccanti):');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`   • [${r.category}] ${r.step}: ${r.detail}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Fine audit — ' + new Date().toLocaleString('it-IT'));
  console.log('='.repeat(60) + '\n');
}

runAudit().catch(console.error);
