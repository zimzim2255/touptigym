const { Client } = require('pg');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');

// ── Minimal .env loader (no dotenv dependency) ─────────────────────────────
// Reads KEY=VALUE lines from a local .env file (if present) into process.env
// WITHOUT overwriting real environment variables. Used to hold secrets
// (ZKBIO_PASSWORD, ZKBIO_BROWSER_TOKEN, etc.) so they are not hard-coded.
function loadEnvFile(file) {
  try {
    if (!fs.existsSync(file)) return;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch (_) {}
}
loadEnvFile(path.join(__dirname, '.env'));

const SUPABASE_URL =
  'https://atvdorphwnpzhobvfmtz.supabase.co/functions/v1/zkteco/events';
const DEVICE_TOKEN = 'zk_relay_2026_9X4K_secret';


// ZKBio local web — HTTPS (browser proof: https://192.168.1.202:8098)
// Values can be overridden via .env: ZKBIO_HOST, ZKBIO_PORT, ZKBIO_USER, ZKBIO_PASSWORD
const ZKBIO_HOST = process.env.ZKBIO_HOST || '192.168.1.202';
const ZKBIO_PORT = Number(process.env.ZKBIO_PORT || 8098);
const ZKBIO_USER = process.env.ZKBIO_USER || 'admin';
const ZKBIO_PASS_PLAIN = process.env.ZKBIO_PASSWORD || 'Admin123'; // used for userLoginPwd
const ZKBIO_PASS_MD5 = crypto.createHash('md5').update(ZKBIO_PASS_PLAIN, 'utf8').digest('hex'); // loginPwd

// Door open payload (captured from DevTools — working request for this gym/ZKB)
const DOOR_OPEN = {
  openInterval: '5',
  ids: '4028814aa04db40301a04db507870486',
  names: 'maitre',
  browserToken: '', // acquired by refreshBrowserToken() after login
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

// Startup behaviour:
//   START_FROM_LATEST=true  (default)  → skip old history (start at MAX(log_id))
//   START_FROM_LATEST=false            → process from lastLogId=0 (all history)
// On restart, a persistent state file (last_log_id.json) is preferred so the
// relay never re-processes events it already forwarded.
const START_FROM_LATEST = String(process.env.START_FROM_LATEST ?? 'true').toLowerCase() === 'true';
const STATE_FILE = path.join(__dirname, 'last_log_id.json');

let lastLogId = 0;
let isPolling = false;

// ZKBio session cookie (SESSION=...) — acquired via direct zkLogin().
let zkCookie = '';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── Persistent lastLogId state ─────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (s && Number.isFinite(s.lastLogId) && s.lastLogId > 0) {
        lastLogId = Number(s.lastLogId);
        log(`Loaded saved state: lastLogId=${lastLogId}`);
      }
    }
  } catch (_) {}
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastLogId, savedAt: new Date().toISOString() }), 'utf8');
  } catch (_) {}
}

