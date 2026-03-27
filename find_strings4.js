const fs = require('fs');
const html = fs.readFileSync('conicorn/index.html', 'utf8');

// Find exact forms of problem strings
const searches = ['Sviluppato con', 'saved hours', 'productivity', 'faster', 'statics'];
searches.forEach(s => {
  const idx = html.indexOf(s);
  if (idx !== -1) {
    // Show char codes around the string
    const chunk = html.substring(idx, idx + 30);
    let codes = '';
    for (let i = 0; i < chunk.length; i++) codes += chunk.charCodeAt(i) + '(' + chunk[i] + ') ';
    console.log('FOUND [' + s + '] char codes:');
    console.log(codes);
    console.log('Context:', html.substring(Math.max(0,idx-50), idx+100));
    console.log();
  } else {
    console.log('NOT FOUND: ' + s);
  }
});
