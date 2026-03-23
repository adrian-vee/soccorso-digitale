const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect().then(function() {
  return c.query("UPDATE users SET password = 'CroceAdmin2026!' WHERE email = 'admin@croceeuropa.com' RETURNING email, role");
}).then(function(r) {
  console.log('Reset:', r.rows);
  return c.query("UPDATE users SET password = 'SoccorsoDigitale2026!' WHERE email = 'superadmin@soccorsodigitale.app' RETURNING email, role");
}).then(function(r) {
  console.log('Reset:', r.rows);
  c.end();
});