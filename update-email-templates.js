#!/usr/bin/env node
/**
 * Aggiorna i 3 template email CRM con il nuovo design professionale.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── SHARED PARTS ─────────────────────────────────────────────────────────────

const LOGO_URL = 'https://soccorsodigitale.app/images/webclip.png';

const header = `
<div style="background:#ffffff;padding:24px 40px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;">
  <div style="display:flex;align-items:center;gap:10px;">
    <img src="${LOGO_URL}" alt="Soccorso Digitale" width="32" height="32" style="border-radius:7px;display:block;">
    <span style="font-size:14px;font-weight:600;color:#0C1A2E;letter-spacing:-0.2px;">Soccorso Digitale</span>
  </div>
  <span style="font-size:11px;color:#94A3B8;letter-spacing:0.04em;">soccorsodigitale.app</span>
</div>`;

const downloadBlock = `
<div style="text-align:center;padding:20px 24px;background:#F8FAFC;border-radius:8px;margin-bottom:8px;">
  <p style="font-size:12px;color:#6B7280;margin:0 0 12px;">Scarica l'app per il tuo team</p>
  <a href="https://soccorsodigitale.app/download/SD2026APP" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:7px;font-size:13px;font-weight:600;">Scarica per Android</a>
  <p style="font-size:11px;color:#9CA3AF;margin:8px 0 0;">iOS disponibile prossimamente</p>
</div>`;

const footer = `
<div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:24px 40px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <img src="${LOGO_URL}" alt="Soccorso Digitale" width="22" height="22" style="border-radius:5px;display:block;">
      <span style="font-size:12px;font-weight:600;color:#374151;">Soccorso Digitale</span>
    </div>
    <div style="display:flex;gap:16px;">
      <a href="https://soccorsodigitale.app/privacy" style="font-size:11px;color:#6B7280;text-decoration:none;">Privacy</a>
      <a href="https://soccorsodigitale.app/termini" style="font-size:11px;color:#6B7280;text-decoration:none;">Termini</a>
      <a href="mailto:hello@soccorsodigitale.app" style="font-size:11px;color:#6B7280;text-decoration:none;">Supporto</a>
    </div>
  </div>
  <div style="border-top:1px solid #E2E8F0;padding-top:14px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:11px;color:#9CA3AF;">soccorsodigitale.app · hello@soccorsodigitale.app</span>
    <a href="{{unsubscribe_url}}" style="font-size:11px;color:#9CA3AF;text-decoration:none;">Cancella iscrizione</a>
  </div>
</div>`;

function hero(soprattitolo, titolo, introHtml) {
  return `
<div style="background:#0C1A2E;padding:48px 40px 44px;">
  <div style="font-size:11px;font-weight:600;color:#5EB0BB;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px;">${soprattitolo}</div>
  <h1 style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;margin:0 0 16px;letter-spacing:-0.4px;">${titolo}</h1>
  <p style="font-size:14px;color:#94A3B8;margin:0;line-height:1.6;">${introHtml}</p>
</div>`;
}

function checkmarkItem(title, description) {
  return `
<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #f5f5f5;">
  <div style="width:20px;height:20px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
    <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#1E3A8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
  </div>
  <div>
    <div style="font-size:13px;font-weight:600;color:#0C1A2E;margin-bottom:2px;">${title}</div>
    <div style="font-size:12px;color:#6B7280;">${description}</div>
  </div>
</div>`;
}

function ctaButton(url, text, sub) {
  return `
<div style="text-align:center;margin-bottom:8px;">
  <a href="${url}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:7px;font-size:14px;font-weight:600;">${text}</a>
</div>
<div style="text-align:center;margin-bottom:28px;">
  <span style="font-size:12px;color:#9CA3AF;">${sub}</span>
</div>`;
}

function highlightBox(title, text) {
  return `
<div style="background:#F0F4FF;border-radius:8px;padding:20px 24px;margin-bottom:28px;border-left:3px solid #1E3A8A;">
  <div style="font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">${title}</div>
  <div style="font-size:13px;color:#374151;line-height:1.5;">${text}</div>
</div>`;
}

function wrap(inner) {
  return `<div style="background:#f0f2f5;padding:40px 20px;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;margin:0;"><div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">${inner}</div></div>`;
}

// ─── TEMPLATE 1: INTRO ────────────────────────────────────────────────────────

const introBody = `
<div style="padding:36px 40px;">
  ${checkmarkItem('Turni e disponibilità dei volontari', 'Pianificazione automatica, gestione ferie')}
  ${checkmarkItem('Flotta veicoli e documenti', 'Scadenze, manutenzioni sempre sotto controllo')}
  ${checkmarkItem('Report e statistiche operative', 'Dati in tempo reale, esportazione PDF ed Excel')}
  ${checkmarkItem('Hub prenotazioni per i pazienti', 'Portale dedicato per trasporti programmati')}
  <div style="margin-top:8px;"></div>
  ${highlightBox('Prova gratuita di 7 giorni', 'Nessuna carta di credito richiesta. Attivazione immediata, supporto incluso.')}
  ${ctaButton('https://soccorsodigitale.app/register', 'Inizia la prova gratuita', 'Nessuna carta di credito · Attivazione immediata')}
  ${downloadBlock}
</div>`;

const template1 = wrap(
  header +
  hero(
    'Presentazione della piattaforma',
    'Gestisci la tua flotta sanitaria in modo digitale',
    `Ciao <strong style="color:#ffffff;">{{org_name}}</strong>, ti presentiamo la piattaforma cloud italiana per le organizzazioni di trasporto sanitario.`
  ) +
  introBody +
  footer
);

// ─── TEMPLATE 2: FOLLOWUP ─────────────────────────────────────────────────────

const followupBody = `
<div style="padding:36px 40px;">
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px;">
    Qualche giorno fa ti abbiamo presentato Soccorso Digitale e volevamo sapere se hai avuto modo di dare un'occhiata. Siamo qui per rispondere a qualsiasi domanda o per offrirti supporto personalizzato.
  </p>
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 28px;">
    Se preferisci, possiamo organizzare una <strong>demo gratuita di 30 minuti</strong> dove ti mostriamo la piattaforma configurata per una realtà come la tua, senza impegno.
  </p>
  ${highlightBox('Demo gratuita di 30 minuti', 'Ti mostriamo la piattaforma configurata per la tua organizzazione.')}
  ${ctaButton('https://soccorsodigitale.app/demo', 'Prenota una demo gratuita', 'Senza impegno · Configurata per te')}
  ${downloadBlock}
</div>`;

const template2 = wrap(
  header +
  hero(
    'Seguito alla nostra presentazione',
    'Hai avuto modo di esplorare la piattaforma?',
    `Ciao <strong style="color:#ffffff;">{{org_name}}</strong>, qualche giorno fa ti abbiamo scritto di Soccorso Digitale. Volevamo sapere se hai avuto modo di dare un'occhiata.`
  ) +
  followupBody +
  footer
);

// ─── TEMPLATE 3: DEMO INVITE ──────────────────────────────────────────────────

const demoBody = `
<div style="padding:36px 40px;">
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px;">
    Abbiamo preparato una demo personalizzata pensata per organizzazioni come <strong>{{org_name}}</strong> nella regione <strong>{{region}}</strong>. Durante la sessione esploreremo insieme le funzionalità più rilevanti per il tuo contesto operativo.
  </p>
  ${checkmarkItem('Gestione turni e disponibilità', 'Pianificazione automatica, sostituzioni e notifiche ai volontari')}
  ${checkmarkItem('Monitoraggio flotta in tempo reale', 'Posizione, stato e documenti di ogni mezzo sempre aggiornati')}
  ${checkmarkItem('Hub prenotazioni per i pazienti', 'Portale dedicato, conferme automatiche e storico trasporti')}
  ${checkmarkItem('Report e statistiche operative', 'Dashboard live, esportazione PDF ed Excel, KPI personalizzabili')}
  <div style="margin-top:8px;"></div>
  ${highlightBox('Demo personalizzata per {{org_name}}', 'Sesssione di 30 minuti configurata per la tua organizzazione. Nessun impegno.')}
  ${ctaButton('https://soccorsodigitale.app/demo', 'Prenota la tua demo', 'Senza impegno · 30 minuti · Online')}
  ${downloadBlock}
</div>`;

const template3 = wrap(
  header +
  hero(
    'Demo personalizzata per {{org_name}}',
    'Costruiamo insieme la soluzione per la tua organizzazione',
    `Ciao <strong style="color:#ffffff;">{{org_name}}</strong>, abbiamo preparato una demo personalizzata per organizzazioni come {{org_name}} in {{region}}.`
  ) +
  demoBody +
  footer
);

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
      console.log(`✅  Aggiornato: ${res.rows[0].name} (id ${res.rows[0].id})`);
    }
  }

  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
