/**
 * Migra tutti gli utenti dal DB locale a Supabase Auth.
 *
 * Esegui su Railway:
 *   railway run node scripts/migrate-to-supabase.js
 *
 * Oppure con DATABASE_URL e SUPABASE_* settati localmente:
 *   node scripts/migrate-to-supabase.js
 */
const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono obbligatori");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL è obbligatorio");
    process.exit(1);
  }

  const { rows: users } = await pool.query(
    "SELECT id, email, role, organization_id, name FROM users WHERE is_active = true ORDER BY role DESC, email"
  );
  console.log(`Utenti da migrare: ${users.length}`);

  // Load existing Supabase users once (avoid repeated listUsers calls)
  const { data: existingData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingMap = Object.fromEntries(
    (existingData?.users || []).map((u) => [u.email, u])
  );

  let created = 0, updated = 0, errors = 0;

  for (const user of users) {
    try {
      const existing = existingMap[user.email];

      if (existing) {
        // Update metadata to stay in sync
        const { error } = await supabase.auth.admin.updateUserById(existing.id, {
          user_metadata: {
            role: user.role,
            organization_id: user.organization_id,
            db_user_id: user.id,
            name: user.name,
          },
        });
        if (error) throw error;
        console.log(`✓ aggiornato: ${user.email}`);
        updated++;
      } else {
        // Create with a random temp password — user must reset via email
        const tempPassword =
          "Temp" + Math.random().toString(36).slice(2, 10) + "!2026";
        const { error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            role: user.role,
            organization_id: user.organization_id,
            db_user_id: user.id,
            name: user.name,
          },
        });
        if (error) throw error;
        console.log(`+ creato:    ${user.email}`);
        created++;
      }
    } catch (err) {
      console.error(`✗ errore    ${user.email}: ${err.message}`);
      errors++;
    }
  }

  console.log("\n=== RIEPILOGO ===");
  console.log(`Creati:     ${created}`);
  console.log(`Aggiornati: ${updated}`);
  console.log(`Errori:     ${errors}`);
  console.log(
    "\nGli utenti creati hanno password temporanea casuale.\n" +
    "Usa fix-user-password.js per impostare password specifiche."
  );

  await pool.end();
}

run().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
