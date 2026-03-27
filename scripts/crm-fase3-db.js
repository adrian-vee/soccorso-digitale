/**
 * CRM Fase 3 — Migrazione DB Campagne
 * node scripts/crm-fase3-db.js
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
    console.log('Migrazione CRM Fase 3...\n');

    await client.query(`
      ALTER TABLE crm_campaigns
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS smtp_config_id UUID,
        ADD COLUMN IF NOT EXISTS send_speed INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS error_message TEXT;
    `);
    console.log('✓ crm_campaigns: aggiunte colonne');

    // campaign_id su crm_email_logs già esistente dalla Fase 1
    // Aggiunge indici mancanti
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_logs_status ON crm_email_logs(status)`);
    console.log('✓ Indici aggiuntivi');

    console.log('\n✅ Migrazione CRM Fase 3 completata!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Errore:', err.message);
  process.exit(1);
});
