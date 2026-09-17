/* ============================================================
   discover_event_changes.js  —  READ-ONLY
   ------------------------------------------------------------
   Goal: identify exactly where ZKBio CVAccess records a scan of
   Personnel ID 10 (especially when the user is NOT authorized).

   Method:
     1) connect to the local ZKBio PostgreSQL (same as relay.js)
     2) inspect event/log/transaction candidate tables
     3) take a BEFORE snapshot (counts, max ids, max timestamps,
        latest rows keyed by PK)
     4) wait for the operator to scan the device
     5) take an AFTER snapshot
     6) diff — detect INSERTED rows, UPDATED rows (same PK,
        different values), timestamp changes, and any row
        referencing personnel id 10

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

const CANDIDATE_TABLES = [
  'acc_transaction',
  'acc_device_event',
  'event_record',
  'event_structured',
  'event_type',
  'adms_acc_device_log',
  'adms_att_device_log',
  'adms_device',
  'adms_auth_device',
  'base_oplog',
  'auth_api_log',
  'att_transaction',
  'att_record',
  'ivs_transaction',
  'ivs_linkage_event',
  'linkage_center_transaction',
  'acc_alarm_monitor',
  'acc_alarmmonitor_history',
  'acc_exception_event',
  'acc_doorevent',
  'pers_personchange',
  'pers_personnal_list',
  'acc_authorize_trans',
];

// Additional tables auto-discovered by name pattern.
const EXTRA_PATTERN = /(event|_log|transaction|record|alarm|card_|iclock)/i;

let client;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    console.log('>>> Press ENTER here (in this window) AFTER you scanned Personnel ID 10 on the device <<<');
    process.stdin.once('data', () => resolve());
  });
}

async function safeQuery(text, params) {
  try {
    return await client.query(text, params);
  } catch (e) {
    return { error: e.message };
  }
}

/* ---------- table discovery + metadata ---------- */

async function discoverTables() {
  const found = new Set(CANDIDATE_TABLES);
  try {
    const r = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'`
    );
    for (const row of r.rows) {
      if (EXTRA_PATTERN.test(row.table_name)) found.add(row.table_name);
    }
  } catch (e) {
    console.log('  (could not enumerate tables: ' + e.message + ')');
  }
  return Array.from(found).sort();
}

async function getTableMeta(table) {
  const meta = { columns: [], pk: null, idCols: [], tsCols: [], pinCols: [], deviceCols: [], eventCols: [], numericCols: [] };
  try {
    const r = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table]
    );
    meta.columns = r.rows.map((c) => ({ name: c.column_name, type: c.data_type }));
  } catch (e) {
    return null; // table missing / no access
  }

  // PK
  try {
    const pk = await client.query(
      `SELECT a.attname AS col
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = to_regclass('public.' || $1)::oid AND i.indisprimary`,
      [table]
    );
    meta.pk = pk.rows.length ? pk.rows[0].col : null;
  } catch (_) { /* ignore */ }

  for (const c of meta.columns) {
    const n = c.name;
    const t = c.type;
    if (/(^id$|_id$|^uid$|^gid$|^uuid$|^key$|^log_?id$|^device_?id$|^person_?id$|^door_?id$|^reader_?id$)/.test(n)) meta.idCols.push(n);
    if (/^(timestamp|date)/.test(t)) meta.tsCols.push(n);
    if (/^(integer|bigint|smallint|numeric|real|double precision|serial|bigserial)/.test(t)) meta.numericCols.push(n);
    if (/(pin|personnel|emp_?no|staff_?no|user_?no|card_?no|number_pin)/.test(n)) meta.pinCols.push(n);
    if (/(device|sn|serial|controller)/.test(n)) meta.deviceCols.push(n);
    if (/(event|type|confirm|status|verify|alarm|result|state)/.test(n)) meta.eventCols.push(n);
  }

  return meta;
}

function pickOrderCol(meta, table) {
  if (meta.pk && meta.numericCols.includes(meta.pk)) return meta.pk;
  for (const cid of meta.idCols) if (meta.numericCols.includes(cid)) return cid;
  if (meta.tsCols.length) return meta.tsCols[0];
  return meta.columns[0] ? meta.columns[0].name : null;
}

