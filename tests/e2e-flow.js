const BASE = 'https://soccorsodigitale.app';
const SUPERADMIN = { email: 'superadmin@soccorsodigitale.app', password: 'SoccorsoDigitale2026!' };
let results = [];

function log(step, status, detail = '') {
  const icon = status === 'OK' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const msg = `${icon} ${step}${detail ? ': ' + detail : ''}`;
  console.log(msg);
  results.push({ step, status, detail });
}

async function post(url, body, token) {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function get(url, token) {
  const res = await fetch(BASE + url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function runTests() {
  console.log('\n🚀 SOCCORSO DIGITALE — Test E2E Completo');
  console.log('='.repeat(50));
  console.log(`📍 Target: ${BASE}`);
  console.log(`🕐 Avviato: ${new Date().toLocaleString('it-IT')}\n`);

  // ─────────────────────────────────────────
  // FASE 1 — Sito pubblico raggiungibile
  // ─────────────────────────────────────────
  console.log('📋 FASE 1: Sito Pubblico');
  try {
    const res = await fetch(BASE);
    log('Sito pubblico', res.ok ? 'OK' : 'FAIL', `HTTP ${res.status}`);
  } catch(e) { log('Sito pubblico', 'FAIL', e.message); }

  try {
    const res = await fetch(BASE + '/admin');
    log('Login page /admin', res.ok ? 'OK' : 'FAIL', `HTTP ${res.status}`);
  } catch(e) { log('Login page', 'FAIL', e.message); }

  // ─────────────────────────────────────────
  // FASE 2 — Richiesta demo dal sito
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 2: Richiesta Demo');
  const demoData = {
    organizationName: `Test Org ${Date.now()}`,
    contactName: 'Mario Rossi Test',
    contactEmail: `test.${Date.now()}@testorg.it`,
    contactPhone: '+39 333 1234567',
    city: 'Verona',
    province: 'VR',
    vehicleCount: 3,
    notes: 'Test automatico E2E',
  };

  let demoRequestId = null;
  try {
    // POST /api/demo-requests (public, no auth)
    const r = await post('/api/demo-requests', demoData);
    if (r.status === 201 && r.data.id) {
      demoRequestId = r.data.id;
      log('Richiesta demo', 'OK', `ID: ${demoRequestId}`);
    } else {
      log('Richiesta demo', 'FAIL', `${r.status}: ${JSON.stringify(r.data)}`);
    }
  } catch(e) { log('Richiesta demo', 'FAIL', e.message); }

  // ─────────────────────────────────────────
  // FASE 3 — Login Superadmin
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 3: Login Superadmin');
  let superToken = null;
  try {
    const r = await post('/api/auth/login', SUPERADMIN);
    if (r.data.token || r.data.access_token) {
      superToken = r.data.token || r.data.access_token;
      log('Login superadmin', 'OK', `Token: ${superToken.substring(0,20)}...`);
    } else {
      log('Login superadmin', 'FAIL', JSON.stringify(r.data));
    }
  } catch(e) { log('Login superadmin', 'FAIL', e.message); }

  if (!superToken) {
    log('TEST INTERROTTO', 'FAIL', 'Impossibile proseguire senza token superadmin');
    return printSummary();
  }

  // ─────────────────────────────────────────
  // FASE 4 — Lista organizzazioni (superadmin)
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 4: Gestione Organizzazioni');
  let orgId = null;
  try {
    // GET /api/admin/organizations — returns array directly
    const r = await get('/api/admin/organizations', superToken);
    const orgs = Array.isArray(r.data) ? r.data : (r.data.organizations || []);
    log('Lista organizzazioni', r.status === 200 ? 'OK' : 'FAIL', `${orgs.length} org trovate`);
    if (orgs.length > 0) {
      // Pick first non-demo active org for subsequent tests
      const active = orgs.find(o => o.status === 'active' && !o.isDemo) || orgs[0];
      orgId = active.id;
      log('Org selezionata', 'OK', `ID: ${orgId}, Nome: ${active.name}`);
    }
  } catch(e) { log('Lista organizzazioni', 'FAIL', e.message); }

  // Lista richieste demo pending
  try {
    const r = await get('/api/org-admin/demo-requests', superToken);
    const pending = Array.isArray(r.data) ? r.data.filter(d => d.status === 'pending') : [];
    log('Demo pending', r.status === 200 ? 'OK' : 'WARN', `${pending.length} richieste pending`);
  } catch(e) { log('Demo pending', 'WARN', e.message); }

  // ─────────────────────────────────────────
  // FASE 5 — Approvazione demo
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 5: Approvazione Demo');
  let orgAdminEmail = null;
  let orgAdminPassword = null;

  if (demoRequestId) {
    try {
      // POST /api/super-admin/demo-requests/:id/approve
      const r = await post(`/api/super-admin/demo-requests/${demoRequestId}/approve`, {}, superToken);
      if (r.status === 200 && r.data.success) {
        orgAdminEmail = r.data.demoResult?.email;
        orgAdminPassword = r.data.demoResult?.password;
        log('Approvazione demo', 'OK', `Credenziali: ${orgAdminEmail}`);
      } else {
        log('Approvazione demo', 'FAIL', `${r.status}: ${JSON.stringify(r.data)}`);
      }
    } catch(e) { log('Approvazione demo', 'FAIL', e.message); }
  } else {
    log('Approvazione demo', 'SKIP', 'Nessun demoRequestId — uso org esistente');
  }

  // ─────────────────────────────────────────
  // FASE 6 — Login come admin organizzazione
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 6: Login Admin Organizzazione');
  let orgToken = null;

  const orgCredentials = orgAdminEmail
    ? { email: orgAdminEmail, password: orgAdminPassword }
    : { email: 'admin@croceeuropa.com', password: 'Admin2026!' };

  try {
    const r = await post('/api/auth/login', orgCredentials);
    if (r.data.token || r.data.access_token) {
      orgToken = r.data.token || r.data.access_token;
      log('Login admin org', 'OK', `Loggato come ${orgCredentials.email}`);
    } else {
      log('Login admin org', 'FAIL', JSON.stringify(r.data));
    }
  } catch(e) { log('Login admin org', 'FAIL', e.message); }

  const token = orgToken || superToken;

  // ─────────────────────────────────────────
  // FASE 7 — Registrazione veicolo
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 7: Registrazione Veicoli');

  // Recupera la sede principale dell'org prima di creare il veicolo
  let locationId = null;
  try {
    const locRes = await get('/api/locations', token);
    const locs = Array.isArray(locRes.data) ? locRes.data : (locRes.data.locations || []);
    if (locs.length > 0) {
      locationId = locs[0].id;
      log('Sede trovata', 'OK', `ID: ${locationId}, Nome: ${locs[0].name || locs[0].address || '—'}`);
    } else {
      log('Sede trovata', 'WARN', 'Nessuna sede — il server userà il default automatico');
    }
  } catch(e) { log('Sede trovata', 'WARN', e.message); }

  let vehicleId = null;
  const vehicleData = {
    code: `TEST-${Date.now()}`,
    licensePlate: 'AB123CD',
    brand: 'Fiat',
    model: 'Ducato',
    fuelType: 'Gasolio',
    currentKm: 0,
    ...(locationId ? { locationId } : {}),
  };

  try {
    const r = await post('/api/vehicles', vehicleData, token);
    if (r.status === 200 || r.status === 201) {
      vehicleId = r.data.id || r.data.vehicle?.id;
      log('Crea veicolo', 'OK', `ID: ${vehicleId}, Targa: ${vehicleData.licensePlate}`);
    } else {
      log('Crea veicolo', 'FAIL', `${r.status}: ${JSON.stringify(r.data)}`);
    }
  } catch(e) { log('Crea veicolo', 'FAIL', e.message); }

  try {
    const r = await get('/api/vehicles', token);
    const vehicles = Array.isArray(r.data) ? r.data : (r.data.vehicles || []);
    log('Lista veicoli', r.status === 200 ? 'OK' : 'FAIL', `${vehicles.length} veicoli`);
  } catch(e) { log('Lista veicoli', 'FAIL', e.message); }

  // ─────────────────────────────────────────
  // FASE 8 — Creazione servizio
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 8: Creazione Servizio');
  let serviceId = null;
  const serviceData = {
    serviceDate: new Date().toISOString().split('T')[0],
    departureTime: '10:00',
    returnTime: '12:00',
    serviceType: 'dialisi',
    originAddress: 'Via Roma 1, Verona',
    destinationAddress: 'Ospedale Borgo Roma, Verona',
    estimatedKm: 15,
    ...(vehicleId ? { vehicleId } : {}),
    status: 'scheduled',
  };

  try {
    const r = await post('/api/scheduled-services', serviceData, token);
    if (r.status === 200 || r.status === 201) {
      serviceId = r.data.id || r.data.service?.id;
      log('Crea servizio', 'OK', `ID: ${serviceId}`);
    } else {
      log('Crea servizio', 'FAIL', `${r.status}: ${JSON.stringify(r.data)}`);
    }
  } catch(e) { log('Crea servizio', 'FAIL', e.message); }

  // ─────────────────────────────────────────
  // FASE 9 — Verifica dashboard
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 9: Verifica Dashboard');

  // /api/compliance/stats è il più ricco di metriche aggregate per org
  try {
    const r = await get('/api/compliance/stats', token);
    log('Stats compliance', r.status === 200 ? 'OK' : 'FAIL', `HTTP ${r.status}`);
  } catch(e) { log('Stats compliance', 'FAIL', e.message); }

  try {
    const r = await get('/api/scheduled-services?limit=5', token);
    const services = Array.isArray(r.data) ? r.data : (r.data.services || []);
    log('Servizi in dashboard', r.status === 200 ? 'OK' : 'FAIL', `${services.length} servizi visibili`);
  } catch(e) { log('Servizi dashboard', 'FAIL', e.message); }

  // Verifica che il servizio appena creato sia recuperabile
  if (serviceId) {
    try {
      const r = await get(`/api/scheduled-services/${serviceId}`, token);
      log('Servizio recuperabile per ID', r.status === 200 ? 'OK' : 'FAIL', `HTTP ${r.status}`);
    } catch(e) { log('Servizio per ID', 'FAIL', e.message); }
  }

  // ─────────────────────────────────────────
  // FASE 10 — Health check API critiche
  // ─────────────────────────────────────────
  console.log('\n📋 FASE 10: Health Check Endpoint Critici');
  const endpoints = [
    ['/api/vehicles', 'Veicoli'],
    ['/api/scheduled-services', 'Servizi'],
    ['/api/locations', 'Sedi'],
    ['/api/trips', 'Viaggi/Servizi completati'],
    ['/api/integrity/stats', 'Integrità dati'],
  ];

  for (const [url, name] of endpoints) {
    try {
      const r = await get(url, token);
      log(name, r.status === 200 ? 'OK' : r.status === 404 ? 'WARN' : 'FAIL', `HTTP ${r.status}`);
    } catch(e) { log(name, 'FAIL', e.message); }
  }

  printSummary();
}

function printSummary() {
  const ok = results.filter(r => r.status === 'OK').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN' || r.status === 'SKIP').length;

  console.log('\n' + '='.repeat(50));
  console.log('📊 RIEPILOGO TEST');
  console.log('='.repeat(50));
  console.log(`✅ Superati: ${ok}`);
  console.log(`❌ Falliti:  ${fail}`);
  console.log(`⚠️  Warning: ${warn}`);
  console.log(`📈 Score:    ${Math.round(ok/(ok+fail)*100) || 0}%`);

  if (fail > 0) {
    console.log('\n❌ FALLITI:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.step}: ${r.detail}`);
    });
  }
  console.log('='.repeat(50) + '\n');
}

runTests().catch(console.error);
