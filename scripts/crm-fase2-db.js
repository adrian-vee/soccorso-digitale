/**
 * CRM Fase 2 — Migrazione DB
 * Esegui con: node scripts/crm-fase2-db.js
 * (richiede DATABASE_URL con URL pubblica Railway)
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL mancante.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL?.includes('railway.internal')
  ? 'postgresql://postgres:oQbQTHEtQdNxfcSrNiyQjfNvwvZWaSJo@caboose.proxy.rlwy.net:28423/railway'
  : process.env.DATABASE_URL;

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Applicazione migrazione CRM Fase 2...\n');

    // Nuove colonne crm_email_logs
    await client.query(`
      ALTER TABLE crm_email_logs
        ADD COLUMN IF NOT EXISTS message_id TEXT,
        ADD COLUMN IF NOT EXISTS tracking_pixel_id TEXT UNIQUE DEFAULT gen_random_uuid()::text;
    `);
    console.log('✓ crm_email_logs: aggiunte colonne message_id, tracking_pixel_id');

    // Nuove colonne crm_email_templates
    await client.query(`
      ALTER TABLE crm_email_templates
        ADD COLUMN IF NOT EXISTS preview_text VARCHAR(255),
        ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
    `);
    console.log('✓ crm_email_templates: aggiunte colonne preview_text, version');

    // Nuova colonna crm_organizations per bounce
    await client.query(`
      ALTER TABLE crm_organizations
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'new';
    `);
    // status già esiste, questo è idempotente

    // Tabella crm_unsubscribes
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_unsubscribes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        organization_id UUID,
        unsubscribed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ crm_unsubscribes');

    // Indici aggiuntivi
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_logs_pixel ON crm_email_logs(tracking_pixel_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_logs_msgid ON crm_email_logs(message_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_unsub_email ON crm_unsubscribes(email)`);
    console.log('✓ Indici aggiuntivi');

    console.log('\n✅ Migrazione CRM Fase 2 completata!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Errore:', err.message);
  process.exit(1);
});
