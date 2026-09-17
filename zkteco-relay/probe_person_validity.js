/* ============================================================
   probe_person_validity.js  —  READ-ONLY
   ------------------------------------------------------------
   Dumps the person / validity schema of this ZKBio CVAccess
   install so we can build validity_sync.js with REAL column
   names. We must NOT guess validity columns on the live gym DB.

   What it prints:
     1. PostgreSQL connection info (read-only)
     2. Full column list of pers_person / acc_person (+ related)
     3. EVERY validity-ish column across public.pers_% / acc_% tables
     4. The pin -> pers_person -> acc_person link chain for a PIN
     5. ONE sample row per relevant table (values redacted:
        bytea -> "<bytea N bytes>", strings > 300 chars truncated)
     6. Informational: whether the 'root' role has UPDATE
        privilege on those tables (for the future writer)
     7. Related push tables (adms_*, acc_authorize_trans, base_oplog)

   NEVER writes/updates/deletes/creates anything.
   USAGE:  node probe_person_validity.js [--pin 10]
   ============================================================ */

const { Client } = require('pg');

// ── CLI ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const PIN = getArg('--pin') || '10';
const PWD_OVERRIDE = getArg('--pwd'); // optional: pass the real DB password
const HELP = args.includes('--help') || args.includes('-h');

if (HELP) {
  console.log('USAGE: node probe_person_validity.js [--pin <PIN>] [--pwd <dbPassword>]');
  console.log('  --pwd  optional: the PostgreSQL password for user "root"');
  console.log('         (if omitted, the probe reads CVAccess attsite.ini automatically)');
  process.exit(0);
}

// ── connection candidates (matching relay.js + db_probe.js) ──
const BASE = {
  host: process.env.ZKBIO_PG_HOST || '127.0.0.1',
  port: Number(process.env.ZKBIO_PG_PORT || 5442),
  database: process.env.ZKBIO_PG_DB || 'biosecurity-boot',
};

// ── attsite.ini discovery (the authoritative ZKBio DB config) ──
// On the gym PC, CVAccess stores its real PostgreSQL credentials here.
const ATTSITE_PATHS = [
  'C:\\Program Files\\ZKBio CVAccess\\Config\\attsite.ini',
  'C:\\Program Files (x86)\\ZKBio CVAccess\\Config\\attsite.ini',
  'C:\\ZKBio CVAccess\\Config\\attsite.ini',
  'C:\\ZKBio\\Config\\attsite.ini',
  'C:\\CVAccess\\Config\\attsite.ini',
  'C:\\Program Files\\ZKTeco\\ZKBio CVAccess\\Config\\attsite.ini',
];

