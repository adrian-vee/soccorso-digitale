/**
 * import-db.js — Import pg_dump SQL backup into Railway PostgreSQL
 *
 * Usage:
 *   $env:DATABASE_URL="postgresql://..."
 *   node import-db.js
 *
 * This script handles both regular SQL statements and COPY ... FROM stdin blocks.
 * "Already exists" errors are silently skipped (safe to re-run).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. Install pg-copy-streams if missing (needed for COPY FROM STDIN blocks)
// ---------------------------------------------------------------------------
try {
  require.resolve('pg-copy-streams');
} catch {
  console.log('📦 Installing pg-copy-streams (one-time)...');
  execSync('npm install pg-copy-streams --no-save', { stdio: 'inherit' });
}

const { Client } = require('pg');
const { from: copyFrom } = require('pg-copy-streams');

// ---------------------------------------------------------------------------
// 2. Config
// ---------------------------------------------------------------------------
const BACKUP_FILE = path.join(__dirname, 'backup.sql');

// Errors we silently ignore (safe to skip on re-import)
const IGNORABLE_ERRORS = [
  'already exists',
  'duplicate key',
  'multiple primary keys',
  'violates unique constraint',
];

function isIgnorable(msg) {
  return IGNORABLE_ERRORS.some((e) => msg.toLowerCase().includes(e));
}

// ---------------------------------------------------------------------------
// 3. Parse the dump into segments: { type: 'sql'|'copy', ... }
// ---------------------------------------------------------------------------
function parseDump(content) {
  const lines = content.split('\n');
  const segments = [];

  let statementLines = [];
  let inCopy = false;
  let copyHeader = '';
  let copyDataLines = [];

  for (const line of lines) {
    // ---- Inside a COPY data block ----
    if (inCopy) {
      if (line === '\\.') {
        // End-of-copy marker
        segments.push({
          type: 'copy',
          header: copyHeader,
          data: copyDataLines.join('\n'),
          rows: copyDataLines.length,
        });
        inCopy = false;
        copyHeader = '';
        copyDataLines = [];
      } else {
        copyDataLines.push(line);
      }
      continue;
    }

    // ---- Skip psql meta-commands (\restrict, \connect, etc.) ----
    if (line.startsWith('\\')) continue;

    // ---- Detect start of COPY block ----
    if (/^COPY\s+\S+.*FROM\s+stdin\s*;/i.test(line)) {
      // Flush any pending partial statement
      const pending = statementLines.join('\n').trim();
      if (pending) segments.push({ type: 'sql', sql: pending });
      statementLines = [];

      inCopy = true;
      copyHeader = line;
      continue;
    }

    // ---- Accumulate regular SQL lines ----
    statementLines.push(line);

    // A statement ends when the trimmed line ends with ';'
    // pg_dump always closes statements this way (SET, CREATE, ALTER, SELECT, etc.)
    if (line.trimEnd().endsWith(';')) {
      const stmt = statementLines.join('\n').trim();
      // Skip blank or comment-only blocks
      if (stmt && !/^(--.*)$/.test(stmt)) {
        segments.push({ type: 'sql', sql: stmt });
      }
      statementLines = [];
    }
  }

  // Flush anything remaining
  const leftover = statementLines.join('\n').trim();
  if (leftover) segments.push({ type: 'sql', sql: leftover });

  return segments;
}

// ---------------------------------------------------------------------------
// 4. Execute a COPY block via pg-copy-streams
// ---------------------------------------------------------------------------
async function executeCopy(client, header, data) {
  // Transform "COPY public.foo (cols) FROM stdin;" → "COPY public.foo (cols) FROM STDIN"
  const copyStatement = header.replace(/\s+FROM\s+stdin\s*;?\s*$/i, ' FROM STDIN');

  const stream = client.query(copyFrom(copyStatement));

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);

    // Write data followed by newline so PostgreSQL receives a complete last row
    if (data) {
      stream.write(data + '\n');
    }
    stream.end();
  });
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------
async function main() {
  // Validate prerequisites
  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set.');
    process.exit(1);
  }
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`❌  backup.sql not found at: ${BACKUP_FILE}`);
    process.exit(1);
  }

  // Connect
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // required for Railway
  });
  await client.connect();
  console.log('✅  Connected to Railway PostgreSQL\n');

  // Parse
  console.log('🔍  Parsing backup.sql...');
  const content = fs.readFileSync(BACKUP_FILE, 'utf8');
  const segments = parseDump(content);

  const sqlSegments = segments.filter((s) => s.type === 'sql').length;
  const copySegments = segments.filter((s) => s.type === 'copy').length;
  console.log(`📊  Found ${sqlSegments} SQL statements and ${copySegments} COPY blocks\n`);

  // Execute
  let doneCount = 0;
  let okSQL = 0;
  let okCopy = 0;
  let skipped = 0;
  let errors = 0;
  const total = segments.length;

  const printProgress = () => {
    const pct = Math.round((doneCount / total) * 100).toString().padStart(3);
    process.stdout.write(
      `\r⏳  ${pct}%  [${doneCount}/${total}]  SQL: ${okSQL}  COPY: ${okCopy}  skipped: ${skipped}  errors: ${errors}`
    );
  };

  for (const seg of segments) {
    doneCount++;
    if (doneCount % 10 === 0 || doneCount === total) printProgress();

    if (seg.type === 'sql') {
      try {
        await client.query(seg.sql);
        okSQL++;
      } catch (err) {
        if (isIgnorable(err.message)) {
          skipped++;
        } else {
          errors++;
          // Print error without breaking the progress line
          process.stdout.write('\n');
          console.error(`⚠️   SQL error: ${err.message.split('\n')[0]}`);
          console.error(`    Statement: ${seg.sql.substring(0, 100).replace(/\n/g, ' ')}...`);
        }
      }
    } else if (seg.type === 'copy') {
      try {
        await executeCopy(client, seg.header, seg.data);
        okCopy++;
      } catch (err) {
        if (isIgnorable(err.message)) {
          skipped++;
        } else {
          errors++;
          process.stdout.write('\n');
          console.error(`⚠️   COPY error: ${err.message.split('\n')[0]}`);
          console.error(`    Table: ${seg.header.substring(0, 80)}`);
        }
      }
    }
  }

  await client.end();

  // Final report
  process.stdout.write('\n\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  Import completed!');
  console.log(`    SQL statements executed : ${okSQL}`);
  console.log(`    COPY blocks imported    : ${okCopy}`);
  console.log(`    Skipped (already exists): ${skipped}`);
  console.log(`    Errors                  : ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (errors > 0) {
    console.log('\n⚠️   There were errors. Check output above.');
    process.exit(1);
  } else {
    console.log('\n🎉  Database ready on Railway!');
  }
}

main().catch((err) => {
  console.error('\n💥  Fatal error:', err.message);
  process.exit(1);
});
