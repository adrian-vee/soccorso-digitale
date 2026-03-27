const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'conicorn', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

function rep(from, to) {
  if (html.indexOf(from) === -1) {
    console.warn('NOT FOUND: ' + from.substring(0, 80));
    return;
  }
  html = html.split(from).join(to);
  console.log('OK: ' + from.substring(0, 60));
}

function repAll(from, to) {
  const count = html.split(from).length - 1;
  if (count === 0) {
    console.warn('NOT FOUND (all): ' + from.substring(0, 80));
    return;
  }
  html = html.split(from).join(to);
  console.log('OK x' + count + ': ' + from.substring(0, 60));
}

// Curly apostrophe = U+2019
const apos = '\u2019';

// ── Garbled/mixed string (with curly apostrophe in We'll) ─────────────────────
rep(
  `Prenota una chiamata gratuita di 20 minuti con il nostro team. We${apos}ll analyze your current Ogni strumento \u00e8 progettato per le esigenze reali delle organizzazioni di soccorso italiane.`,
  'Prenota una chiamata gratuita di 20 minuti con il nostro team. Analizzeremo la tua organizzazione e ti mostreremo come Soccorso Digitale pu\u00f2 aiutarti concretamente.'
);

// ── Testimonials section heading ──────────────────────────────────────────────
rep(`What They${apos}re Saying`, 'Cosa Dicono di Noi');

// ── Testimonials still in English ────────────────────────────────────────────
rep(
  `We${apos}ve increased enrollment conversion by 35% in just one quarter.`,
  'Con Soccorso Digitale abbiamo ridotto il tempo di gestione turni dell\u2019 80%. Ora generiamo il piano mensile in un click.'
);

rep(
  `Now, our CRM runs intelligently, leads are scored automatically, and follow-ups happen without manual effort. We${apos}ve increased demo bookings by 40% while reducing operational friction.`,
  'La gestione della flotta \u00e8 diventata molto pi\u00f9 semplice. Teniamo traccia dei km, delle revisioni e dei costi per ogni mezzo in tempo reale.'
);

// ── Pricing: What's included ──────────────────────────────────────────────────
repAll(`What${apos}s included:`, 'Cosa \u00e8 incluso:');

// ── Footer: License link ──────────────────────────────────────────────────────
rep('License </a>', 'Licenza </a>');

// Write output
fs.writeFileSync(filePath, html);
console.log('\nDone. File saved.');
