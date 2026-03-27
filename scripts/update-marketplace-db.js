const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({
  connectionString: 'postgresql://postgres:oQbQTHEtQdNxfcSrNiyQjfNvwvZWaSJo@caboose.proxy.rlwy.net:28423/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // 1. Aggiorna prezzi sotto €20 → €20 (2000 centesimi)
  const updated = await pool.query(`
    UPDATE premium_modules SET
      price_monthly = 2000,
      price_yearly = 20000,
      updated_at = NOW()
    WHERE module_key IN ('photo_reporting', 'vehicle_documents', 'licenza_sede_aggiuntiva', 'licenza_utenti_extra')
    RETURNING module_key, name
  `);
  console.log('✅ Prezzi aggiornati a €20:', updated.rows.map(r => r.name));

  // 2. Inserisci 6 nuovi moduli
  const newModules = [
    {
      module_key: 'gps_tracking_avanzato',
      name: 'GPS Tracking Avanzato',
      description: 'Monitoraggio real-time posizione mezzi, storico percorsi, alert velocità, report chilometrici automatici',
      long_description: 'Monitora in tempo reale la posizione di tutti i tuoi mezzi su mappa interattiva. Accedi allo storico completo dei percorsi, imposta alert per velocità e zone, e genera automaticamente i report chilometrici mensili.',
      category: 'modulo',
      icon: 'map-pin',
      badge_text: 'OPERATIVO',
      badge_color: '#1E3A8A',
      price_monthly: 2000,
      price_yearly: 20000,
      billing_type: 'recurring',
      features: ['Posizione real-time su mappa', 'Storico percorsi illimitato', 'Alert velocità e zone', 'Report KM automatici'],
      sort_order: 22
    },
    {
      module_key: 'hub_prenotazioni_pazienti',
      name: 'Hub Prenotazioni Pazienti',
      description: 'Portale online per prenotazioni trasporti privati. Link condivisibile con pazienti e strutture sanitarie',
      long_description: 'Offri ai tuoi pazienti e alle strutture sanitarie partner un portale web dedicato per prenotare trasporti in autonomia. Gestisci gli slot di disponibilità e ricevi notifiche automatiche per ogni nuova prenotazione.',
      category: 'modulo',
      icon: 'calendar-check',
      badge_text: 'REVENUE',
      badge_color: '#166534',
      price_monthly: 2400,
      price_yearly: 24000,
      billing_type: 'recurring',
      features: ['Portale prenotazioni pubblico', 'Link condivisibile pazienti', 'Gestione slot disponibilità', 'Notifiche automatiche'],
      sort_order: 23
    },
    {
      module_key: 'gare_appalto_intelligence',
      name: "Gare d'Appalto Intelligence",
      description: 'Monitoraggio automatico bandi ANAC, alert scadenze, simulatore offerta, analisi competitiva per regione',
      long_description: 'Monitora automaticamente i bandi ANAC di tuo interesse, ricevi alert sulle scadenze e usa il simulatore per calcolare la tua offerta ottimale. Analizza la competizione per regione e migliora il tasso di aggiudicazione.',
      category: 'modulo',
      icon: 'file-text',
      badge_text: 'ENTERPRISE',
      badge_color: '#6B21A8',
      price_monthly: 2900,
      price_yearly: 29000,
      billing_type: 'recurring',
      features: ['Importazione automatica da ANAC', 'Alert scadenze bandi', 'Simulatore offerta economica', 'Mappa bandi per regione'],
      sort_order: 24
    },
    {
      module_key: 'analisi_economica_utif',
      name: 'Analisi Economica + Accise UTIF',
      description: "Calcolo automatico costi per mezzo e per servizio, rimborsi accise carburante, report UTIF trimestrale pronto per l'Agenzia delle Dogane. Tutto in un click.",
      long_description: "Ottimizza la gestione economica della tua organizzazione. Calcola automaticamente i costi per ogni mezzo e servizio, gestisci i rimborsi accise sul carburante e genera il report UTIF trimestrale pronto per l'Agenzia delle Dogane con un solo click.",
      category: 'modulo',
      icon: 'trending-up',
      badge_text: 'RISPARMIO',
      badge_color: '#854D0E',
      price_monthly: 2900,
      price_yearly: 29000,
      billing_type: 'recurring',
      features: ['Analisi costi per mezzo e servizio', 'Calcolo rimborsi accise automatico', 'Report UTIF trimestrale', 'Export per Agenzia delle Dogane'],
      sort_order: 25
    },
    {
      module_key: 'benessere_burnout',
      name: 'Benessere Personale + Burnout',
      description: 'Monitoraggio stress operatori, score burnout, alert precoce, survey benessere automatiche',
      long_description: 'Monitora il benessere del tuo personale con score individuali, ricevi alert precoci su situazioni di burnout e invia automaticamente survey periodiche per raccogliere feedback. Report mensile per la direzione incluso.',
      category: 'modulo',
      icon: 'heart',
      badge_text: 'WELFARE',
      badge_color: '#166534',
      price_monthly: 2000,
      price_yearly: 20000,
      billing_type: 'recurring',
      features: ['Score benessere per operatore', 'Alert burnout precoce', 'Survey automatiche periodiche', 'Report direzione'],
      sort_order: 26
    },
    {
      module_key: 'volontari_rimborsi',
      name: 'Registro Volontari + Rimborsi',
      description: 'Gestione anagrafica volontari, calcolo rimborsi automatico, esportazione per commercialista',
      long_description: 'Mantieni un registro completo dei tuoi volontari con calcolo automatico dei rimborsi. Esporta i dati in formato pronto per il commercialista e accedi allo storico completo di tutti i rimborsi erogati.',
      category: 'modulo',
      icon: 'users',
      badge_text: 'ADMIN',
      badge_color: '#475569',
      price_monthly: 2000,
      price_yearly: 20000,
      billing_type: 'recurring',
      features: ['Anagrafica volontari completa', 'Calcolo rimborsi automatico', 'Export per commercialista', 'Storico rimborsi'],
      sort_order: 27
    }
  ];

  for (const m of newModules) {
    const existing = await pool.query('SELECT id FROM premium_modules WHERE module_key = $1', [m.module_key]);
    if (existing.rows.length > 0) {
      console.log('⚠️  Già esiste, skip:', m.module_key);
      continue;
    }
    await pool.query(`
      INSERT INTO premium_modules
        (id, module_key, name, description, long_description, category, icon, badge_text, badge_color,
         price_monthly, price_yearly, billing_type, features, is_active, is_featured, is_visible, sort_order, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
    `, [
      randomUUID(), m.module_key, m.name, m.description, m.long_description,
      m.category, m.icon, m.badge_text, m.badge_color,
      m.price_monthly, m.price_yearly, m.billing_type, JSON.stringify(m.features),
      true, false, true, m.sort_order
    ]);
    console.log('✅ Inserito:', m.name, '€' + (m.price_monthly / 100) + '/mese');
  }

  // 3. Verifica finale
  const check = await pool.query(`
    SELECT name, price_monthly FROM premium_modules
    WHERE price_monthly > 0 AND price_monthly < 2000 AND billing_type = 'recurring'
    ORDER BY price_monthly
  `);
  if (check.rows.length > 0) {
    console.log('❌ Ancora prezzi < €20:', check.rows);
  } else {
    console.log('✅ Nessun prezzo < €20 nei moduli ricorrenti');
  }

  const total = await pool.query("SELECT count(*) FROM premium_modules WHERE is_active = true");
  console.log('Totale moduli attivi nel DB:', total.rows[0].count);

  pool.end();
}

run().catch(e => { console.error(e); pool.end(); });
