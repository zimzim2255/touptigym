/* ============================================================
   find_pin10_person.js  —  READ-ONLY
   ------------------------------------------------------------
   Locates the actual ZKBio personnel record for PIN 10 and
   traces the complete chain:

     PIN 10
      → personnel/person table
      → pers_person_id  (4028814aa04db40301a04dc9f77f0b63)
      → acc_person
      → acc_level_person
      → acc_level (maitre)
      → acc_level_door
      → acc_door
      → device

   Also finds biometric/template tables for this person
   WITHOUT exposing the template blob bytes.

   NEVER writes/updates/deletes anything.
   ============================================================ */

const { Client } = require('pg');

const DB = {
  host: '127.0.0.1',
  port: 5442,
  database: 'biosecurity-boot',
  user: 'root',
  password: '',
};

const TARGET_PERSON_ID = '4028814aa04db40301a04dc9f77f0b63';
const PIN_VALUE = '10';

const COLUMN_NAME_RE = /(pin|person|employee|emp|user|code|badge|card|staff|member|number)/i;
const BIOMETRIC_TABLE_RE = /(bio|template|face|finger|photo|credential|card)/i;

let client;
function l(s) { console.log(s); }

async function q(text, params) {
  try { return await client.query(text, params); }
  catch (e) { return { error: e.message }; }
}

/* ---------- 1) schema scan ---------- */

