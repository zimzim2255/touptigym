/* ============================================================
   inspect_door_rules.js  —  READ-ONLY
   ------------------------------------------------------------
   Inspects ZKBio CVAccess access-control rules to find what
   causes a successful face verification to AUTOMATICALLY release
   door 192.168.1.201-1 for Personnel PIN 10 (verify_mode_no=15).

   Targets:
     acc_door_verifymoderule
     acc_verifymode_rule
     acc_device_verifymode
     acc_level_door
     acc_level_person
     acc_level
     acc_door
     acc_device
     acc_person

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

const PIN = '10';
const DOOR_NAME = '192.168.1.201-1';
const DEV_SN = 'NCK2243300185';
const VERIFY_MODE = '15';

const TABLES = [
  'acc_door_verifymoderule',
  'acc_verifymode_rule',
  'acc_device_verifymode',
  'acc_level_door',
  'acc_level_person',
  'acc_level',
  'acc_door',
  'acc_device',
  'acc_person',
];

let client;

function l(s) { console.log(s); }

async function q(text, params) {
  try { return await client.query(text, params); }
  catch (e) { return { error: e.message }; }
}

async function ensureTables() {
  // Only investigate tables that actually exist.
  const r = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  if (r.error) return [];
  const have = new Set(r.rows.map((x) => x.table_name));
  return TABLES.filter((t) => have.has(t));
}

async function dumpTable(table, label) {
  l('\n══════════════════════════════════════════════════');
  l(`TABLE: ${table}  (${label})`);
  l('══════════════════════════════════════════════════');

  // columns
  const cols = await q(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  if (cols.error) { l(`  ERR reading columns: ${cols.error}`); return; }
  l('Columns: ' + cols.rows.map((c) => c.column_name + ':' + c.data_type).join(', '));

  // row count
  const cnt = await q(`SELECT count(*)::bigint AS n FROM public."${table}"`);
  l(`Row count: ${cnt.error ? 'ERR' : cnt.rows[0].n}`);

  // Full dump (cap at 500 rows to be safe).
  const rows = await q(`SELECT * FROM public."${table}" LIMIT 500`);
  if (rows.error) { l(`  ERR reading rows: ${rows.error}`); return; }
  if (!rows.rows.length) { l('  (empty)'); return; }

  for (const row of rows.rows) {
    // highlight matches to PIN / door / sn / verify mode
    const blob = JSON.stringify(row);
    const hit =
      blob.includes('"pin":' + JSON.stringify(String(PIN))) ||
      blob.includes(PIN) ||
      blob.includes(DOOR_NAME) ||
      (DEV_SN && blob.includes(DEV_SN)) ||
      blob.includes('"verify_mode_no":' + JSON.stringify(String(VERIFY_MODE))) ||
      blob.includes('"verify_mode"');
    const marker = hit ? ' ★' : '';
    l('  ' + JSON.stringify(row) + marker);
  }
}
/* ---------- focused lookups ---------- */

async function focusedLookups() {
  l('\n══════════════════════════════════════════════════');
  l('FOCUSED LOOKUPS');
  l('══════════════════════════════════════════════════');

  // acc_person for PIN 10
  const person = await q(
    `SELECT id, pin, number_pin, name, last_name, photo_path, enabled_credential, status
       FROM public.acc_person WHERE CAST(pin AS text)=$1 OR CAST(number_pin AS text)=$1`,
    [PIN]
  );
  l('\n-- acc_person matching PIN ' + PIN + ' --');
  if (person.error) l('  ERR ' + person.error);
  else person.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // acc_level_person: which levels is PIN 10 in? (pin column)
  const lp = await q(
    `SELECT * FROM public.acc_level_person WHERE CAST(pin AS text)=$1`,
    [PIN]
  );
  l('\n-- acc_level_person matching PIN ' + PIN + ' (pin column) --');
  if (lp.error) l('  ERR ' + lp.error);
  else lp.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // Try a text scan across acc_level_person for PIN 10 in case the column differs.
  try {
    const c = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='acc_level_person'`
    );
    const cols = c.rows.map((x) => x.column_name);
    const pinish = cols.filter((n) => /pin|person|user|emp/.test(n));
    for (const col of pinish.slice(0, 4)) {
      const r2 = await q(
        `SELECT * FROM public.acc_level_person WHERE CAST("${col}" AS text)=$1`,
        [PIN]
      );
      if (!r2.error && r2.rows.length) {
        l(`\n-- acc_level_person.${col}=${PIN} --`);
        r2.rows.forEach((r) => l('  ' + JSON.stringify(r)));
      }
    }
  } catch (_) {}

  // acc_level_door: which door does each level gate?
  const ld = await q('SELECT * FROM public.acc_level_door');
  l('\n-- acc_level_door (all) --');
  if (ld.error) l('  ERR ' + ld.error);
  else ld.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // acc_level
  const al = await q('SELECT * FROM public.acc_level');
  l('\n-- acc_level (all) --');
  if (al.error) l('  ERR ' + al.error);
  else al.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // acc_door
  const dr = await q('SELECT * FROM public.acc_door');
  l('\n-- acc_door (all) --');
  if (dr.error) l('  ERR ' + dr.error);
  else dr.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // acc_device
  const dev = await q('SELECT * FROM public.acc_device');
  l('\n-- acc_device (all) --');
  if (dev.error) l('  ERR ' + dev.error);
  else dev.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  // verify-mode rules: which modes are allowed for which doors/devices?
  const vm = await q(`SELECT * FROM public.acc_door_verifymoderule ORDER BY 1`);
  l('\n-- acc_door_verifymoderule (all) --');
  if (vm.error) l('  ERR ' + vm.error);
  else vm.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  const vmr = await q('SELECT * FROM public.acc_verifymode_rule');
  l('\n-- acc_verifymode_rule (all) --');
  if (vmr.error) l('  ERR ' + vmr.error);
  else vmr.rows.forEach((r) => l('  ' + JSON.stringify(r)));

  const dvm = await q('SELECT * FROM public.acc_device_verifymode');
  l('\n-- acc_device_verifymode (all) --');
  if (dvm.error) l('  ERR ' + dvm.error);
  else dvm.rows.forEach((r) => l('  ' + JSON.stringify(r)));
}

async function main() {
  client = new Client(DB);
  await client.connect();
  l('✅ connected to ZKBio PostgreSQL');
  l(`Focus: PIN=${PIN}  Door=${DOOR_NAME}  SN=${DEV_SN}  verify_mode=${VERIFY_MODE}`);

  const tables = await ensureTables();
  l('\nPresent tables: ' + tables.join(', '));

  for (const t of tables) {
    await dumpTable(t, 'access rule config');
  }

  await focusedLookups();

  await client.end();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
