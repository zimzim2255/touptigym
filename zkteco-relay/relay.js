const { Client } = require('pg');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');
const path = require('path');

const SUPABASE_URL =
  'https://atvdorphwnpzhobvfmtz.supabase.co/functions/v1/zkteco/events';
const DEVICE_TOKEN = 'zk_relay_2026_9X4K_secret';

// --- Photo-import config (device face photo → child profile photo) ---
const SUPABASE_REST_HOST = 'atvdorphwnpzhobvfmtz.supabase.co';
const SUPABASE_REST_BASE = '/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_A6MqQPu7dnrtr04JFtHGBg_rRw8e_Nb';
// Cloudinary direct signed upload (from your Cloudinary dashboard)
const CLOUDINARY_CLOUD = 'td3fzirz'; // NOT toutigym
const CLOUDINARY_API_KEY = '486274344365529';
const CLOUDINARY_API_SECRET = '3LaqXDn-69bmwidN0OJFPan0_tM';
const CLOUDINARY_UPLOAD_PRESET = 'ml_default';

// ZKBio local web — HTTPS (browser proof: https://192.168.1.202:8098)
const ZKBIO_HOST = '192.168.1.202';
const ZKBIO_PORT = 8098;
const ZKBIO_USER = 'admin';
const ZKBIO_PASS_PLAIN = 'Admin123'; // used for userLoginPwd
const ZKBIO_PASS_MD5 = crypto.createHash('md5').update(ZKBIO_PASS_PLAIN, 'utf8').digest('hex'); // loginPwd

