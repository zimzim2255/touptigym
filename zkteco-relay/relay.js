const { Client } = require('pg');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const SUPABASE_URL =
  'https://atvdorphwnpzhobvfmtz.supabase.co/functions/v1/zkteco/events';
const DEVICE_TOKEN = 'zk_relay_2026_9X4K_secret';

// ZKBio local web
const ZKBIO_HOST = 'localhost';
const ZKBIO_PORT = 8098;
const ZKBIO_USER = 'admin';
const ZKBIO_PASS_PLAIN = 'Admin123'; // used for levelLoginPwd (RT pwd from captured request)
const ZKBIO_PASS_MD5 = crypto.createHash('md5').update(ZKBIO_PASS_PLAIN, 'utf8').digest('hex'); // loginPwd

// Door open payload (captured from DevTools — RT unlock for this gym/ZKB)
const DOOR_OPEN = {
  openInterval: '5',
  ids: '4028814aa024f57a01a02541b66e0a33',
  names: 'All Doors',
  browserToken: '0b45e7fee18f61df2237db91b10fd447',
};

const pgClient = new Client({
  host: '127.0.0.1',
  port: 5442,
  database: 'biosecurity-boot',
  user: 'root',
  password: '',   // matches [database_postgresql] in attsite.ini (empty)
});

const POLL_INTERVAL_MS = 3000;

let lastLogId = 0;
let isPolling = false;

// ZKBio session cookie (SESSION=...)
let zkCookie = '';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function httpsReq({ hostname, port, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port,
        path,
        method,
        rejectUnauthorized: false,
        headers: headers || {},
      },
      (resp) => {
        let data = '';
        resp.on('data', (c) => (data += c));
        resp.on('end', () =>
          resolve({
            statusCode: resp.statusCode,
            headers: resp.headers,
            body: data,
          })
        );
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function zkLogin() {
  const form = querystring.stringify({
    username: ZKBIO_USER,
    password: ZKBIO_PASS_MD5,
  });

  const res = await httpsReq({
    hostname: ZKBIO_HOST,
    port: ZKBIO_PORT,
    path: '/login.do',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(form),
    },
    body: form,
  });

  const setCookie = res.headers['set-cookie'] || [];
  const sessionLine = setCookie.find((c) => String(c).toUpperCase().startsWith('SESSION='));
  if (!sessionLine) {
    throw new Error(`ZKBio login: no SESSION cookie received (status=${res.statusCode})`);
  }

  zkCookie = sessionLine.split(';')[0];

  // login.do returns JSON with a "data" field like "dashboard.do?dashboard".
  // Visiting it once often finalizes the session.
  try {
    const parsed = JSON.parse(res.body || '{}');
    const nextPath = parsed?.data ? `/${String(parsed.data).replace(/^\//, '')}` : '/';

    await httpsReq({
      hostname: ZKBIO_HOST,
      port: ZKBIO_PORT,
      path: nextPath,
      method: 'GET',
      headers: {
        Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; persUsbDevice=0; ${zkCookie}`,
      },
    });

    log(`✅ ZKBio login OK, cookie=${zkCookie}, landed=${nextPath}`);
  } catch (e) {
    log(`✅ ZKBio login OK, cookie=${zkCookie} (no landing: ${e.message})`);
  }
}

async function zkOpenDoor() {
  async function doOpen() {
    const body = querystring.stringify({
      levelLoginPwd: ZKBIO_PASS_PLAIN,
      loginPwd: ZKBIO_PASS_MD5,
      openInterval: DOOR_OPEN.openInterval,
      ids: DOOR_OPEN.ids,
      names: DOOR_OPEN.names,
      browserToken: DOOR_OPEN.browserToken,
    });

    const res = await httpsReq({
      hostname: ZKBIO_HOST,
      port: ZKBIO_PORT,
      path: '/accRTMonitor.do?openDoor&name=All%20Doors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; persUsbDevice=0; ${zkCookie}`,
      },
      body,
    });

    const loc = res.headers?.location ? String(res.headers.location) : '';
    log(`ZKBio openDoor response: ${res.statusCode} location=${loc} body=${res.body}`);

    return res;
  }

  if (!zkCookie) {
    await zkLogin();
  }

  let res = await doOpen();

  // If session expired/redirected, re-login and retry once immediately
  if (res.statusCode === 302) {
    zkCookie = '';
    log('ZKBio openDoor: got 302, re-login and retry once...');
    await zkLogin();
    res = await doOpen();
  }

  return res.statusCode === 200;
}

function forwardToSupabase(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);

    const req = https.request(
      SUPABASE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': DEVICE_TOKEN,
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (resp) => {
        let out = '';
        resp.on('data', (c) => (out += c));
        resp.on('end', () => resolve({ statusCode: resp.statusCode, body: out }));
      }
    );

    req.on('error', (err) => {
      log(`Supabase error: ${err.message}`);
      resolve({ statusCode: 0, body: '' });
    });

    req.end(data);
  });
}

async function initLastLogId() {
  const q = await pgClient.query(
    'SELECT COALESCE(MAX(log_id), 0) AS max_id FROM public.acc_transaction;'
  );
  lastLogId = Number(q.rows[0].max_id || 0);
  log(`Starting from lastLogId=${lastLogId} (skip history)`);
}

async function poll() {
  if (isPolling) return;
  isPolling = true;

  try {
    const q = await pgClient.query(
      `
      SELECT log_id, pin, event_time, dev_alias, dev_sn, event_no, event_name,
             verify_mode_no, verify_mode_name, capture_photo_path, unique_key
      FROM public.acc_transaction
      WHERE log_id > $1
      ORDER BY log_id ASC
      LIMIT 50;
      `,
      [lastLogId]
    );

    if (q.rows.length === 0) {
      log('No new transactions');
      return;
    }

    log(`Got ${q.rows.length} new transactions`);

    for (const row of q.rows) {
      lastLogId = row.log_id;

      const personnelId = row.pin ? String(row.pin).trim() : '';
      if (!personnelId) continue;

      const capturedAt = row.event_time
        ? new Date(row.event_time).toISOString()
        : new Date().toISOString();

      const payload = {
        personnelId,
        captured_at: capturedAt,
        event_type: 'access',
        raw: row,
        device: row.dev_alias || 'unknown',
      };

      log(`Forwarding log_id=${row.log_id} pin=${personnelId}`);
      const supa = await forwardToSupabase(payload);

      log(`Supabase -> ${supa.statusCode} ${supa.body}`);

      // If allowed => open door via ZKBio remote opening
      try {
        const parsed = JSON.parse(supa.body || '{}');
        if (parsed.app_result === 'allowed') {
          log('✅ Allowed -> opening door...');
          await zkOpenDoor();
        } else {
          log('Denied -> door stays closed');
        }
      } catch (e) {
        log(`Supabase parse error: ${e.message}`);
      }
    }
  } catch (e) {
    log(`Poll error: ${e.message}`);
  } finally {
    isPolling = false;
  }
}

async function start() {
  await pgClient.connect();
  log('✅ Connected to PostgreSQL');
  await initLastLogId();

  log(`Polling acc_transaction every ${POLL_INTERVAL_MS}ms...`);
  setInterval(poll, POLL_INTERVAL_MS);
  poll();
}

start().catch((e) => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
