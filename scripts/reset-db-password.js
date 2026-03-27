/**
 * Resetta la password di un utente direttamente nel DB con bcrypt.
 * Non richiede Supabase — solo DATABASE_URL.
 *
 * Uso:
 *   railway run node scripts/reset-db-password.js <email> <nuova_password>
 *
 * Esempio:
 *   railway run node scripts/reset-db-password.js admin@croceeuropa.com CroceEuropa2026!
 */
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL non trovato. Esegui con: railway run node scripts/reset-db-password.js");
    process.exit(1);
  }

  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    console.error("Uso: node scripts/reset-db-password.js <email> <nuova_password>");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Verifica utente esiste
    const { rows } = await pool.query(
      "SELECT id, email, role, is_active, password FROM users WHERE email = $1",
      [email]
    );

    if (rows.length === 0) {
      console.error(`Utente non trovato: ${email}`);
      console.log("\nUtenti disponibili:");
      const { rows: all } = await pool.query(
        "SELECT email, role, is_active FROM users ORDER BY role DESC, email LIMIT 20"
      );
      all.forEach(u => console.log(`  ${u.email} | ${u.role} | attivo: ${u.is_active}`));
      await pool.end();
      process.exit(1);
    }

    const user = rows[0];
    console.log(`Utente trovato: ${user.email} | ruolo: ${user.role} | attivo: ${user.is_active}`);
    console.log(`Hash attuale (primi 15): ${user.password ? user.password.substring(0, 15) : "NULL"}`);
    console.log(`Era bcrypt? ${user.password?.startsWith("$2") ? "SI" : "NO (era corrotto)"}`);

    // Hash con bcrypt rounds=12
    const hash = await bcrypt.hash(newPassword, 12);
    const verify = await bcrypt.compare(newPassword, hash);
    if (!verify) throw new Error("Verifica bcrypt fallita — abort");

    // Aggiorna password + assicura account attivo
    await pool.query(
      "UPDATE users SET password = $1, is_active = true WHERE email = $2",
      [hash, email]
    );

    console.log(`\n✓ Password aggiornata per ${email}`);
    console.log(`  Password: ${newPassword}`);
    console.log(`  Bcrypt hash (inizio): ${hash.substring(0, 20)}...`);
    console.log("  Account: attivo");
  } finally {
    await pool.end();
  }
}

run().catch(err => {
  console.error("Errore:", err.message);
  process.exit(1);
});
