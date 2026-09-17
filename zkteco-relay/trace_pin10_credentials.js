/* ============================================================
   trace_pin10_credentials.js  —  READ-ONLY
   ------------------------------------------------------------
   Focused investigation of how PIN 10 / person
   4028814aa04db40301a04dc9f77f0b63 is linked to access levels,
   door, device, and its face/template credential.

   Uses the ACTUAL columns discovered from the DB schema
   (pers_person_id, not person_id), and finds the true
   relationship used by biometric tables — without dumping
   template bytes.

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

const PERSON_ID = '4028814aa04db40301a04dc9f77f0b63';
const PIN = '10';
const NUMBER_PIN = '110';

const TABLES = [
  'pers_person',
  'acc_person',
  'acc_level_person',
  'pers_biotemplate',
  'pers_biophoto',
  'auth_biotemplate',
  'pers_card',
  'pers_identity_card_info',
];

let client;
function l(s) { console.log(s); }
async function q(text, params) {
  try { return await client.query(text, params); }
  catch (e) { return { error: e.message }; }
}

/* ----------  schema detail for a table ---------- */

async function tableSchema(table) {
  l('\n══════════════════════════════════════════════════');
  l(`TABLE: ${table}`);
  l('══════════════════════════════════════════════════');

  // does it exist?
  const exists = await q(
    `SELECT to_regclass('public.' || $1) AS t`, [table]
  );
  if (exists.error || !exists.rows[0].t) { l('  (not present)'); return; }

  // columns
  const cols = await q(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position`, [table]
  );
  l('Columns:');
  for (const c of cols.rows) {
    const notable = /(id|person|pin|template|photo|bio|user|credential|face|finger)/i.test(c.column_name) ? '  ◀' : '';
    l(`  ${c.column_name.padEnd(28)} ${c.data_type.padEnd(24)} null=${c.is_nullable} ${notable}`);
  }

  // PK
  const pk = await q(
    `SELECT a.attname AS col
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
      WHERE i.indrelid=to_regclass('public.' || $1)::oid AND i.indisprimary`, [table]
  );
  if (!pk.error && pk.rows.length) l('PK: ' + pk.rows.map((r) => r.col).join(', '));

  // indexes
  const idx = await q(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename=$1`, [table]
  );
  if (!idx.error && idx.rows.length) {
    l('Indexes:');
    for (const i of idx.rows.slice(0, 20)) l('  ' + i.indexname + '  ' + i.indexdef);
  }

  // FKs
  const fk = await q(
    `SELECT
        tc.constraint_name,
        kcu.column_name        AS col,
        ccu.table_name         AS ref_table,
        ccu.column_name        AS ref_col
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type='FOREIGN KEY'
        AND tc.table_schema='public' AND tc.table_name=$1`, [table]
  );
  if (!fk.error && fk.rows.length) {
    l('Foreign keys:');
    for (const f of fk.rows) l(`  ${f.col} -> ${f.ref_table}.${f.ref_col}`);
  }
}
/* ----------  list "identity" columns of a table dynamically ---------- */

async function identityCols(table) {
  const cols = await q(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1`, [table]
  );
  if (cols.error) return [];
  return cols.rows.filter((c) => /(^id$|^pin$|_id$|person|template|photo|bio|user|credential|face|finger|number_pin)/i.test(c.column_name));
}

/* ----------  find rows linked to the target person / pin ---------- */

async function findLinkedRows(table, values, label) {
  const idCols = await identityCols(table);
  let any = false;
  for (const col of idCols) {
    for (const val of values) {
      const r = await q(
        `SELECT * FROM public."${table}"
          WHERE CAST("${col.column_name}" AS text) = $1 LIMIT 5`,
        [String(val)]
      );
      if (r.error) continue;
      if (r.rows.length) {
        if (!any) l(`\n  ${label} — found via ${col.column_name} = ${val}:`);
        any = true;
        l('  ' + JSON.stringify(r.rows[0]));
      }
    }
  }
  if (!any) l(`\n  ${label} — (no direct match for person id / pin / number_pin)`);
  return any;
}

/* ----------  main ---------- */

async function main() {
  client = new Client(DB);
  await client.connect();
  l('✅ connected to ZKBio PostgreSQL');
  l(`Person id: ${PERSON_ID}\nPIN: ${PIN}\nnumber_pin: ${NUMBER_PIN}`);

  // 1) schemas
  for (const t of TABLES) await tableSchema(t);

  // 2) target person + relationship trace
  l('\n══════════════════════════════════════════════════');
  l('TRACE CHAIN (read-only)');
  l('══════════════════════════════════════════════════');

  // pers_person record
  const pp = await q(`SELECT * FROM public.pers_person WHERE id=$1`, [PERSON_ID]);
  l('\n-- pers_person (target) --');
  if (pp.error) l('  ERR ' + pp.error);
  else if (!pp.rows.length) l('  (not found)');
  else {
    const row = pp.rows[0];
    for (const [k, v] of Object.entries(row)) {
      let out = v;
      if (Buffer.isBuffer(v)) out = '<bytea ' + v.length + ' bytes>';
      else if (typeof v === 'string' && v.length > 200) out = '<string ' + v.length + ' chars>';
      l(`  ${k}: ${out}`);
    }
  }

  // acc_person (correct column: pers_person_id)
  const ap = await q(`SELECT * FROM public.acc_person WHERE pers_person_id=$1`, [PERSON_ID]);
  l('\n-- acc_person (pers_person_id = target) --');
  if (ap.error) l('  ERR ' + ap.error);
  else if (!ap.rows.length) l('  (none)');
  else ap.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // acc_level_person (correct column: pers_person_id)
  const alp = await q(`SELECT * FROM public.acc_level_person WHERE pers_person_id=$1`, [PERSON_ID]);
  l('\n-- acc_level_person (pers_person_id = target) --');
  if (alp.error) l('  ERR ' + alp.error);
  else if (!alp.rows.length) l('  (none)');
  else alp.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // level -> door
  const ld = await q(`SELECT * FROM public.acc_level_door`);
  l('\n-- acc_level_door (all) --');
  if (ld.error) l('  ERR ' + ld.error);
  else ld.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // acc_door
  const ad = await q(`SELECT * FROM public.acc_door`);
  l('\n-- acc_door (all) --');
  if (ad.error) l('  ERR ' + ad.error);
  else ad.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // biometric/template tables — search by each candidate identity column
  l('\n-- BIOMETRIC / TEMPLATE TABLES (existence only) --');
  for (const t of TABLES.filter((x) => /bio|template|card|identity/i.test(x))) {
    l(`\n  ${t}:`);
    await findLinkedRows(t, [PERSON_ID, PIN, NUMBER_PIN], t);
  }

  await client.end();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });