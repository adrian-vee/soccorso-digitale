#!/usr/bin/env node
/**
 * Aggiorna i 3 template email con nuovi contenuti
 * mantenendo struttura grafica invariata (logo base64, header, footer, download).
 */
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:oQbQTHEtQdNxfcSrNiyQjfNvwvZWaSJo@caboose.proxy.rlwy.net:28423/railway',
  ssl: { rejectUnauthorized: false }
});

// ─── LOAD STRUCTURAL PARTS FROM CURRENT DB ────────────────────────────────────

const b64 = fs.readFileSync('/tmp/tpl_b64.txt', 'utf8').trim();
const headerBlock = fs.readFileSync('/tmp/tpl_header.html', 'utf8');
const downloadBlock = fs.readFileSync('/tmp/tpl_download.html', 'utf8');
const footerBlock = fs.readFileSync('/tmp/tpl_footer.html', 'utf8');
const wrapperOpen = fs.readFileSync('/tmp/tpl_wrapper_open.html', 'utf8');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function hero(soprattitolo, titolo, introHtml) {
  return `<div style="background:#0C1A2E;padding:48px 40px 44px;">
  <div style="font-size:11px;font-weight:600;color:#5EB0BB;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px;">${soprattitolo}</div>
  <h1 style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;margin:0 0 16px;letter-spacing:-0.4px;">${titolo}</h1>
  <p style="font-size:14px;color:#94A3B8;margin:0;line-height:1.6;">${introHtml}</p>
</div>`;
}

function checkItem(title, desc) {
  return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #f5f5f5;">
  <div style="width:20px;height:20px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
    <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#1E3A8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
  </div>
  <div>
    <div style="font-size:13px;font-weight:600;color:#0C1A2E;margin-bottom:2px;">${title}</div>
    <div style="font-size:12px;color:#6B7280;line-height:1.5;">${desc}</div>
  </div>
</div>`;
}

function highlightBox(title, text) {
  return `<div style="background:#F0F4FF;border-radius:8px;padding:20px 24px;margin-bottom:28px;border-left:3px solid #1E3A8A;">
  <div style="font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">${title}</div>
  <div style="font-size:13px;color:#374151;line-height:1.5;">${text}</div>
</div>`;
}

function ctaBlock(url, label, sub) {
  return `<div style="text-align:center;margin-bottom:8px;">
  <a href="${url}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:7px;font-size:14px;font-weight:600;">${label}</a>
</div>
<div style="text-align:center;margin-bottom:28px;">
  <span style="font-size:12px;color:#9CA3AF;">${sub}</span>
</div>`;
}

function sectionLabel(text) {
  return `<div style="font-size:11px;font-weight:700;color:#64748B;letter-spacing:0.08em;text-transform:uppercase;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #E2E8F0;">${text}</div>`;
}

function miniCardGrid(cards) {
  const cardHtml = cards.map(c => `<div style="background:#F8FAFC;border-radius:8px;padding:14px 16px;border:1px solid #E2E8F0;">
  <div style="font-size:12px;font-weight:700;color:#0C1A2E;margin-bottom:4px;">${c.title}</div>
  <div style="font-size:11px;color:#6B7280;line-height:1.5;">${c.desc}</div>
</div>`).join('\n');
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">\n${cardHtml}\n</div>`;
}

function body(inner) {
  return `<div style="padding:36px 40px;">${inner}</div>`;
}

function wrap(heroHtml, bodyHtml) {
  return wrapperOpen + headerBlock + heroHtml + bodyHtml + '</div>\n</div>';
}

// ─── TEMPLATE 1: INTRO ────────────────────────────────────────────────────────

const introHeroHtml = hero(
  'La piattaforma per il soccorso moderno',
  'La tua organizzazione connessa, dalla dashboard all\'ambulanza',
  'Ciao <strong style="color:#ffffff;">{{org_name}}</strong>, ti presentiamo la piattaforma italiana che connette in tempo reale la tua centrale operativa con ogni mezzo in servizio.'
);

