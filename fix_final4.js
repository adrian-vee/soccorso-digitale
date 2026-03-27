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

// Scrolling stats ticker — exact strings inside statics-item-name divs
repAll('saved hours', 'ore risparmiate');
repAll('productivity boost', 'pi\u00f9 efficienza');
repAll('faster response', 'risposta pi\u00f9 rapida');

// Footer "Sviluppato con Webflow" — exact form without extra spaces
rep(
  'Sviluppato con <a href="https://webflow.com" target="_blank" class="footer-link">Webflow</a>',
  'Piattaforma cloud per il soccorso italiano'
);

// Write
fs.writeFileSync(filePath, html);
console.log('\nDone.');