function httpsReq({ hostname, port, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port,
        path,
        method,
        rejectUnauthorized: false, // ZKBio uses a custom/self-signed cert
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

// zkCookieHeader() — returns the Cookie header value for ZKBio requests.
function zkCookieHeader() {
  return `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}`;
}

// Pull a fresh browser-token from the ZKBio session.
// Order of discovery:
//   1) POST /login.do response headers/body
//   2) GET /main.do?home&selectSysCode=Acc response HEADERS (any browser-token header)
//   3) The same page's HTML/JS (flexible patterns)
//   4) Fallback: access-level page / dashboard HTML
//   5) Optional .env override: ZKBIO_BROWSER_TOKEN (runtime credential only)
async function refreshBrowserToken() {
  // (a) login response headers/body may carry the token
  try {
    const h = zkLoginRespHeaders['browser-token'] || zkLoginRespHeaders['Browser-Token'];
    if (h && /^[a-f0-9]{32}$/i.test(String(h).trim())) {
      DOOR_OPEN.browserToken = String(h).trim();
      log(`[ZKBIO] browserToken found in login headers: ${DOOR_OPEN.browserToken}`);
      return true;
    }
    if (zkLoginRespBody) {
      const m = zkLoginRespBody.match(/["']?browser[\s_:-]*token["']?\s*[:=]\s*["']?([a-f0-9]{32})/i);
      if (m) {
        DOOR_OPEN.browserToken = m[1];
        log(`[ZKBIO] browserToken found in login JSON: ${DOOR_OPEN.browserToken}`);
        return true;
      }
    }
  } catch (_) {}

  // (b) page-based discovery — check headers AND HTML of each candidate page
  const candidatePaths = [
    '/main.do?home&selectSysCode=Acc',
    '/main.do?home&selectSysCode=Pers',
    '/dashboard.do?dashboard',
    '/main.do',
    '/main.do?home',
  ];

  const patterns = [
    /browserToken\s*[:=]\s*["']([a-f0-9]{32})["']/i,
    /browser-token\s*[:=]\s*["']([a-f0-9]{32})["']/i,
    /browser_token\s*[:=]\s*["']([a-f0-9]{32})["']/i,
    /["']browserToken["']\s*[:=]\s*["']([a-f0-9]{32})["']/i,
    /browser[\s_:-]*token['"]?\s*[:=]\s*['"]?\s*([a-f0-9]{32})/i,
  ];

  for (const pagePath of candidatePaths) {
    try {
      log(`[ZKBIO] Searching ${pagePath} for browser token...`);
      const res = await httpsReq({
        hostname: ZKBIO_HOST,
        port: ZKBIO_PORT,
        path: pagePath,
        method: 'GET',
        headers: {
          Cookie: zkCookieHeader(),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (res.statusCode === 200) log(`[ZKBIO] Access Control page loaded: YES (${pagePath})`);
      const html = res.body || '';
      log(`[ZKBIO] HTML length=${html.length}`);

      // 1) response headers
      const hdrs = res.headers || {};
      for (const hk of Object.keys(hdrs)) {
        if (/browser[\s_:-]*token/i.test(hk)) {
          const hv = String(hdrs[hk] || '');
          const hm = hv.match(/[a-f0-9]{32}/i);
          if (hm && /^[a-f0-9]{32}$/i.test(hm[0])) {
            DOOR_OPEN.browserToken = hm[0];
            log(`[ZKBIO] browserToken found in header (${hk}): ${DOOR_OPEN.browserToken}`);
            return true;
          }
        }
      }

      // 2) HTML / inline JS / meta tags — flexible match
      for (const p of patterns) {
        const m = html.match(p);
        if (m && /^[a-f0-9]{32}$/i.test(m[1])) {
          DOOR_OPEN.browserToken = m[1];
          log(`[ZKBIO] browserToken found in HTML (${pagePath}): ${DOOR_OPEN.browserToken}`);
          return true;
        }
      }
    } catch (e) {
      log(`[ZKBIO] token attempt failed: ${pagePath} - ${e.message}`);
    }
  }

  // (c) optional .env runtime credential — NOT assumed permanent
  const envToken = process.env.ZKBIO_BROWSER_TOKEN;
  if (envToken && /^[a-f0-9]{32}$/i.test(String(envToken).trim())) {
    DOOR_OPEN.browserToken = String(envToken).trim();
    log(`[ZKBIO] browserToken loaded from env (ZKBIO_BROWSER_TOKEN)`);
    return true;
  }

  return false;
}

// Remembers the raw login response (headers/body) so refreshBrowserToken can
// inspect them without a second request.
let zkLoginRespHeaders = {};
let zkLoginRespBody = '';

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
      'browser-token': DOOR_OPEN.browserToken || '',
    },
    body: form,
  });

  // remember raw login response so refreshBrowserToken can inspect it
  zkLoginRespHeaders = res.headers || {};
  zkLoginRespBody = res.body || '';

  const setCookie = res.headers['set-cookie'] || [];
  const sessionLine = setCookie.find((c) => String(c).toUpperCase().startsWith('SESSION='));
  if (!sessionLine) {
    throw new Error(`ZKBio login: no SESSION cookie received (status=${res.statusCode})`);
  }

  zkCookie = sessionLine.split(';')[0];
  log('[ZKBIO] SESSION acquired: YES');

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

    log(`[ZKBIO] Access Control page loaded: YES (${nextPath})`);
  } catch (e) {
    log(`[ZKBIO] landing skipped: ${e.message}`);
  }

  await refreshBrowserToken();

  log(`✅ ZKBio login OK, session+token status: browserToken acquired: ${/^[a-f0-9]{32}$/i.test(DOOR_OPEN.browserToken) ? 'YES' : 'NO'}`);
}

async function zkOpenDoor() {
  // ── PROVEN single-POST door-open (captured HAR) ─────────────────────
  // POST /accLevel.do?openDoor&name=All%20Doors  with levelLoginPwd etc.
  // Success ONLY when HTTP 200 AND body contains "success":true.
  async function doOpen() {
    const body = querystring.stringify({
      levelLoginPwd: ZKBIO_PASS_PLAIN,
      loginPwd: ZKBIO_PASS_MD5,
      openInterval: DOOR_OPEN.openInterval,
      ids: DOOR_OPEN.ids,
      names: DOOR_OPEN.names,
      browserToken: DOOR_OPEN.browserToken,
    });

    log('[ZKBIO] Sending REAL OPEN DOOR command via accLevel.do...');
    log(`        Door ID: ${DOOR_OPEN.ids}`);
    log(`        Door/Level: ${DOOR_OPEN.names}`);

    const res = await httpsReq({
      hostname: ZKBIO_HOST,
      port: ZKBIO_PORT,
      path: '/accLevel.do?openDoor&name=All%20Doors',
      method: 'POST',
      headers: {
        'Host': `${ZKBIO_HOST}:${ZKBIO_PORT}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        'browser-token': DOOR_OPEN.browserToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': `https://${ZKBIO_HOST}:${ZKBIO_PORT}`,
        'Referer': `https://${ZKBIO_HOST}:${ZKBIO_PORT}/main.do?home&selectSysCode=Acc`,
        Cookie: zkCookieHeader(),
      },
      body,
    });

    return res;
  }

  if (!zkCookie) {
    log('[ZKBIO] No session — logging in first...');
    await zkLogin();
  }
  if (!DOOR_OPEN.browserToken) {
    log('[ZKBIO] browserToken missing — refreshing...');
    await refreshBrowserToken();
  }
  if (!DOOR_OPEN.browserToken) {
    throw new Error('ZKBio browserToken is missing — refusing to send door-open command');
  }

  let res = await doOpen();

  // Session expired → re-login, refresh token, and retry once.
  if (res.statusCode === 302) {
    zkCookie = '';
    DOOR_OPEN.browserToken = '';
    log('[ZKBIO] Got 302 — session expired, re-login and retry once...');
    await zkLogin();
    await refreshBrowserToken();
    if (!DOOR_OPEN.browserToken) {
      throw new Error('ZKBio browserToken is missing after re-login — refusing to send door-open command');
    }
    res = await doOpen();
  }

  const bodyText = String(res.body || '');
  log(`[ZKBIO] HTTP: ${res.statusCode}`);
  const is200 = res.statusCode === 200;
  let retOk = false;
  let successTrue = false;
  if (is200) {
    try {
      const j = JSON.parse(bodyText);
      retOk = j.ret === 'ok';
      successTrue = j.success === true;
      log(`        ret: ${j.ret}, msg: ${j.msg}, success: ${j.success}`);
    } catch (_) {
      retOk = bodyText.includes('"ret":"ok"');
      successTrue = bodyText.includes('"success":true');
      log(`        body: ${bodyText.slice(0, 200)}`);
    }
  } else {
    log(`        response: ${bodyText.slice(0, 200)}`);
  }

  if (is200 && retOk && successTrue) {
    log('[DOOR] OPEN COMMAND ACCEPTED');
    return true;
  }
  log('[DOOR] OPEN COMMAND FAILED');
  return false;
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
  // 1) persistent state from a previous run wins — never re-process old events
  if (lastLogId > 0) {
    log(`Resuming from saved lastLogId=${lastLogId} (no history re-processing)`);
    return;
  }
  // 2) no saved state → honour START_FROM_LATEST
  if (!START_FROM_LATEST) {
    lastLogId = 0;
    log('START_FROM_LATEST=false — processing from lastLogId=0');
    return;
  }
  // 3) default: skip all history
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
      SELECT log_id, pin, event_time, event_no, event_name,
             verify_mode_no, verify_mode_name, event_point_name,
             dev_alias, dev_sn, capture_photo_path, unique_key
      FROM public.acc_transaction
      WHERE log_id > $1
      ORDER BY log_id ASC
      LIMIT 50;
      `,
      [lastLogId]
    );

    if (q.rows.length === 0) {
      return; // silence "No new transactions" spam
    }

    for (const row of q.rows) {
      lastLogId = row.log_id;
      saveState(); // mark processed exactly once (persistent across restarts)

      const personnelId = row.pin ? String(row.pin).trim() : '';
      if (!personnelId) continue;

      const capturedAt = row.event_time
        ? new Date(row.event_time).toISOString()
        : new Date().toISOString();

      // ── [EVENT] complete transaction fields ──────────────────────────
      log('');
      log('━━━ [EVENT] ━━━');
      log(`log_id=${row.log_id}`);
      log(`pin=${personnelId}`);
      log(`event_time=${row.event_time}`);
      log(`event_no=${row.event_no}  event_name=${row.event_name}`);
      log(`verify_mode_no=${row.verify_mode_no}  verify_mode_name=${row.verify_mode_name}`);
      log(`door=${row.event_point_name || ''}`);
      log(`device=${row.dev_alias || ''}  sn=${row.dev_sn || ''}`);
      log(`capture_photo_path=${row.capture_photo_path || ''}`);

      const payload = {
        personnelId,
        captured_at: capturedAt,
        event_type: 'access',
        raw: row,
        device: row.dev_alias || 'unknown',
      };

      const supa = await forwardToSupabase(payload);

      // ── [SUPABASE] decision ──────────────────────────────────────────
      let parsed = {};
      try {
        parsed = JSON.parse(supa.body || '{}') || {};
      } catch (_) {}
      log('');
      log('━━━ [SUPABASE] ━━━');
      log(`http=${supa.statusCode}`);
      log(`decision=${parsed.app_result || parsed.decision || parsed.app_result || 'unknown'}`);
      log(`reason=${parsed.reason || ''}`);

      // ── [DOOR] act on decision ───────────────────────────────────────
      const isAllowed =
        parsed.app_result === 'allowed' ||
        parsed.allowed === true ||
        parsed.decision === 'allowed' ||
        parsed.decision === 'ALLOW';

      if (isAllowed) {
        log('');
        log('━━━ [DOOR] OPENING ━━━');
        log('✅ ACCESS APPROVED -> sending door-open command...');
        try {
          const opened = await zkOpenDoor();
          log(opened ? '✅ DOOR OPEN COMMAND SUCCEEDED' : '❌ DOOR OPEN COMMAND FAILED');
        } catch (e) {
          log(`❌ [DOOR] ERROR: ${e.message}`);
        }
      } else {
        log('');
        log('━━━ [DOOR] DENIED ━━━');
        log('Door remains closed.');
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

  log(`Connecting to ZKBio at https://${ZKBIO_HOST}:${ZKBIO_PORT}`);

  // Direct login — no browser dependency.
  try {
    await zkLogin();
    log('✅ ZKBio authentication completed (SESSION + browserToken acquired)');
  } catch (e) {
    log(`⚠ Initial ZKBio login failed: ${e.message}`);
    log('   Relay will continue and retry authentication when a door-open is required.');
  }

  await loadState();
  await initLastLogId();

  log(`Polling acc_transaction every ${POLL_INTERVAL_MS}ms...`);
  setInterval(poll, POLL_INTERVAL_MS);
  poll();
}

start().catch((e) => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
