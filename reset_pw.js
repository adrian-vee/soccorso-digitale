const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  const result = await pool.query(
    "SELECT id, email, role, password FROM users WHERE email = 'admin@croceeuropa.com'"
  );

  if (result.rows.length === 0) {
    console.log('UTENTE NON TROVATO');
    await pool.end();
    return;
  }

  const u = result.rows[0];
  console.log('Trovato:', u.email, '| Ruolo:', u.role);
  console.log('Password attuale (primi 10):', u.password ? u.password.substring(0, 10) : 'null');
  console.log('E hashata (bcrypt)?', u.password ? u.password.startsWith('$2') : false);

  const hash = await bcrypt.hash('CroceEuropa2026!', 12);
  await pool.query(
    "UPDATE users SET password = $1 WHERE email = 'admin@croceeuropa.com'",
    [hash]
  );

  const ok = await bcrypt.compare('CroceEuropa2026!', hash);
  console.log('Verifica bcrypt:', ok ? 'OK' : 'FALLITA');
  console.log('Nuova password: CroceEuropa2026!');

  await pool.end();
}

fix().catch(err => {
  console.error('Errore:', err.message);
  pool.end();
});
