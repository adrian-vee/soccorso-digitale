const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:oQbQTHEtQdNxfcSrNiyQjfNvwvZWaSJo@caboose.proxy.rlwy.net:28423/railway',
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const hash = await bcrypt.hash('CroceEuropa2026!', 12);
  const result = await pool.query(
    'UPDATE users SET password = $1 WHERE email = $2',
    [hash, 'admin@croceeuropa.com']
  );
  console.log('Righe aggiornate:', result.rowCount);
  await pool.end();
}

fix().catch(console.error);
