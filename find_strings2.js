const fs = require('fs');
const html = fs.readFileSync('conicorn/index.html', 'utf8');

// Find the scrolling text marquee (Marquee list 3 with 500+ saved hours etc.)
const marker = '500+ saved hours';
const idx = html.indexOf(marker);
if (idx !== -1) {
  console.log('SCROLLING TEXT TICKER:');
  console.log(html.substring(idx-200, idx+600).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
}
console.log('---');

// Find the Made in Webflow badge (usually injected by Webflow, might be in JS or as a link)
const webflowBadge = html.indexOf('webflow.com/made-in-webflow');
if (webflowBadge !== -1) {
  console.log('Webflow badge found:', html.substring(webflowBadge-100, webflowBadge+200));
}

// Also search for the footer-bottom area more carefully
const fbIdx = html.indexOf('footer-bottom');
if (fbIdx !== -1) {
  console.log('FOOTER BOTTOM HTML:');
  console.log(html.substring(fbIdx, fbIdx+800));
}
