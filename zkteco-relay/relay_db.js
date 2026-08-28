/**
 * ZKBio CVAccess -> Supabase Relay (PostgreSQL polling)
 *
 * - Connects to local PostgreSQL (ZKBio)
 * - Auto-discovers a likely "transaction/event" table
 * - Polls new rows
 * - Forwards to Supabase Edge Function
 *
 * Requirements:
 *   npm i pg
 *   pg_hba.conf must allow localhost trust OR set correct password
 */

const { Client } = require("pg");
const https = require("https");

// ====== Supabase target ======
const SUPABASE_URL =
  "https://pwfkaiwxwxzsbarypysr.supabase.co/functions/v1/make-server-176f60a9/devices/speedface-v5l/events";
const DEVICE_TOKEN = "zk_relay_2026_9X4K_secret";

// ====== ZKBio PostgreSQL ======
const PG = {
  host: "127.0.0.1",
  port: 5442,
  database: "biosecurity-boot",
  user: "root",
  // Leave empty when pg_hba.conf is set to trust for localhost
  password: "",
};

const POLL_INTERVAL_MS = 3000;
const MAX_ROWS_PER_POLL = 200;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function forwardToSupabase(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);

    const req = https.request(
      SUPABASE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": DEVICE_TOKEN,
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (resp) => {
        let out = "";
        resp.on("data", (c) => (out += c));
        resp.on("end", () => {
          log(`Forwarded to Supabase: ${resp.statusCode} ${out}`);
          resolve();
        });
      }
    );

    req.on("error", (err) => {
      log(`Supabase error: ${err.message}`);
      resolve();
    });

    req.end(data);
  });
}

async function listCandidateTables(client) {
  const q = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type='BASE TABLE'
      AND table_schema NOT IN ('pg_catalog','information_schema')
      AND (
        table_name ILIKE '%trans%'
        OR table_name ILIKE '%att%'
        OR table_name ILIKE '%access%'
        OR table_name ILIKE '%event%'
        OR table_name ILIKE '%log%'
        OR table_name ILIKE '%record%'
      )
    ORDER BY table_schema, table_name;
  `);

  return q.rows.map((r) => `${r.table_schema}.${r.table_name}`);
}

async function getTableColumns(client, fullName) {
  const [schema, table] = fullName.split(".");
  const q = await client.query(
    `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2
    ORDER BY ordinal_position;
  `,
    [schema, table]
  );
  return q.rows;
}

function chooseIdColumn(cols) {
  const names = cols.map((c) => c.column_name.toLowerCase());
  const preferred = ["id", "log_id", "trans_id", "event_id"];
  for (const p of preferred) {
    const idx = names.indexOf(p);
    if (idx !== -1) return cols[idx].column_name;
  }
  // fallback: first column that looks numeric
  const numeric = cols.find((c) =>
    ["integer", "bigint", "numeric", "smallint"].includes(c.data_type)
  );
  return numeric ? numeric.column_name : null;
}

function chooseTimeColumn(cols) {
  const names = cols.map((c) => c.column_name.toLowerCase());
  const preferred = [
    "access_time",
    "time",
    "event_time",
    "trans_time",
    "att_time",
    "create_time",
    "created_at",
    "timestamp",
    "log_time",
  ];
  for (const p of preferred) {
    const idx = names.indexOf(p);
    if (idx !== -1) return cols[idx].column_name;
  }
  return null;
}

function choosePersonnelColumn(cols) {
  const names = cols.map((c) => c.column_name.toLowerCase());
  const preferred = [
    "personnel_id",
    "emp_id",
    "employee_id",
    "pin",
    "user_id",
    "userid",
    "person_id",
    "personnelno",
  ];
  for (const p of preferred) {
    const idx = names.indexOf(p);
    if (idx !== -1) return cols[idx].column_name;
  }
  return null;
}

async function scoreTable(client, fullName) {
  // Score by (a) has id column (b) has personnel column (c) has time column (d) has rows
  const cols = await getTableColumns(client, fullName);
  const idCol = chooseIdColumn(cols);
  const timeCol = chooseTimeColumn(cols);
  const persCol = choosePersonnelColumn(cols);

  let rowCount = 0;
  try {
    const q = await client.query(`SELECT COUNT(*)::int AS c FROM ${fullName};`);
    rowCount = q.rows[0]?.c ?? 0;
  } catch {
    // ignore
  }

  let score = 0;
  if (idCol) score += 5;
  if (persCol) score += 5;
  if (timeCol) score += 3;
  if (rowCount > 0) score += 2;
  if (rowCount > 100) score += 1;

  return { fullName, score, idCol, timeCol, persCol, cols, rowCount };
}

async function discoverBestTable(client) {
  const candidates = await listCandidateTables(client);
  if (candidates.length === 0) {
    throw new Error("No candidate tables found (trans/att/access/event/log).");
  }

  const scored = [];
  for (const t of candidates) {
    try {
      scored.push(await scoreTable(client, t));
    } catch {
      // ignore tables we can't read
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 5 || !best.idCol) {
    log("Candidate scoring results:");
    for (const s of scored.slice(0, 10)) {
      log(
        `${s.fullName} score=${s.score} rows=${s.rowCount} id=${s.idCol} pers=${s.persCol} time=${s.timeCol}`
      );
    }
    throw new Error(
      "Could not confidently discover a transaction table. See logs above."
    );
  }

  log(
    `✅ Using table ${best.fullName} (rows=${best.rowCount}) id=${best.idCol} pers=${best.persCol} time=${best.timeCol}`
  );

  return best;
}

async function main() {
  const client = new Client(PG);

  await client.connect();
  log("✅ Connected to PostgreSQL");

  const tableInfo = await discoverBestTable(client);

  let lastId = 0;

  async function poll() {
    try {
      const q = await client.query(
        `SELECT * FROM ${tableInfo.fullName}
         WHERE ${tableInfo.idCol} > $1
         ORDER BY ${tableInfo.idCol} ASC
         LIMIT ${MAX_ROWS_PER_POLL};`,
        [lastId]
      );

      if (q.rows.length === 0) {
        log("No new transactions");
        return;
      }

      log(`Got ${q.rows.length} new rows`);

      for (const row of q.rows) {
        const personnelId =
          (tableInfo.persCol && row[tableInfo.persCol]) ||
          row.personnel_id ||
          row.pin ||
          row.user_id ||
          row.userid ||
          "";

        const tsRaw =
          (tableInfo.timeCol && row[tableInfo.timeCol]) ||
          row.access_time ||
          row.event_time ||
          row.time ||
          row.created_at ||
          null;

        const capturedAt = tsRaw
          ? new Date(tsRaw).toISOString()
          : new Date().toISOString();

        const payload = {
          personnelId: String(personnelId),
          captured_at: capturedAt,
          event_type: "access",
          raw: {
            source: "zkbio-postgresql",
            table: tableInfo.fullName,
            row,
          },
        };

        await forwardToSupabase(payload);

        const currentId = row[tableInfo.idCol];
        if (typeof currentId === "number") lastId = currentId;
        else if (typeof currentId === "bigint") lastId = Number(currentId);
        else lastId = Number(currentId) || lastId;
      }
    } catch (e) {
      log(`Poll error: ${e.message}`);
    }
  }

  log(`Polling every ${POLL_INTERVAL_MS}ms...`);
  setInterval(poll, POLL_INTERVAL_MS);
  poll();
}

main().catch((e) => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});