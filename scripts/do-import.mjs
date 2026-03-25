import pg from '../node_modules/pg/lib/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUBLIC_URL = 'postgresql://postgres:oQbQTHEtQdNxfcSrNiyQjfNvwvZWaSJo@caboose.proxy.rlwy.net:28423/railway';

const raw = fs.readFileSync(path.join(__dirname, '..', 'backup-inserts.sql'), 'utf8');

// Rimuove metacomandi psql
const cleaned = raw
  .split('\n')
  .filter(l => !l.trim().startsWith('\\'))
  .join('\n');

// Divide in statement individuali: divide su righe che terminano con ;
// Strategia: accumula righe finché non trova un ; finale
function splitStatements(sql) {
  const stmts = [];
  let current = [];
  let inDollarQuote = false;
  let inSingleQuote = false;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();

    // Salta commenti e righe vuote (solo se non in uno statement)
    if (!current.length && (trimmed === '' || trimmed.startsWith('--'))) continue;

    current.push(line);

    // Conta apertura/chiusura dollar quotes ($$)
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount % 2 !== 0) inDollarQuote = !inDollarQuote;

    if (!inDollarQuote && trimmed.endsWith(';')) {
      stmts.push(current.join('\n'));
      current = [];
    }
  }
  if (current.length) stmts.push(current.join('\n'));
  return stmts.filter(s => s.trim());
}

const statements = splitStatements(cleaned);
console.log(`Statement trovati: ${statements.length}`);

// Categorie
const insertStmts = statements.filter(s => s.trim().toUpperCase().startsWith('INSERT'));
const otherStmts  = statements.filter(s => !s.trim().toUpperCase().startsWith('INSERT'));
console.log(`  INSERT: ${insertStmts.length}, altri (CREATE/SET/etc): ${otherStmts.length}`);

const pool = new Pool({ connectionString: PUBLIC_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
console.log('Connesso a Railway DB.');

let ok = 0, skipped = 0, errors = 0;

// 1. Esegui statement non-INSERT in transazione
console.log('\nFase 1: DDL e SET...');
try {
  await client.query('BEGIN');
  for (const stmt of otherStmts) {
    try {
      await client.query(stmt);
    } catch (e) {
      // Ignora errori "già esiste" (tabelle, tipi, etc.)
      if (e.code === '42P07' || e.code === '42710' || e.code === '42P06') {
        skipped++;
      } else if (!e.message.includes('already exists')) {
        // Solo errori critici causano rollback
        console.warn(`  WARN DDL: ${e.message.slice(0, 100)}`);
      }
    }
  }
  await client.query('COMMIT');
  console.log('  DDL completato.');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('ERRORE DDL:', e.message);
}

// 2. INSERT uno per uno con ON CONFLICT DO NOTHING
console.log('\nFase 2: INSERT dati...');
const BATCH = 100;
for (let i = 0; i < insertStmts.length; i++) {
  const stmt = insertStmts[i].replace(/;$/, ' ON CONFLICT DO NOTHING;');
  try {
    await client.query(stmt);
    ok++;
  } catch (e) {
    if (e.code === '23505') { // unique_violation
      skipped++;
    } else {
      errors++;
      if (errors <= 5) console.warn(`  ERRORE INSERT: ${e.message.slice(0, 120)}`);
    }
  }
  if ((i + 1) % BATCH === 0 || i === insertStmts.length - 1) {
    process.stdout.write(`\r  ${i + 1}/${insertStmts.length} (ok:${ok} skip:${skipped} err:${errors})   `);
  }
}

console.log('\n');
client.release();

// Conteggi finali
console.log('--- Conteggio record dopo import ---');
for (const t of ['trips', 'scheduled_services', 'users', 'vehicles', 'staff', 'shifts', 'organizations']) {
  try {
    const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`  ${t}: ${r.rows[0].count}`);
  } catch {
    console.log(`  ${t}: (non trovata)`);
  }
}

await pool.end();
console.log('\nFatto.');
