const { Client } = require('pg');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const SUPABASE_URL =
  'https://atvdorphwnpzhobvfmtz.supabase.co/functions/v1/zkteco/events';
const DEVICE_TOKEN = 'zk_relay_2026_9X4K_secret';

// ZKBio local web
const ZKBIO_HOST = '192.168.1.202'; // LAN IP (working browser used this, not localhost)
const ZKBIO_PORT = 8098;
const ZKBIO_USER = 'admin';
const ZKBIO_PASS_PLAIN = 'Admin123'; // used for userLoginPwd
const ZKBIO_PASS_MD5 = crypto.createHash('md5').update(ZKBIO_PASS_PLAIN, 'utf8').digest('hex'); // loginPwd

// Door open payload (captured from DevTools — working request for this gym/ZKB)
const DOOR_OPEN = {
  openInterval: '5',
  ids: '4028814aa024f57a01a02541b66e0a33',
  names: 'entrée-1', // the actual door name (from capture)
  browserToken: '93a3b148fdf0c1d1b42ab430dcdd9c1d', // hardcoded temp — paired with SESSION capture; automate later
  extra: {
    type: 'openDoor',
    disabledDoorsName: '',
    offlineDoorsName: '',
    notSupportDoorsName: '',
  },
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
// NOTE: hardcoded temporarily so the door can open NOW.
// TODO later: extract browserToken + SESSION automatically at login.
let zkCookie = 'ZjIzZTJmZTgtZjhkYi00NTFlLWI1MGItMDNjMzEyOGY5YmVi';

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
  // 1) Fetch the base page to obtain a FRESH browser-token for this session
  try {
    const init = await httpsReq({ hostname: ZKBIO_HOST, port: ZKBIO_PORT, path: '/', method: 'GET' });
    const html = init.body || '';
    const m = html.match(/browser[\s_:-]*token["']?\s*[:=]\s*["']([a-f0-9]{32})/i);
    if (m) DOOR_OPEN.browserToken = m[1];
  } catch (_) {}

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
      'browser-token': DOOR_OPEN.browserToken || '',
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

    const landing = await httpsReq({
      hostname: ZKBIO_HOST,
      port: ZKBIO_PORT,
      path: nextPath,
      method: 'GET',
      headers: {
        Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; persUsbDevice=0; ${zkCookie}`,
      },
    });

    // browserToken lives in the logged-in HTML (e.g. window.browserToken="...").
    const html = landing.body || '';
    const btMatch = html.match(/browser[\s_:-]*token['"]?\s*[:=]\s*['"]?([a-f0-9]{32})/i);
    const btHeader = (typeof res.headers['browser-token'] === 'string' ? res.headers['browser-token'] : '')
                  || (typeof landing.headers['browser-token'] === 'string' ? landing.headers['browser-token'] : '');
    const bt = (btMatch && btMatch[1]) || btHeader;
    if (/^[a-f0-9]{32}$/i.test(String(bt).trim())) DOOR_OPEN.browserToken = String(bt).trim();

    log(`✅ ZKBio login OK, cookie=${zkCookie}, landed=${nextPath}, browserToken=${DOOR_OPEN.browserToken}`);
  } catch (e) {
    log(`✅ ZKBio login OK, cookie=${zkCookie} (no landing: ${e.message})`);
  }
}

async function zkOpenDoor() {
  // The browser first "arms" the door-open by POSTing the form (getDoorIds),
  // THEN submits to ?openDoor. Without the arm step ZKBio returns 201 but never
  // actually releases the lock.
  async function armOpen() {
    const body = querystring.stringify({
      getDoorIds: '',
      type: DOOR_OPEN.extra.type,
      ids: DOOR_OPEN.ids,
    });
    const res = await httpsReq({
      hostname: ZKBIO_HOST,
      port: ZKBIO_PORT,
      path: '/accDoor.do',
      method: 'POST',
      headers: {
        'Host': `${ZKBIO_HOST}:${ZKBIO_PORT}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
        'Accept': 'text/html, */*; q=0.01',
        'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        'pragma': 'no-cache',
        'cache-control': 'no-cache',
        'browser-token': DOOR_OPEN.browserToken || '',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': `https://${ZKBIO_HOST}:${ZKBIO_PORT}`,
        'Connection': 'keep-alive',
        'Referer': `https://${ZKBIO_HOST}:${ZKBIO_PORT}/main.do?home&selectSysCode=Acc`,
        Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}`,
      },
      body,
    });
    return res;
  }

  async function doOpen() {
    const body = querystring.stringify({
      type: DOOR_OPEN.extra.type,
      ids: DOOR_OPEN.ids,
      name: DOOR_OPEN.names,
      disabledDoorsName: DOOR_OPEN.extra.disabledDoorsName,
      offlineDoorsName: DOOR_OPEN.extra.offlineDoorsName,
      notSupportDoorsName: DOOR_OPEN.extra.notSupportDoorsName,
      userLoginPwd: ZKBIO_PASS_PLAIN,
      openInterval: DOOR_OPEN.openInterval,
      loginPwd: ZKBIO_PASS_MD5,
      browserToken: DOOR_OPEN.browserToken,
    });

    const res = await httpsReq({
      hostname: ZKBIO_HOST,
      port: ZKBIO_PORT,
      path: '/accDoor.do?openDoor',
      method: 'POST',
      headers: {
        'Host': `${ZKBIO_HOST}:${ZKBIO_PORT}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        'pragma': 'no-cache',
        'cache-control': 'no-cache',
        'browser-token': DOOR_OPEN.browserToken || '',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': `https://${ZKBIO_HOST}:${ZKBIO_PORT}`,
        'Connection': 'keep-alive',
        'Referer': `https://${ZKBIO_HOST}:${ZKBIO_PORT}/main.do?home&selectSysCode=Acc`,
        Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}`,
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

  // Step 1: arm the door-open (getDoorIds) — returns HTML form
  await armOpen();
  let res = await doOpen();

  // If session expired/redirected, re-login and retry once immediately
  if (res.statusCode === 302) {
    zkCookie = '';
    log('ZKBio openDoor: got 302, re-login and retry once...');
    await zkLogin();
    await armOpen();
    res = await doOpen();
  }

  // 200 = "ret:ok" (browser) → door actually released. Treat 200 as success.
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
