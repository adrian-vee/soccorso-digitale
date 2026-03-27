const fs = require('fs');
const html = fs.readFileSync('conicorn/index.html', 'utf8');

// Find all instances of '500+ saved hours' or the scrolling text ticker
const searches = ['saved hours', 'productivity boost', 'faster response', 'Streamline', 'Automate', 'w-badge', 'webflow-badge', 'made-in', 'Made with', 'badge'];
searches.forEach(s => {
  const idx = html.indexOf(s);
  if (idx !== -1) {
    console.log('FOUND [' + s + ']:');
    console.log(html.substring(Math.max(0,idx-100), idx+200).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
    console.log();
  } else {
    console.log('NOT FOUND: ' + s);
  }
});

// Print the tail of the file where Webflow badge might be injected
console.log('--- LAST 500 chars ---');
console.log(html.substring(html.length - 500));