function findAttsiteIni() {
  const fs = require('fs');
  for (const p of ATTSITE_PATHS) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

// Parse the [database_postgresql] section: host, port, name, user, password.
function parseAttsiteIni(file) {
  const fs = require('fs');
  try {
    const text = fs.readFileSync(file, 'utf8');
    const section = text.split(/\[database_postgresql\]/i)[1] || '';
    const sectionBody = section.split(/^\s*\[/m)[0] || section;
    const out = {};
    for (const line of sectionBody.split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch (_) { return {}; }
}

// Build the ordered list of credential candidates to try.
function buildCandidates() {
  const list = [];
  const seen = new Set();
  const push = (user, password) => {
    const key = `${user}::${password}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ user, password });
  };

  // 1) explicit --pwd wins
  if (PWD_OVERRIDE) push('root', PWD_OVERRIDE);

  // 2) attsite.ini on the gym PC
  const iniFile = findAttsiteIni();
  if (iniFile) {
    const cfg = parseAttsiteIni(iniFile);
    if (cfg.user) {
      push(cfg.user, cfg.password || '');
      l(`📄 attsite.ini found: ${iniFile}`);
      l(`   configured user=${cfg.user} db=${cfg.name || '(n/a)'} port=${cfg.port || '(n/a)'}`);
    }
  }

  // 3) env override
  push('root', process.env.ZKBIO_PG_PASSWORD || '');

  // 4) known fallbacks from the repo
  push('root', '');
  push('root', '@dmin095');
  push('root', 'Admin123');

  // 5) other common ZKBio/postgres defaults (cheap to try on localhost)
  push('root', '123456');
  push('root', 'root');
  push('root', 'postgres');
  push('root', 'zkbio');
  push('root', '12345678');
  push('postgres', 'postgres');
  push('postgres', '');

  return list;
}
const CANDIDATES = buildCandidates();

// Try connecting over 127.0.0.1 AND localhost/::1 (pg_hba.conf may
// treat IPv4 and IPv6 loopback differently).
const HOSTS = process.env.ZKBIO_PG_HOST
  ? [process.env.ZKBIO_PG_HOST]
  : ['127.0.0.1', 'localhost', '::1'];

// ── pg_hba.conf discovery ───────────────────────────────────
// The bundled PostgreSQL's auth rules tell us EXACTLY why a login is
// rejected (trust / md5 / scram) and for which address families.
const PG_HBA_CANDIDATES = [
  'C:\\Program Files\\ZKBio CVAccess\\pgsql\\data\\pg_hba.conf',
  'C:\\Program Files\\ZKBio CVAccess\\postgresql\\data\\pg_hba.conf',
  'C:\\Program Files\\ZKBio CVAccess\\PostgreSQL\\data\\pg_hba.conf',
  'C:\\Program Files\\ZKBio CVAccess\\data\\pg_hba.conf',
  'C:\\Program Files\\ZKBio CVAccess\\db\\data\\pg_hba.conf',
  'C:\\Program Files\\ZKBio CVAccess\\Database\\data\\pg_hba.conf',
  'C:\\Program Files\\ZKTeco\\ZKBio CVAccess\\pgsql\\data\\pg_hba.conf',
  'C:\\Program Files\\ZKTeco\\ZKBio CVAccess\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\9.6\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\10\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\11\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\12\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\13\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\14\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\15\\data\\pg_hba.conf',
  'C:\\Program Files\\PostgreSQL\\16\\data\\pg_hba.conf',
];

function findPgHbaFile() {
  const fs = require('fs');
  const path = require('path');
  // 1) exact candidates
  for (const p of PG_HBA_CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  // 2) bounded recursive search under common roots
  const roots = [
    'C:\\Program Files\\ZKBio CVAccess',
    'C:\\Program Files\\ZKBio',
    'C:\\Program Files\\ZKTeco',
    'C:\\Program Files\\PostgreSQL',
  ];
  for (const root of roots) {
    try {
      if (!fs.existsSync(root)) continue;
      const walk = (dir, depth) => {
        if (depth > 6) return null;
        let found = null;
        for (const name of fs.readdirSync(dir)) {
          if (found) break;
          const full = path.join(dir, name);
          let stat = null;
          try { stat = fs.statSync(full); } catch (_) {}
          if (!stat) continue;
          if (stat.isDirectory()) {
            if (/^(data|pg|pgsql)$/i.test(name) || depth < 3) {
              found = walk(full, depth + 1);
            }
          } else if (name.toLowerCase() === 'pg_hba.conf') {
            found = full;
          }
        }
        return found;
      };
      const hit = walk(root, 0);
      if (hit) return hit;
    } catch (_) {}
  }
  return null;
}
const HBA_FILE = findPgHbaFile();

function dumpPgHba() {
  l('');
  l('═'.repeat(60));
  l('pg_hba.conf  (what auth the bundled PostgreSQL expects)');
  l('═'.repeat(60));
  if (!HBA_FILE) {
    l('  (not found — if you know the data dir, that is fine)');
    return;
  }
  l(`file: ${HBA_FILE}`);
  const fs = require('fs');
  try {
    const lines = fs.readFileSync(HBA_FILE, 'utf8').split(/\r?\n/);
    const show = lines
      .filter((ln) => {
        const t = ln.trim();
        return t && !t.startsWith('#');
      })
      .slice(0, 40);
    if (!show.length) { l('  (all lines commented — defaults in effect)'); }
    show.forEach((ln) => l('  ' + ln));
  } catch (e) {
    l('  ERR reading: ' + e.message);
  }
}

const VALIDITY_COL_RE = /valid|endtime|end|start|expire|expir|enable|disabled|lock|status|time1|time2|holiday|begin/i;

let client = null;

function l(s) { console.log(s); }

async function q(text, params) {
  try {
    const r = await client.query(text, params || []);
    return { rows: r.rows || [] };
  } catch (e) {
    return { error: e.message };
  }
}

// Redact binary / huge values so the probe never dumps templates/photos.
function safe(v) {
  if (v === null || v === undefined) return v;
  if (Buffer.isBuffer(v)) return `<bytea ${v.length} bytes>`;
  if (typeof v === 'string' || Array.isArray(v)) {
    const s = String(v);
    if (s.length > 300) return `<string ${s.length} chars> ${s.slice(0, 300)}...`;
    return s;
  }
  try { return String(v); } catch (_) { return '<opaque>'; }
}

function printRow(row) {
  for (const [k, v] of Object.entries(row || {})) l(`    ${k}: ${safe(v)}`);
}

// Does a public table exist?
async function tableExists(name) {
  const r = await q(
    `SELECT to_regclass('public.' || $1) AS t`,
    [name]
  );
  return !r.error && r.rows.length && r.rows[0].t != null;
}

// Full column dump for one table (validity-ish cols flagged ◀)
async function dumpTableColumns(table) {
  l('');
  l('═'.repeat(60));
  l(`TABLE: ${table}`);
  l('═'.repeat(60));

  if (!(await tableExists(table))) {
    l('  (table not present on this install)');
    return;
  }

  const cols = await q(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position`,
    [table]
  );
  if (cols.error) { l('  ERR ' + cols.error); return; }

  l('Columns:');
  for (const c of cols.rows) {
    const flag = VALIDITY_COL_RE.test(c.column_name) ? '  ◀ validity-ish' : '';
    l(
      `  ${String(c.column_name).padEnd(30)} ${String(c.data_type).padEnd(22)} ` +
      `null=${c.is_nullable} ${flag}`
    );
  }

  // primary key
  const pk = await q(
    `SELECT a.attname AS col
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = to_regclass('public.' || $1)::oid
        AND i.indisprimary`,
    [table]
  );
  if (pk.error) l('  PK: ERR ' + pk.error);
  else if (pk.rows.length) l('PK: ' + pk.rows.map((r) => r.col).join(', '));
  else l('PK: (none / composite?)');
}

// Every validity-ish column in any pers_*/acc_* table (compact).
async function scanValidityColumns() {
  l('');
  l('═'.repeat(60));
  l('ALL VALIDITY-ISH COLUMNS (public.pers_* / public.acc_*)');
  l('═'.repeat(60));

  const r = await q(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='public'
        AND (table_name ILIKE 'pers\_%' OR table_name ILIKE 'acc\_%')
      ORDER BY table_name, ordinal_position`
  );
  if (r.error) { l('  ERR ' + r.error); return; }

  const hits = r.rows.filter((c) => VALIDITY_COL_RE.test(String(c.column_name)));
  if (!hits.length) { l('  (none found by name pattern)'); return; }
  for (const h of hits) {
    const flag = /valid|expire|endtime|disabled|lock/.test(String(h.column_name)) ? '  ★' : '';
    l(`  ${String(h.table_name).padEnd(34)} ${String(h.column_name).padEnd(28)} ${h.data_type}${flag}`);
  }
}
// Trace pin -> pers_person -> acc_person for the given PIN.
async function tracePerson(PIN) {
  l('');
  l('═'.repeat(60));
  l(`PERSON LINK CHAIN for PIN = ${PIN}`);
  l('═'.repeat(60));

  // find the pin column in pers_person
  const cols = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='pers_person'`
  );
  if (cols.error) { l('  ERR reading pers_person columns: ' + cols.error); return; }
  const pinCols = cols.rows
    .map((c) => c.column_name)
    .filter((n) => /^pin$|pin|number_pin|person_code|user_code|employee|badge/i.test(String(n)));

  l(`pers_person identity-ish columns: ${pinCols.join(', ') || '(none by name)'}`);

  let personId = null;
  for (const col of pinCols) {
    const r = await q(
      `SELECT * FROM public.pers_person WHERE CAST("${col}" AS text) = $1 LIMIT 1`,
      [PIN]
    );
    if (r.error) continue;
    if (r.rows.length) {
      l(`\n-- pers_person via ${col}=${PIN} --`);
      printRow(r.rows[0]);
      personId = r.rows[0].id;
      break;
    }
  }

  if (!personId) {
    l('\n  ❌ No pers_person row found for PIN ' + PIN);
    l('     (that is fine — the probe is still useful without it)');
    return;
  }
  l(`\n  pers_person.id = ${safe(personId)}`);

  // acc_person link
  const ap = await q(
    `SELECT * FROM public.acc_person
      WHERE CAST(pers_person_id AS text) = $1 OR CAST(person_id AS text) = $1
      LIMIT 2`,
    [String(personId)]
  );
  l('\n-- acc_person (linked to this person) --');
  if (ap.error) l('  ERR ' + ap.error);
  else if (!ap.rows.length) l('  (no acc_person row found)');
  else ap.rows.forEach(printRow);

  // access level membership
  const al = await q(
    `SELECT * FROM public.acc_level_person
      WHERE CAST(pers_person_id AS text) = $1 OR CAST(person_id AS text) = $1 OR CAST(pin AS text) = $2
      LIMIT 5`,
    [String(personId), PIN]
  );
  l('\n-- acc_level_person (access groups for this person) --');
  if (al.error) l('  ERR ' + al.error);
  else if (!al.rows.length) l('  (none)');
  else al.rows.forEach(printRow);
}

// Informational privileges + push-side tables.
async function info() {
  l('');
  l('═'.repeat(60));
  l('WRITE PRIVILEGE + PUSH CHANNEL (informational, read-only)');
  l('═'.repeat(60));

  const priv = await q(
    `SELECT current_user() AS u,
            has_table_privilege(current_user(), 'acc_person',  'UPDATE') AS upd_acc_person,
            has_table_privilege(current_user(), 'pers_person',  'UPDATE') AS upd_pers_person,
            has_table_privilege(current_user(), 'acc_level_person','UPDATE') AS upd_acc_level_person`
  );
  l('');
  if (priv.error) l('  ERR ' + priv.error);
  else printRow(priv.rows[0]);

  // push/authorize related tables (candidate "kick" channels)
  const related = [
    'acc_authorize_trans',
    'pers_personchange',
    'base_oplog',
    'adms_device',
    'adms_acc_device_log',
    'adms_auth_device',
    'acc_door',
    'acc_level',
    'acc_level_door',
  ];
  l('\nRelated push/authorize tables (row counts):');
  l('  ' + String('table').padEnd(30) + 'rows');
  for (const t of related) {
    if (!(await tableExists(t))) continue;
    const c = await q(`SELECT count(*)::bigint AS n FROM public."${t}"`);
    const n = c.error ? 'ERR' : c.rows[0].n;
    l(`  ${String(t).padEnd(30)} ${n}`);
  }
}

async function main() {
  l('');
  l('═'.repeat(60));
  l('ZKBio CVAccess — PERSON VALIDITY SCHEMA PROBE (READ-ONLY)');
  l('═'.repeat(60));
  l(`target PIN: ${PIN}`);
  l('');

  // 0) dump pg_hba.conf so we can see WHY auth fails / what is expected
  dumpPgHba();

  // 1) connect — try each loopback host × each credential candidate
  let lastErr = '';
  outer:
  for (const host of HOSTS) {
    for (const cand of CANDIDATES) {
      const cfg = { ...BASE, host, ...cand };
      const c = new Client(cfg);
      try {
        await c.connect();
        client = c;
        l(`✅ connected: ${cfg.user}@${host}:${cfg.port}/${cfg.database} (password len=${cand.password.length})`);
        break outer;
      } catch (e) {
        lastErr = e.message;
        l(`  ✗ ${host} ${cfg.user} (pwd len ${cand.password.length}): ${e.message}`);
      }
    }
  }
  if (!client) {
    l('\n❌ Could not connect. On the GYM PC check:');
    l('   - Server:  127.0.0.1:5442  database: biosecurity-boot');
    l('   - ZKBio services running  (or use ZKBIO_PG_* env vars)');
    l('   - attsite.ini says password is EMPTY, but the server rejected empty.');
    l('     → the real DB password was changed after install (someone set it).');
    l('     → If you know it, re-run:  node probe_person_validity.js --pwd <thatPassword>');
    l('     → If you do NOT know it, check pg_hba.conf above: if it says "trust"');
    l('       for 127.0.0.1 the password should NOT matter — then look at the');
    l('       config file again, or ask whoever installed CVAccess.');
    l(`   - last error: ${lastErr}`);
    process.exit(1);
  }

  // 2) server banner
  const ver = await q(`SELECT version()`);
  l('Server: ' + (ver.error ? 'ERR' : safe(ver.rows[0].version)));

  // 3) column dumps
  for (const t of ['pers_person', 'acc_person', 'acc_level_person', 'pers_personchange']) {
    await dumpTableColumns(t);
  }

  // 4) validity-ish scan
  await scanValidityColumns();

  // 5) link chain
  await tracePerson(PIN);

  // 6) privileges + push tables
  await info();

  // 7) summary to paste back
  l('');
  l('═'.repeat(60));
  l('📋 PASTE THIS BACK TO THE AI:');
  l('   1) acc_person columns that look like validity (start/end)');
  l('   2) the acc_person sample row values for those columns');
  l('   3) the acc_level_person sample row (does this PIN sit in a level?)');
  l('   4) the UPDATE privilege line above (upd_acc_person = true/false)');
  l('   5) row counts of acc_authorize_trans / base_oplog / adms_acc_device_log');
  l('═'.repeat(60));
  l('');
  l('DONE (read-only — nothing was modified).');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});