/* ---------- snapshot ---------- */

async function snapshotTable(table, meta) {
  const snap = { count: null, maxIds: {}, maxTs: {}, rows: [] };
  if (!meta) return snap;

  const tq = `public."${table}"`;

  // count
  const c = await safeQuery(`SELECT count(*)::bigint AS n FROM ${tq}`);
  snap.count = c.error ? null : Number(c.rows[0].n);

  // max of numeric ID columns (cap to keep it fast)
  for (const col of meta.idCols.filter((x) => meta.numericCols.includes(x)).slice(0, 5)) {
    const m = await safeQuery(`SELECT max("${col}") AS v FROM ${tq}`);
    if (!m.error && m.rows[0] && m.rows[0].v != null) snap.maxIds[col] = String(m.rows[0].v);
  }

  // max of timestamp columns
  for (const col of meta.tsCols.slice(0, 5)) {
    const m = await safeQuery(`SELECT max("${col}") AS v FROM ${tq}`);
    if (!m.error && m.rows[0] && m.rows[0].v != null) snap.maxTs[col] = new Date(m.rows[0].v).toISOString();
  }

  // latest N rows
  const orderCol = pickOrderCol(meta, table);
  if (orderCol) {
    const r = await safeQuery(
      `SELECT * FROM ${tq} ORDER BY "${orderCol}" DESC LIMIT 25`
    );
    if (!r.error) {
      for (const row of r.rows) {
        let key;
        if (meta.pk && row[meta.pk] != null) key = String(row[meta.pk]);
        else if (orderCol && row[orderCol] != null) key = 'ord:' + String(row[orderCol]);
        else key = JSON.stringify(row);
        snap.rows.push({ key, json: row });
      }
    }
  }

  return snap;
}

function printSnapshot(table, snap) {
  const parts = [`count=${snap.count ?? '?'}`];
  for (const [k, v] of Object.entries(snap.maxIds)) parts.push(`max(${k})=${v}`);
  for (const [k, v] of Object.entries(snap.maxTs)) parts.push(`max(${k})=${v}`);
  console.log(`  ${table.padEnd(38)} ${parts.join('  ')}`);
}

/* ---------- comparison ---------- */

function compareTables(table, b, a, meta, report) {
  if (!meta) return;

  if (a.count !== b.count) {
    report.countChanges.push({ table, before: b.count, after: a.count });
  }

  // timestamp changes
  for (const [col, v] of Object.entries(a.maxTs)) {
    if (b.maxTs[col] !== v) {
      report.tsChanges.push({ table, col, before: b.maxTs[col], after: v });
    }
  }

  // row-level diff on the captured latest windows
  const bByKey = new Map(b.rows.map((r) => [r.key, r]));

  for (const aRow of a.rows) {
    const bRow = bByKey.get(aRow.key);
    if (!bRow) {
      report.inserted.push({ table, row: aRow.json });
    } else if (JSON.stringify(bRow.json) !== JSON.stringify(aRow.json)) {
      report.updated.push({ table, rowId: aRow.key, before: bRow.json, after: aRow.json });
    }
  }

  // rows that disappeared (e.g. ring-buffer tables)
  const aKeys = new Set(a.rows.map((r) => r.key));
  for (const bRow of b.rows) {
    if (!aKeys.has(bRow.key)) {
      report.removed.push({ table, rowId: bRow.key, before: bRow.json });
    }
  }
}

/* ---------- personnel 10 search ---------- */

async function searchPersonnel(tables, metas) {
  console.log('\n---- Tables whose rows mention personnel/pin value 10 ----');
  let hit = false;
  for (const table of tables) {
    const meta = metas[table];
    if (!meta || !meta.pinCols.length) continue;
    const tq = `public."${table}"`;
    for (const col of meta.pinCols.slice(0, 3)) {
      const r = await safeQuery(
        `SELECT * FROM ${tq} WHERE CAST("${col}" AS text) = '10' ORDER BY "ctid" ASC LIMIT 5`
      );
      if (!r.error && r.rows.length) {
        hit = true;
        for (const row of r.rows) {
          console.log(`  ${table}.${col} = '10':`, JSON.stringify(row));
        }
      }
    }
  }
  if (!hit) console.log('  (none found among pinned columns)');
}

