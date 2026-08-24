const { Client } = require("pg");

async function main() {
  const client = new Client({
    host: "127.0.0.1",
    port: 5442,
    database: "biosecurity-boot",
    user: "root",
    password: "@dmin095", // try this first
  });

  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // List tables that look like transactions/logs
    const tables = await client.query(`
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
        )
      ORDER BY table_schema, table_name;
    `);

    console.log("---- Candidate tables ----");
    for (const r of tables.rows) {
      console.log(`${r.table_schema}.${r.table_name}`);
    }

    // Also show the newest rows from a few common names if they exist
    const common = [
      "access_transaction",
      "access_transactions",
      "acc_transaction",
      "acc_transaction_log",
      "att_transaction",
      "att_record",
      "att_log",
      "event_log",
    ];

    for (const t of common) {
      try {
        const q = await client.query(`SELECT * FROM ${t} ORDER BY 1 DESC LIMIT 3;`);
        console.log(`\n---- Latest rows from ${t} ----`);
        console.log(q.rows);
      } catch (_) {}
    }
  } catch (e) {
    console.error("❌ DB error:", e.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();