// Door open payload (captured from DevTools — working request for this gym/ZKB)
const DOOR_OPEN = {
  openInterval: '5',
  ids: '4028814aa04db40301a04db94cd30a30',
  names: '192.168.1.201-1', // the actual door name (from capture)
  browserToken: '0b45e7fee18e61df2237db91b10fd447', // hardcoded temp — paired with SESSION capture; automate later
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
// Starts EMPTY — the relay captures it automatically from the browser
// (Firefox cookies.sqlite) once someone logs into ZKBio. No hardcoding needed.
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

// Pull a fresh browser-token from the ZKBio session by GETting the main page.
// Called at startup and after a fresh login if the token is empty.
async function refreshBrowserToken() {
  try {
    const init = await httpsReq({ hostname: ZKBIO_HOST, port: ZKBIO_PORT, path: '/main.do?home&selectSysCode=Pers', method: 'GET', headers: { Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}` } });
    const html = init.body || '';
    // look for browser-token in script/var/header
    let m = html.match(/browser[\s_:-]*token['"]?\s*[:=]\s*['"]?([a-f0-9]{32})/i);
    if (!m) m = html.match(/['"]browserToken['"]\s*:\s*['"]([a-f0-9]{32})['"]/i);
    if (m) { DOOR_OPEN.browserToken = m[1]; return true; }
    // try response header
    const h = init.headers['browser-token'] || init.headers['Browser-Token'];
    if (h && /^[a-f0-9]{32}$/i.test(String(h))) { DOOR_OPEN.browserToken = String(h); return true; }
    return false;
  } catch (_) { return false; }
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

// ── Photo import from device face capture ────────────────────────────

// Get an existing held photo row for a ZKTeco id (null if none).

// Fetch the photo for relPath. ZKBio stores files under:
// C:\Program Files\ZKBio CVAccess\service\zkbiosecurity\BioSecurityFile\upload\...
// relPath like /upload/pers/user/avatar/2026-08-28/7.jpg
const ZKBIO_FILE_ROOT = 'C:\\Program Files\\ZKBio CVAccess\\service\\zkbiosecurity\\BioSecurityFile';
// Prefer the device-camera face crop (real per-person photo), fall back to avatar.
function fetchZkPhoto(relPath, pin) {
  return new Promise((resolve) => {
    const fs = require('fs');
    const path = require('path');
    const pinStr = String(pin || '');
    const rootsToTry = [];

    if (pinStr) {
      rootsToTry.push(
        path.join(ZKBIO_FILE_ROOT, 'upload', 'pers', 'user', 'cropface', pinStr, `${pinStr}.jpg`),
        path.join(ZKBIO_FILE_ROOT, 'upload', 'pers', 'user', 'cropface', `${pinStr}.jpg`),
      );
    }
    // avatar from DB relPath
    const rel = String(relPath).replace(/^[/\\]+/, '');
    rootsToTry.push(
      path.join(ZKBIO_FILE_ROOT, rel),
      path.join(ZKBIO_FILE_ROOT, rel.replace(/^upload[/\\]?/, '')),
    );

    for (const p of rootsToTry) {
      try {
        const buf = fs.readFileSync(p);
        if (buf && buf.length > 100) {
          log(`  read local ${p} bytes=${buf.length}`);
          return resolve(buf);
        }
      } catch (_) {}
    }
    log(`  ⚠ local file not found for pin=${pinStr} rel=${relPath}`);
    resolve(null);
  });
}

// Upload to Cloudinary and return the parsed result ({secure_url, public_id}).
// Uses SIGNED authentication (API key + secret + SHA-1 signature) so it works
// without an unsigned preset.
function uploadToCloudinaryReturn(buf) {
  return new Promise((resolve) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'children';
    const crypto = require('crypto');

    // Signature = SHA1(sorted "param=value&..." + secret)  (timestamp & folder)
    const toSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(toSign, 'utf8').digest('hex');

    const boundary = '----RelayBoundary' + Date.now().toString(16);
    const CRLF = '\r\n';
    let bodyBuf = Buffer.from('');
    const appendStr = (s) => { bodyBuf = Buffer.concat([bodyBuf, Buffer.from(s)]); };
    const appendBuf = (b) => { bodyBuf = Buffer.concat([bodyBuf, b]); };

    function addField(name, value) {
      appendStr(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`);
    }
    addField('folder', folder);
    addField('timestamp', timestamp);
    addField('api_key', CLOUDINARY_API_KEY);
    addField('signature', signature);
    appendStr(`--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="photo.jpg"${CRLF}Content-Type: image/jpeg${CRLF}${CRLF}`);
    appendBuf(buf);
    appendStr(`${CRLF}--${boundary}--${CRLF}`);

    const req = https.request(
      { hostname: 'api.cloudinary.com', port: 443, path: `/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': bodyBuf.length } },
      (resp) => {
        let out = '';
        resp.on('data', (c) => (out += c));
        resp.on('end', () => {
          try {
            const j = JSON.parse(out);
            if (j.secure_url) return resolve({ secure_url: j.secure_url, public_id: j.public_id || '' });
            log(`  ⚠ cloudinary said: ${JSON.stringify(j).slice(0, 300)}`);
            resolve(null);
          } catch { resolve(null); }
        });
      }
    );
    req.on('error', (e) => { log(`  ⚠ cloudinary req error: ${e.message}`); resolve(null); });
    req.end(bodyBuf);
  });
}

// Get an existing held photo row for a ZKTeco id (null if none).
function getHeldPhoto(zktecoId) {
  return new Promise((resolve) => {
    const path = `${SUPABASE_REST_BASE}/zkteco_photos?select=id,zkteco_id,photo_url&zkteco_id=eq.${encodeURIComponent(zktecoId)}&limit=1`;
    const req = https.request(
      { hostname: SUPABASE_REST_HOST, port: 443, path, method: 'GET', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
      (resp) => {
        let out = '';
        resp.on('data', (c) => (out += c));
        resp.on('end', () => {
          try { const rows = JSON.parse(out); resolve(rows && rows[0] ? rows[0] : null); }
          catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Insert a held-photo row (upsert on zkteco_id).
function upsertHeldPhoto(zktecoId, cloudResult) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      zkteco_id: zktecoId,
      photo_url: cloudResult.secure_url,
      cloudinary_public_id: cloudResult.public_id || '',
      source: 'device',
      status: 'pending',
    });
    const path = `${SUPABASE_REST_BASE}/zkteco_photos?on_conflict=zkteco_id`;
    const req = https.request(
      { hostname: SUPABASE_REST_HOST, port: 443, path, method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Prefer: 'resolution=merge-duplicates' } },
      (resp) => { resp.resume(); resp.on('end', () => resolve(resp.statusCode < 300)); }
    );
    req.on('error', () => resolve(false));
    req.end(body);
  });
}

// Look up the person's stored profile photo path in ZKBio's PostgreSQL.
// pers_person.pin / number_pin = the ZKTeco PIN the device uses.
// pers_person.photo_path = browser-uploaded avatar
async function getZkPersonPhotoPath(pin) {
  // 1) Match by pin (exact)
  try {
    const q = await pgClient.query(
      `SELECT photo_path FROM public.pers_person WHERE pin = $1 OR number_pin = $1 OR CAST(number_pin AS text) = $1 LIMIT 1`,
      [pin]
    );
    if (q.rows.length && q.rows[0].photo_path) return q.rows[0].photo_path;
  } catch (_) {}

  // 2) Match by filename containing /<pin>. (e.g. .../7.jpg)
  try {
    const q2 = await pgClient.query(
      `SELECT photo_path FROM public.pers_person WHERE photo_path ILIKE '%/${pin}.%' LIMIT 1`
    );
    if (q2.rows.length) return q2.rows[0].photo_path;
  } catch (_) {}

  return null;
}

// Called from poll() when a transaction carries a capture_photo_path (device-camera
// face snap). Also covers browser-uploaded avatars via pers_person.photo_path.
// All photos are written to the zkteco_photos HOLDING table; the app claims them
// when a child is created/edited with that ZKTeco ID.
async function tryImportPhoto(pin, capturePhotoPath) {
  try {
    const existing = await getHeldPhoto(pin);
    if (existing) return; // already held

    let relPath = capturePhotoPath;
    if (!relPath) {
      relPath = await getZkPersonPhotoPath(pin); // browser-uploaded avatar
    }
    if (!relPath) {
      log(`  ⚠ no photo path for pin=${pin} (device or DB)`);
      return;
    }

    log(`📸 Holding photo for pin=${pin} from ${relPath}...`);
    const buf = await fetchZkPhoto(relPath, pin);
    if (!buf || buf.length < 500) { log('  ⚠ no photo content from ZKBio'); return; }
    const up = await uploadToCloudinaryReturn(buf);
    if (!up) { log('  ⚠ cloudinary upload failed'); return; }
    const ok = await upsertHeldPhoto(pin, up);
    log(ok ? `  ✅ Photo held for pin=${pin}: ${up.secure_url}` : '  ⚠ supabase upsert failed');
  } catch (e) {
    log(`  ⚠ photo import error: ${e.message}`);
  }
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

      // Auto-import device face photo as the child's profile picture
      await tryImportPhoto(personnelId, row.capture_photo_path);

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

// ── Periodic photo sync (browser-uploaded avatars) ─────────────────
// When you upload a photo in the ZKBio browser for a child, that never
// creates a door transaction, so the poll() alone never imports it.
// This loop periodically checks your app's children that still lack a
// photo and pulls their stored ZKBio avatar (pers_person.photo_path).
async function getChildrenWithoutPhoto() {
  return new Promise((resolve) => {
    const qs = 'select=id,name,zkteco_id,photo&not.zkteco_id.is.null&or=(photo.is.null,photo.eq.)';
    const req = https.request(
      { hostname: SUPABASE_REST_HOST, port: 443, path: `${SUPABASE_REST_BASE}/children?${qs}`, method: 'GET', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
      (resp) => {
        let out = '';
        resp.on('data', (c) => (out += c));
        resp.on('end', () => {
          try { resolve(JSON.parse(out) || []); } catch { resolve([]); }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.end();
  });
}

let syncRunning = false;
async function syncPhotosToHold() {
  if (syncRunning) return;
  syncRunning = true;
  try {
    // Every ZKBio person that has a stored profile/avatar photo
    const q = await pgClient.query(
      `SELECT pin, photo_path FROM public.pers_person WHERE photo_path IS NOT NULL AND pin IS NOT NULL ORDER BY pin`
    );
    if (!q.rows.length) return;
    log(`🖼️ photo-to-hold sync: ${q.rows.length} persons with a photo in ZKBio`);
    let done = 0, held = 0;
    for (const r of q.rows) {
      const pin = String(r.pin).trim();
      if (!pin) continue;

      // skip if already in the holding table (pending or claimed)
      const existing = await getHeldPhoto(pin);
      if (existing) { held++; continue; }

      const buf = await fetchZkPhoto(r.photo_path, r.pin);
      if (!buf || buf.length < 500) { log(`  ⚠ pin=${pin} no photo content from ${r.photo_path}`); continue; }
      const up = await uploadToCloudinaryReturn(buf);
      if (!up) { log(`  ⚠ pin=${pin} cloudinary upload failed`); continue; }

      await upsertHeldPhoto(pin, up);
      done++;
      log(`  ✅ held photo for pin=${pin} -> ${up.secure_url}`);
    }
    log(`photo-to-hold done: new=${done} already_held=${held}`);
  } catch (e) {
    log(`Photo-to-hold error: ${e.message}`);
  } finally {
    syncRunning = false;
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

  // DEBUG: dump how ZKBio stores person photos so we can see the mapping
  try {
    const dbg = await pgClient.query(
      `SELECT id, pin, number_pin, pin_letter, photo_path FROM public.pers_person WHERE photo_path IS NOT NULL LIMIT 20`
    );
    log(`DEBUG pers_person with photo: ${dbg.rows.length}`);
    for (const r of dbg.rows) {
      log(`  pin=${r.pin} number_pin=${r.number_pin} id=${r.id} photo=${r.photo_path}`);
    }
  } catch (e) {
    log(`DEBUG pers_person read failed: ${e.message}`);
  }

  await initLastLogId();

  log(`Polling acc_transaction every ${POLL_INTERVAL_MS}ms...`);
  setInterval(poll, POLL_INTERVAL_MS);
  poll();

  // Periodic photo import from ZKBio persons into the holding table (every 60s)
  const PHOTO_SYNC_MS = 60 * 1000;
  log('Photo-to-hold sync every 60s...');
  setInterval(syncPhotosToHold, PHOTO_SYNC_MS);
  syncPhotosToHold();
}

start().catch((e) => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