/* ---------- main ---------- */

async function main() {
  client = new Client(DB);
  await client.connect();
  console.log('✅ connected to ZKBio PostgreSQL');

  const tables = await discoverTables();
  console.log(`\nCandidate tables to watch: ${tables.length}`);
  console.log(tables.join(', '));

  const metas = {};
  for (const t of tables) {
    metas[t] = await getTableMeta(t);
    if (!metas[t]) console.log(`  (skip ${t} — missing/no access)`);
  }

  console.log('\n=== BEFORE SNAPSHOT ===');
  const before = {};
  for (const t of tables) {
    before[t] = await snapshotTable(t, metas[t]);
    printSnapshot(t, before[t]);
  }

  console.log('\n==========================================');
  console.log('  NOW SCAN PERSONNEL ID 10 ON THE DEVICE');
  console.log('==========================================');
  await waitForEnter();

  console.log('Waiting 5 seconds...');
  await sleep(5000);

  console.log('\n=== AFTER SNAPSHOT ===');
  const after = {};
  for (const t of tables) {
    after[t] = await snapshotTable(t, metas[t]);
  }

  const report = { countChanges: [], tsChanges: [], inserted: [], updated: [], removed: [] };
  for (const t of tables) {
    compareTables(t, before[t], after[t], metas[t], report);
  }

  console.log('\n==========================================');
  console.log(' EVENT DISCOVERY RESULT');
  console.log('==========================================');

  if (report.countChanges.length === 0 && report.tsChanges.length === 0 &&
      report.inserted.length === 0 && report.updated.length === 0) {
    console.log('NO DATABASE CHANGE DETECTED.');
  } else {
    console.log('\n-- ROW COUNT CHANGES --');
    for (const c of report.countChanges) {
      console.log(`  ${c.table}: ${c.before} -> ${c.after}`);
    }

    console.log('\n-- TIMESTAMP CHANGES --');
    for (const c of report.tsChanges) {
      console.log(`  ${c.table}.${c.col}: ${c.before} -> ${c.after}`);
    }

    console.log('\n-- INSERTED ROWS --');
    for (const ins of report.inserted) {
      console.log(`  TABLE: ${ins.table}`);
      console.log(`    ${JSON.stringify(ins.row)}`);
    }

    console.log('\n-- UPDATED ROWS (same key, values changed) --');
    for (const u of report.updated) {
      console.log(`  TABLE: ${u.table}`);
      console.log(`  ROW ID: ${u.rowId}`);
      console.log(`  BEFORE: ${JSON.stringify(u.before)}`);
      console.log(`  AFTER:  ${JSON.stringify(u.after)}`);
    }

    console.log('\n-- REMOVED ROWS (latest-window displacement) --');
    for (const r of report.removed) {
      console.log(`  TABLE: ${r.table}  ROW ID: ${r.rowId}`);
      console.log(`    BEFORE: ${JSON.stringify(r.before)}`);
    }
  }

  await searchPersonnel(tables, metas);

  // heuristic: most likely table
  const scoring = new Map();
  for (const ins of report.inserted) scoring.set(ins.table, (scoring.get(ins.table) || 0) + 3);
  for (const u of report.updated) scoring.set(u.table, (scoring.get(u.table) || 0) + 1);
  for (const c of report.countChanges) scoring.set(c.table, (scoring.get(c.table) || 0) + 1);
  for (const c of report.tsChanges) if (/acc_|event|transaction/.test(c.table)) scoring.set(c.table, (scoring.get(c.table) || 0) + 1);

  let best = null, bestScore = 0;
  for (const [t, s] of scoring) {
    if (s > bestScore) { best = t; bestScore = s; }
  }

  console.log('\n-- MOST LIKELY REAL DEVICE EVENT TABLE --');
  console.log(best ? `  ${best} (score ${bestScore})` : '  (none found)');

  await client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});