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

// 1. Copyright: rimuovi "in Cloud" da "© Soccorso Digitale in Cloud 2026"
rep(
  '\u00a9 Soccorso Digitale in Cloud 2026',
  '\u00a9 Soccorso Digitale 2026'
);

// 2. Elemento separato: "Soccorso Digitale S.r.l." → "Soccorso Digitale in Cloud 2026"
rep(
  'Soccorso Digitale S.r.l.',
  'Soccorso Digitale in Cloud 2026'
);

// 3. "Piattaforma cloud per il soccorso italiano" → link "APP" verso il gestionale
rep(
  'Piattaforma cloud per il soccorso italiano',
  '<a href="/admin/" class="footer-link">APP </a>'
);

// 4. Pricing: "Sales & marketing automation" → italiano (appare 2 volte, mensile + annuale)
repAll(
  'Sales & marketing automation',
  'Automazione marketing e comunicazioni'
);

// 5. Crittografia End-to-End → due righe
rep(
  '>Crittografia End-to-End<',
  '>Crittografia<br>End-to-End<'
);

// 6. "Pronto in 48 Ore" → "Operativo Subito"
rep(
  'Pronto in 48 Ore',
  'Operativo Subito'
);

// 7. Descrizione sotto "Operativo Subito" → coerente
rep(
  'Attivazione rapida per la tua associazione, senza tecnici n\u00e9 configurazioni complesse.',
  'Zero configurazioni, zero tecnici: crei l\u2019account e sei subito operativo. Nessun software da installare.'
);

// Write
fs.writeFileSync(filePath, html);
console.log('\nDone.');