async function schemaScan() {
  l('\n══════════════════════════════════════════════════');
  l('SCHEMA SCAN — identity-ish columns');
  l('══════════════════════════════════════════════════');

  const r = await q(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='public'
      ORDER BY table_name, ordinal_position`
  );
  if (r.error) { l('  ERR ' + r.error); return []; }

  const hits = [];
  for (const c of r.rows) {
    if (COLUMN_NAME_RE.test(c.column_name)) {
      hits.push(c);
    }
  }

  l(`\nIdentity-ish columns found: ${hits.length}`);
  const byTable = new Map();
  for (const c of hits) {
    if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
    byTable.get(c.table_name).push(c.column_name + ':' + c.data_type);
  }
  for (const [t, cols] of byTable) {
    l(`  ${t.padEnd(40)} ${cols.join(', ')}`);
  }
  return hits;
}

/* ---------- 2) find value 10 in identity columns ---------- */

async function findPin10(cols) {
  l('\n══════════════════════════════════════════════════');
  l(`FINDING VALUE '${PIN_VALUE}' IN IDENTITY COLUMNS`);
  l('══════════════════════════════════════════════════');

  const byTable = new Map();
  for (const c of cols) {
    if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
    byTable.get(c.table_name).push(c.column_name);
  }

  // Prefer exact sub-word matches; skip big risky text/blob columns.
  const preciseNames = /(^pin$|pin_|^person.*id$|number_pin|badge|employee_no|emp_no|staff_no|user_no|card_no|person_code|user_code|^id$)/i;

  for (const [table, columns] of byTable) {
    for (const col of columns) {
      if (!preciseNames.test(col)) continue;
      const r = await q(
        `SELECT * FROM public."${table}"
          WHERE CAST("${col}" AS text) = $1 LIMIT 8`,
        [PIN_VALUE]
      );
      if (r.error) continue;
      if (!r.rows.length) continue;
      l(`\n★ TABLE ${table}.${col} = '${PIN_VALUE}' (${r.rows.length} row(s))`);
      for (const row of r.rows) {
        // redact any template/blob-ish big values
        const clean = {};
        for (const [k, v] of Object.entries(row)) {
          if (Buffer.isBuffer(v)) { clean[k] = '<bytea ' + v.length + ' bytes>'; }
          else if (typeof v === 'string' && v.length > 200) { clean[k] = '<string ' + v.length + ' chars>'; }
          else clean[k] = v;
        }
        l('  ' + JSON.stringify(clean));
      }
    }
  }
}
/* ---------- 3) pers_person record for the target id ---------- */

async function showTargetPerson() {
  l('\n══════════════════════════════════════════════════');
  l('PERS_PERSON RECORD: ' + TARGET_PERSON_ID);
  l('══════════════════════════════════════════════════');

  const p = await q(
    `SELECT * FROM public.pers_person WHERE id = $1`,
    [TARGET_PERSON_ID]
  );
  if (p.error) { l('  ERR ' + p.error); return; }
  if (!p.rows.length) { l('  (not found)'); return; }

  const row = p.rows[0];
  for (const [k, v] of Object.entries(row)) {
    let out = v;
    if (Buffer.isBuffer(v)) out = '<bytea ' + v.length + ' bytes>';
    else if (typeof v === 'string' && v.length > 200) out = '<string ' + v.length + ' chars>';
    l(`  ${k}: ${out}`);
  }
}

/* ---------- 4) trace chain from person id ---------- */

async function traceChain() {
  l('\n══════════════════════════════════════════════════');
  l('TRACE CHAIN FROM TARGET PERSON');
  l('══════════════════════════════════════════════════');

  // acc_person referencing pers_person_id
  const ap = await q(
    `SELECT * FROM public.acc_person
      WHERE CAST(pers_person_id AS text) = $1 OR CAST(person_id AS text) = $1`,
    [TARGET_PERSON_ID]
  );
  l('\n-- acc_person (by pers_person_id) --');
  if (ap.error) l('  ERR ' + ap.error);
  else if (!ap.rows.length) l('  (none)');
  else ap.rows.forEach((rr) => l('  ' + JSON.stringify(rr)));

  // acc_level_person via the person id
  const lp = await q(
    `SELECT * FROM public.acc_level_person
      WHERE CAST(person_id AS text) = $1 OR CAST(pers_person_id AS text) = $1`,
    [TARGET_PERSON_ID]
  );
  l('\n-- acc_level_person (by person_id/pers_person_id) --');
  if (lp.error) l('  ERR ' + lp.error);
  else if (!lp.rows.length) l('  (none)');
  else lp.rows.forEach((rr) => l('  ' + JSON.stringify(rr)));

  // acc_level (maitre)
  const al = await q(`SELECT * FROM public.acc_level`);
  l('\n-- acc_level (all) --');
  if (al.error) l('  ERR ' + al.error);
  else al.rows.forEach((rr) => l('  ' + JSON.stringify(rr)));

  // acc_level_door
  const ald = await q(`SELECT * FROM public.acc_level_door`);
  l('\n-- acc_level_door (all) --');
  if (ald.error) l('  ERR ' + ald.error);
  else ald.rows.forEach((rr) => l('  ' + JSON.stringify(rr)));

  // acc_door
  const ad = await q(`SELECT * FROM public.acc_door`);
  l('\n-- acc_door (all) --');
  if (ad.error) l('  ERR ' + ad.error);
  else ad.rows.forEach((rr) => l('  ' + JSON.stringify(rr)));

  // device
  const dev = await q(`SELECT * FROM public.acc_device`);
  l('\n-- acc_device (all) --');
  if (dev.error) l('  ERR ' + dev.error);
  else dev.rows.forEach((rr) => l('  ' + JSON.stringify(rr)));
}

/* ---------- 5) biometric/template existence only ---------- */

async function showBiometricExistence() {
  l('\n══════════════════════════════════════════════════');
  l('BIOMETRIC / TEMPLATE TABLES (existence + person links only)');
  l('══════════════════════════════════════════════════');

  const r = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  if (r.error) { l('  ERR ' + r.error); return; }
  const bioTables = r.rows
    .map((x) => x.table_name)
    .filter((t) => BIOMETRIC_TABLE_RE.test(t));

  l('\nBiometric/template-ish tables: ' + (bioTables.join(', ') || '(none)'));

  for (const table of bioTables) {
    // find id/person-ish columns
    const cols = await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    if (cols.error) continue;
    const idCols = cols.rows
      .map((c) => c.column_name)
      .filter((n) => /(^id$|_id$|person|bio)/.test(n))
      .slice(0, 6);
    if (!idCols.length) continue;

    let found = false;
    for (const col of idCols) {
      const r2 = await q(
        `SELECT "${col}" FROM public."${table}"
          WHERE CAST("${col}" AS text) = $1 LIMIT 3`,
        [TARGET_PERSON_ID]
      );
      if (!r2.error && r2.rows.length) {
        if (!found) l(`\n★ ${table} has records for target person:`);
        found = true;
        r2.rows.forEach((rr) => l('  ' + JSON.stringify(rr)));
      }
    }
    if (!found) l(`  ${table}: no records for target person`);
  }
}

/* ---------- main ---------- */

async function main() {
  client = new Client(DB);
  await client.connect();
  l('✅ connected to ZKBio PostgreSQL');
  l(`Target person id: ${TARGET_PERSON_ID}`);
  l(`PIN to find: ${PIN_VALUE}`);

  const cols = await schemaScan();
  await findPin10(cols);
  await showTargetPerson();
  await traceChain();
  await showBiometricExistence();

  await client.end();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });