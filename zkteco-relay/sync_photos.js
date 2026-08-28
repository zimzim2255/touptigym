// ============================================================
// sync_photos.js — pull ZKTeco person photos into the app
// RUN (gym PC):  node sync_photos.js
// (idempotent: only processes children without a photo yet)
// ============================================================
const https = require('https');
const querystring = require('querystring');
const crypto = require('crypto');

// ---------- CONFIG ----------
const ZKBIO_HOST = '192.168.1.202';
const ZKBIO_PORT = 8098;
const ZKBIO_USER = 'admin';
const ZKBIO_PASS_PLAIN = 'Admin123';
const ZKBIO_PASS_MD5 = crypto.createHash('md5').update(ZKBIO_PASS_PLAIN, 'utf8').digest('hex');

const SUPABASE_HOST = 'atvdorphwnpzhobvfmtz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_A6MqQPu7dnrtr04JFtHGBg_rRw8e_Nb';

const CLOUDINARY_CLOUD = 'toutigym';
const CLOUDINARY_UPLOAD_PRESET = 'toutigym_preset';

let zkCookie = '';

function httpsReq({ hostname, port, path, method, headers, body, isJson }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, port, path, method, rejectUnauthorized: false, headers: headers || {} }, (resp) => {
      const chunks = [];
      resp.on('data', (c) => chunks.push(c));
      resp.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ statusCode: resp.statusCode, headers: resp.headers, body: buf.toString(isJson ? 'utf8' : 'binary') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  const form = querystring.stringify({ username: ZKBIO_USER, password: ZKBIO_PASS_MD5 });
  const res = await httpsReq({
    hostname: ZKBIO_HOST, port: ZKBIO_PORT, path: '/login.do', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) },
    body: form, isJson: true,
  });
  const sc = res.headers['set-cookie'] || [];
  const line = sc.find((c) => String(c).toUpperCase().startsWith('SESSION='));
  if (line) zkCookie = line.split(';')[0];
  console.log('  login cookie ok:', !!zkCookie);
  try {
    const parsed = JSON.parse(res.body || '{}');
    const next = parsed?.data ? `/${String(parsed.data).replace(/^\//, '')}` : '/';
    await httpsReq({ hostname: ZKBIO_HOST, port: ZKBIO_PORT, path: next, method: 'GET', headers: { Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}` } });
  } catch (_) {}
}

async function supabaseGet(path) {
  const res = await httpsReq({ hostname: SUPABASE_HOST, port: 443, path, method: 'GET', headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, isJson: true });
  try { return { status: res.statusCode, data: JSON.parse(res.body) }; } catch { return { status: res.statusCode, data: null }; }
}

async function supabasePatch(path, payload) {
  const text = JSON.stringify(payload);
  const res = await httpsReq({ hostname: SUPABASE_HOST, port: 443, path, method: 'PATCH', headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) }, body: text, isJson: true });
  return res;
}

async function uploadToCloudinary(base64NoPrefix) {
  const form = querystring.stringify({ file: `data:image/jpeg;base64,${base64NoPrefix}`, upload_preset: CLOUDINARY_UPLOAD_PRESET, folder: 'toutigym' });
  const res = await httpsReq({ hostname: 'api.cloudinary.com', port: 443, path: '/v1_1/toutigym/auto/upload', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) }, isJson: true, body: form });
  try { return JSON.parse(res.body); } catch { return null; }
}

function extractFirstDataImage(html) {
  const m = html.match(/data:image\/[a-zA-Z0-9+.-]+;base64,([A-Za-z0-9+/=]+)/);
  return m ? { base64: m[1] } : null;
}
// ----- MAIN -----
(async () => {
  console.log('=== ZKTeco photo sync ===');

  // children with zkteco_id but empty photo
  const all = await supabaseGet('/rest/v1/children?select=id,name,zkteco_id,photo&not.zkteco_id.is.null&or=(photo.is.null,photo.eq.)');
  const kids = all.data || [];
  console.log('children w/o photo and with zkteco_id:', kids.length);
  if (!kids.length) { console.log('nothing to do.'); return; }

  await login();

  for (const kid of kids) {
    const zid = kid.zkteco_id;
    console.log(`\n--- child: ${kid.name} (zkteco_id=${zid}) ---`);

    // Candidate person-page URLs to retrieve the embedded photo
    const pageCandidates = [
      `/accPerson.do?queryPerson&personId=${encodeURIComponent(zid)}`,
      `/accPerson.do?getPerson&id=${encodeURIComponent(zid)}`,
      `/accPerson.do?personDetail&personId=${encodeURIComponent(zid)}`,
    ];
    let found = null;
    for (const path of pageCandidates) {
      try {
        const res = await httpsReq({
          hostname: ZKBIO_HOST, port: ZKBIO_PORT, path, method: 'GET',
          headers: { Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}`, 'X-Requested-With': 'XMLHttpRequest' },
        });
        found = extractFirstDataImage(res.body || '');
        if (found) { console.log('  found photo via', path); break; }
      } catch (_) {}
    }

    if (!found) {
      console.log('  ⚠ no photo found in candidate pages — run probe_photo.js to discover the right URL');
      continue;
    }
    console.log('  extracted base64 len', found.base64.length);

    const up = await uploadToCloudinary(found.base64);
    if (!up || !up.secure_url) { console.log('  ⚠ cloudinary upload failed', up); continue; }
    console.log('  uploaded:', up.secure_url);

    const res = await supabasePatch(`/rest/v1/children?id=eq.${encodeURIComponent(kid.id)}`, { photo: up.secure_url });
    console.log('  supabase update', res.statusCode);
  }
  console.log('\n=== done ===');
})();