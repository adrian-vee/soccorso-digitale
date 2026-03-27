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
  console.log('OK: ' + from.substring(0, 70));
}

function repAll(from, to) {
  const count = html.split(from).length - 1;
  if (count === 0) {
    console.warn('NOT FOUND (all): ' + from.substring(0, 80));
    return;
  }
  html = html.split(from).join(to);
  console.log('OK x' + count + ': ' + from.substring(0, 70));
}

// ── 1. Footer — Sviluppato con Webflow ───────────────────────────────────────
rep(
  '| Sviluppato con  <a href="https://webflow.com" target="_blank" class="footer-link">Webflow </a>',
  '| Piattaforma cloud per il soccorso italiano'
);

// ── 2. Footer — Licenza → Privacy & Termini ──────────────────────────────────
rep(
  '<a href="/license" class="footer-link">Licenza </a>',
  '<a href="/privacy" class="footer-link">Privacy & Termini </a>'
);

// ── 3. Footer copyright year — Soccorso Digitale in Cloud ────────────────────
repAll('Soccorso Digitale 2026', 'Soccorso Digitale in Cloud 2026');

// ── 4. Pricing — "Included everything in Starter, plus:" ─────────────────────
repAll(
  'Included everything in Starter, plus:',
  'Tutto il Piano Base, pi\u00f9:'
);

// ── 5. FAQ heading — Common Questions ────────────────────────────────────────
rep('Common Questions', 'Domande Frequenti');

// ── 6. Capabilities data cards (under "I Tuoi Dati. Protetti. Sempre.") ──────
rep('End-to-End Encryption', 'Crittografia End-to-End');
rep('Secure API Integrations', 'Integrazioni API Sicure');
rep('Role-Based Access Control', 'Controllo Accessi per Ruolo');
// "Minimizzazione dei Dati" is already Italian

// ── 7. Scrolling stats ticker (under Chi Siamo) ───────────────────────────────
rep('500+ saved hours', '500+ ore risparmiate');
rep('80% productivity boost', '80% pi\u00f9 efficienza');
rep('5x faster response', '5x pi\u00f9 veloce');

// ── 8. Hide Webflow "Made in Webflow" badge via CSS injection ─────────────────
// Webflow injects .w-webflow-badge dynamically via JS — hide it with CSS
if (html.indexOf('.w-webflow-badge') === -1) {
  html = html.replace('</head>', '<style>.w-webflow-badge{display:none!important}</style></head>');
  console.log('OK: injected .w-webflow-badge CSS hide rule');
} else {
  console.log('SKIP: .w-webflow-badge rule already present');
}

// ── Write ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(filePath, html);
console.log('\nDone. File saved.');
