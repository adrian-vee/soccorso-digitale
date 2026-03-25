/**
 * One-time script: import backup-inserts.sql into Railway DB
 * Run with: node scripts/import-backup.mjs
 * Must be run from within Railway network (DATABASE_URL must be accessible)
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

const BACKUP_FILE = path.resolve(__dirname, '..', 'backup-inserts.sql');
if (!fs.existsSync(BACKUP_FILE)) {
  console.error('ERROR: backup-inserts.sql not found at', BACKUP_FILE);
  process.exit(1);
}

console.log('Reading backup file...');
const sql = fs.readFileSync(BACKUP_FILE, 'utf8');

// Remove Replit \restrict line (not valid SQL)
const cleanSql = sql.replace(/^\\restrict\s+\S+\s*$/m, '-- restrict removed');

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  console.log('Connected to DB. Starting import...');

  try {
    // Execute in a single transaction
    await client.query('BEGIN');
    await client.query(cleanSql);
    await client.query('COMMIT');
    console.log('Import completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import FAILED, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }

  // Count records
  const tables = ['trips', 'scheduled_services', 'users', 'vehicles', 'staff'];
  console.log('\n--- Record counts after import ---');
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  ${table}: ${res.rows[0].count}`);
    } catch {
      console.log(`  ${table}: (table not found or error)`);
    }
  }

  await pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
