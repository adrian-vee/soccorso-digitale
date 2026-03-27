/**
 * Imposta/crea un singolo utente su Supabase con password nota.
 *
 * Uso:
 *   railway run node scripts/fix-user-password.js <email> <password> [role] [org_id]
 *
 * Esempi:
 *   railway run node scripts/fix-user-password.js admin@croceeuropa.com CroceEuropa2026! org_admin
 *   railway run node scripts/fix-user-password.js superadmin@soccorsodigitale.app SoccorsoDigitale2026! super_admin
 */
const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono obbligatori");
    process.exit(1);
  }

  const [, , email, password, role, orgId] = process.argv;
  if (!email || !password) {
    console.error("Uso: node fix-user-password.js <email> <password> [role] [org_id]");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get extra data from DB if available
  let dbRole = role, dbOrgId = orgId, dbName = null;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query(
      "SELECT role, organization_id, name FROM users WHERE email = $1",
      [email]
    );
    if (rows.length) {
      dbRole = dbRole || rows[0].role;
      dbOrgId = dbOrgId || rows[0].organization_id;
      dbName = rows[0].name;
    }
    await pool.end();
  }

  // Find existing Supabase user
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = listData?.users?.find((u) => u.email === email);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        role: dbRole,
        organization_id: dbOrgId,
        name: dbName,
      },
    });
    if (error) {
      console.error("Errore aggiornamento:", error.message);
      process.exit(1);
    }
    console.log(`✓ Password aggiornata per ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: dbRole,
        organization_id: dbOrgId,
        name: dbName,
      },
    });
    if (error) {
      console.error("Errore creazione:", error.message);
      process.exit(1);
    }
    console.log(`+ Utente creato: ${data.user.email} (id: ${data.user.id})`);
  }

  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

run().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
