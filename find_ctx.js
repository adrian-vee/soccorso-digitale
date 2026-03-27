const fs = require('fs');
const html = fs.readFileSync('conicorn/index.html', 'utf8');

const searches = [
  'Soccorso Digitale S.r.l',
  'Soccorso Digitale in Cloud 2026',
  'Soccorso Digitale 2026',
  'Piattaforma cloud per il soccorso italiano',
  'Sales & marketing automation',
  'Sales &amp; marketing',
  'Crittografia End-to-End',
  'Pronto in 48 Ore',
  'Pronto in 48',
  '48 ore',
  'Attivazione rapida',
];

searches.forEach(s => {
  const idx = html.indexOf(s);
  if (idx !== -1) {
    console.log('FOUND [' + s + ']:');
    console.log(html.substring(Math.max(0,idx-60), idx+160));
    console.log();
  } else {
    console.log('NOT FOUND: ' + s);
    console.log();
  }
});
