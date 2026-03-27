const fs = require('fs');
const html = fs.readFileSync('conicorn/index.html', 'utf8');

// Find Chi Siamo section and nearby scrolling text
const chisiamo = html.indexOf('Chi Siamo');
if (chisiamo !== -1) {
  console.log('Chi Siamo context (before):');
  console.log(html.substring(Math.max(0, chisiamo-200), chisiamo+800).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().substring(0,600));
}
console.log('---');

// Search for common English words that might be in a scrolling ticker
const englishTickerWords = ['Automation', 'Workflow', 'Integration', 'Scale', 'Optimize', 'Transform', 'Streamline', 'Accelerate', 'Innovate', 'Digitize', 'Automate', 'Efficiency', 'Growth', 'Intelligence'];
englishTickerWords.forEach(w => {
  const idx = html.indexOf(w);
  if (idx !== -1) {
    console.log('FOUND [' + w + ']:', html.substring(idx-50, idx+100).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
  }
});

console.log('---');
// Find all text-based marquee-list content
const marqListIdx = html.indexOf('marquee-list');
if (marqListIdx !== -1) {
  // Find next marquee-list further in
  let pos2 = html.indexOf('marquee-list', marqListIdx + 1);
  let pos3 = (pos2 !== -1) ? html.indexOf('marquee-list', pos2 + 1) : -1;

  [marqListIdx, pos2, pos3].forEach((idx, i) => {
    if (idx !== -1) {
      const section = html.substring(idx, idx+500);
      const text = section.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      console.log('Marquee list ' + (i+1) + ':', text.substring(0, 200));
      console.log();
    }
  });
}

console.log('---footer---');
// Footer full text
const footerIdx = html.lastIndexOf('<footer');
if (footerIdx !== -1) {
  const text = html.substring(footerIdx, footerIdx + 3000).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  console.log(text.substring(0, 500));
}