const introBodyHtml = body(`
${highlightBox(
  'Dashboard + App = un ecosistema unico',
  'Tutto quello che configuri nella dashboard è immediatamente visibile sull\'app installata nel telefono del mezzo. In tempo reale, senza intermediari.'
)}

${sectionLabel('App installata nel telefono del mezzo')}

${checkItem(
  'Checklist mezzo direttamente in app',
  'L\'equipaggio completa la checklist direttamente dal telefono del mezzo. Promemoria automatici prima di ogni turno. Storico verifiche sempre disponibile.'
)}
${checkItem(
  'Documenti del mezzo con avvisi scadenza',
  'Revisioni, assicurazioni, collaudi — tutto nell\'app del mezzo. Notifica push automatica prima della scadenza. Zero sorprese, zero verbali.'
)}
${checkItem(
  'Tessera carburante + prezzo in tempo reale',
  'Prezzo carburante aggiornato del giorno, confronto con la media provinciale e stime consumo per ogni mezzo. Analisi economica immediata.'
)}
${checkItem(
  'Notifiche push per scadenze materiali',
  'Farmaci, presidi, materiali di bordo — l\'app avvisa prima che qualcosa scada. Controllo automatico ad ogni turno.'
)}
${checkItem(
  'Servizi caricati dalla dashboard, visibili in app',
  'La centrale carica il programma giornaliero dalla dashboard. L\'equipaggio lo vede sull\'app del mezzo prima ancora di partire.'
)}

${sectionLabel('Dashboard centrale operativa')}

${miniCardGrid([
  { title: 'HUB Prenotazioni', desc: 'Portale privato per servizi a pagamento. Link condivisibile con i tuoi clienti.' },
  { title: 'Statistiche operative', desc: 'KM percorsi, tempi intervento, copertura turni. Report PDF in un click.' },
  { title: 'Analisi economica', desc: 'Costi per mezzo, consumo carburante, accise UTIF. Tutto calcolato in automatico.' },
  { title: 'Scadenze materiali', desc: 'Inventario con alert automatici. Nessun materiale scaduto a bordo.' },
])}

${highlightBox(
  'Prova gratuita di 7 giorni',
  'Nessuna carta di credito richiesta. Attivazione immediata con supporto dedicato.'
)}

${ctaBlock(
  'https://soccorsodigitale.app/register',
  'Inizia la prova gratuita',
  'Nessuna carta di credito · Attivazione immediata'
)}

${downloadBlock}
`);

const template1 = wrap(introHeroHtml, introBodyHtml) + '\n</div>\n</div>';

// ─── TEMPLATE 2: FOLLOWUP ─────────────────────────────────────────────────────

const followupHeroHtml = hero(
  'Seguito alla nostra presentazione',
  'Hai avuto modo di esplorare la piattaforma?',
  'Ciao <strong style="color:#ffffff;">{{org_name}}</strong>, qualche giorno fa ti abbiamo scritto di Soccorso Digitale. Volevamo sapere se hai avuto modo di dare un\'occhiata.'
);

const followupBodyHtml = body(`
<p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px;">
  Sappiamo che il tempo è poco. Per questo abbiamo pensato a una demo di 30 minuti su misura per <strong>{{org_name}}</strong>: ti mostriamo solo le funzionalità che contano per la tua realtà operativa — dall'app installata nel telefono del mezzo alle statistiche della centrale.
</p>

${highlightBox(
  'Demo gratuita di 30 minuti',
  'Ti configuriamo la piattaforma in diretta e rispondiamo a tutte le tue domande. Nessun impegno.'
)}

${ctaBlock(
  'https://soccorsodigitale.app/demo',
  'Prenota la tua demo gratuita',
  'Senza impegno · 30 minuti · Online'
)}

${downloadBlock}
`);

const template2 = wrap(followupHeroHtml, followupBodyHtml) + '\n</div>\n</div>';

// ─── TEMPLATE 3: DEMO INVITE ──────────────────────────────────────────────────

const demoHeroHtml = hero(
  'Demo personalizzata per {{org_name}}',
  'Costruiamo insieme la soluzione per la tua organizzazione',
  'Ciao <strong style="color:#ffffff;">{{org_name}}</strong>, abbiamo preparato una demo personalizzata per organizzazioni come la tua in {{region}}. Ti mostriamo come funziona nella pratica quotidiana.'
);

const demoBodyHtml = body(`
${checkItem(
  'App nel telefono del mezzo, connessa alla dashboard',
  'Checklist, documenti, servizi del giorno — tutto sincronizzato in tempo reale tra centrale e ambulanza.'
)}
${checkItem(
  'Monitoraggio flotta e scadenze automatico',
  'Revisioni, materiali, carburante — avvisi prima che scada qualcosa. Zero controlli manuali.'
)}
${checkItem(
  'HUB prenotazioni per servizi privati',
  'Portale dedicato per trasporti privati e dialisi. I pazienti prenotano online, tu gestisci dalla dashboard.'
)}
${checkItem(
  'Statistiche operative e analisi economica',
  'KM, costi, accise UTIF, consumo carburante. Report pronti in un click per la direzione.'
)}

<div style="margin-top:8px;"></div>

${highlightBox(
  '30 minuti, configurata per {{org_name}}',
  'Demo live con la piattaforma già impostata per la tua regione e il tuo tipo di organizzazione.'
)}

${ctaBlock(
  'https://soccorsodigitale.app/demo',
  'Prenota la tua demo',
  'Senza impegno · 30 minuti · Online'
)}

${downloadBlock}
`);

const template3 = wrap(demoHeroHtml, demoBodyHtml) + '\n</div>\n</div>';

// ─── DB UPDATE ────────────────────────────────────────────────────────────────

async function run() {
  const updates = [
    { category: 'intro',       html: template1 },
    { category: 'followup',    html: template2 },
    { category: 'demo_invite', html: template3 },
  ];

  for (const { category, html } of updates) {
    const res = await pool.query(
      `UPDATE crm_email_templates SET body_html = $1, updated_at = NOW() WHERE category = $2 RETURNING id, name`,
      [html, category]
    );
    if (res.rows.length === 0) {
      console.log(`⚠️  Nessun template trovato per category="${category}"`);
    } else {
      console.log(`✅  ${res.rows[0].name} — ${html.length} chars`);
    }
  }

  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
