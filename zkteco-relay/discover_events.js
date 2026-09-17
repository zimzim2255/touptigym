const { Client } = require('pg');
const readline = require('readline');

const pgClient = new Client({
  host: '127.0.0.1',
  port: 5442,
  database: 'biosecurity-boot',
  user: 'root',
  password: '',
});

function waitForEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function getTables() {
  const result = await pgClient.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  return result.rows.map((r) => r.table_name);
}

async function snapshotTables(tables) {
  const snapshot = {};

  for (const table of tables) {
    try {
      const q = await pgClient.query(
        `SELECT COUNT(*)::bigint AS count FROM public."${table}"`
      );

      snapshot[table] = {
        count: Number(q.rows[0].count),
      };
    } catch (e) {
      snapshot[table] = {
        error: e.message,
      };
    }
  }

  return snapshot;
}

async function findRecentRows(table) {
  try {
    const result = await pgClient.query(
      `SELECT * FROM public."${table}" LIMIT 1`
    );

    const columns = Object.keys(result.rows[0] || {});

    if (columns.length === 0) {
      return [];
    }

    const possibleTimeColumns = columns.filter((c) =>
      /time|date|create|update|log/i.test(c)
    );

    let orderColumn = null;

    for (const col of possibleTimeColumns) {
      orderColumn = col;
      break;
    }

    let sql;

    if (orderColumn) {
      sql = `SELECT * FROM public."${table}"
             ORDER BY "${orderColumn}" DESC NULLS LAST
             LIMIT 3`;
    } else {
      sql = `SELECT * FROM public."${table}" LIMIT 3`;
    }

    const q = await pgClient.query(sql);

    return q.rows;
  } catch (e) {
    return [{ error: e.message }];
  }
}

async function main() {
  await pgClient.connect();

  console.log('');
  console.log('==========================================');
  console.log(' ZKBIO EVENT DATABASE DISCOVERY');
  console.log('==========================================');
  console.log('');

  const tables = await getTables();

  console.log(`Found ${tables.length} tables.`);
  console.log('');
  console.log('Taking BEFORE snapshot...');

  const before = await snapshotTables(tables);

  console.log('');
  console.log('==========================================');
  console.log(' NOW SCAN USER 10 ON THE DEVICE');
  console.log('==========================================');
  console.log('');
  console.log('After scanning, wait 3 seconds.');
  console.log('Then press ENTER here.');
  console.log('');

  await waitForEnter('Press ENTER after the scan...');

  console.log('');
  console.log('Waiting 3 seconds for ZKBio database update...');

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('');
  console.log('Taking AFTER snapshot...');

  const after = await snapshotTables(tables);

  const changed = [];

  for (const table of tables) {
    const b = before[table];
    const a = after[table];

    if (!b || !a || b.error || a.error) continue;

    if (a.count !== b.count) {
      changed.push({
        table,
        before: b.count,
        after: a.count,
        difference: a.count - b.count,
      });
    }
  }

  console.log('');
  console.log('==========================================');
  console.log(' TABLES THAT CHANGED');
  console.log('==========================================');
  console.log('');

  if (changed.length === 0) {
    console.log('NO TABLE ROW COUNTS CHANGED.');
    console.log('');
    console.log('The device may UPDATE an existing row instead.');
  } else {
    for (const item of changed) {
      console.log(
        `TABLE: ${item.table} | ${item.before} -> ${item.after} | CHANGE: ${item.difference}`
      );

      console.log('Recent rows:');

      const rows = await findRecentRows(item.table);

      console.dir(rows, {
        depth: 4,
        maxArrayLength: 3,
      });

      console.log('');
      console.log('------------------------------------------');
    }
  }

  console.log('');
  console.log('==========================================');
  console.log(' IMPORTANT TABLES TO INVESTIGATE');
  console.log('==========================================');
  console.log('');

  const interesting = tables.filter((name) =>
    /acc|att|trans|event|log|verify|person|device/i.test(name)
  );

  for (const table of interesting) {
    console.log(table);
  }

  await pgClient.end();

  console.log('');
  console.log('DONE.');
}

main().catch(async (e) => {
  console.error('FATAL ERROR:', e.message);

  try {
    await pgClient.end();
  } catch (_) {}

  process.exit(1);
});