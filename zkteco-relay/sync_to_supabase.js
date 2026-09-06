/* ============================================================
   sync_to_supabase.js — ZKBio → Supabase Edge Function Bridge
   ------------------------------------------------------------
   1. Reads the ORIGINAL photo file.
   2. Calls ZKBio's validPersonPhoto endpoint (with exact browser headers).
   3. Sends the Base64 image to the Supabase Edge Function.
   ============================================================ */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------- CONFIG ----------
function env(k, d) { return process.env[k] || d; }

const ZKBIO_HOST = env('ZKBIO_HOST', '192.168.1.202');
const ZKBIO_PORT = Number(env('ZKBIO_PORT', 8098));

// ⚠️ IMPORTANT: Paste your FRESH cookie value here, or set it via environment variable
const ZKBIO_SESSION = env('ZKBIO_SESSION', 'org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; SESSION=PASTE_YOUR_FRESH_SESSION_COOKIE_HERE');

const SUPABASE_URL = env('SUPABASE_URL', 'https://atvdorphwnpzhobvfmtz.supabase.co');
const SUPABASE_ANON = env('SUPABASE_ANON', 'sb_publishable_A6MqQPu7dnrtr04JFtHGBg_rRw8e_Nb');

// ---------- CLI ----------
const args = process.argv.slice(2);
const get = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
const personId = get('--id');
const photoPath = get('--photo');

if (!personId || !photoPath) {
  console.log('Usage: node sync_to_supabase.js --id <PERSON_ID> --photo <path/to/photo.jpg>');
  process.exit(1);
}

// ---------- minimal HTTPS helper ----------
function req({ hostname, port, path, method, headers = {}, body, rejectUnauthorized }) {
  return new Promise((resolve, reject) => {
    const r = https.request(
      { method, hostname, port, path, headers, rejectUnauthorized: rejectUnauthorized === false ? false : true },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      }
    );
    r.on('error', reject);
    if (body != null) r.write(body);
    r.end();
  });
}

/* ---------- 1) ZKBio: get valid Base64 from the original photo ---------- */
async function getValidBase64FromZkbio(fileBuf, filename) {
  const boundary = '----geckoformboundary' + Date.now().toString(16);
  const parts = [];
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="personPhoto"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`
  ));
  parts.push(fileBuf);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  console.log('📤 1/2 Sending photo to ZKBio validPersonPhoto...');
  
  const res = await req({
    method: 'POST',
    hostname: ZKBIO_HOST,
    port: ZKBIO_PORT,
    path: '/persPerson.do?validPersonPhoto',
    headers: {
      // Exact headers from the working HAR file
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': `https://${ZKBIO_HOST}:${ZKBIO_PORT}`,
      'Referer': `https://${ZKBIO_HOST}:${ZKBIO_PORT}/main.do?home&selectSysCode=Pers`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
      'Cookie': ZKBIO_SESSION,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    body,
    rejectUnauthorized: false, // Ignore self-signed cert warnings
  });

  console.log(`  ZKBio validPersonPhoto -> HTTP ${res.status}`);
  
  let parsed;
  try { 
    parsed = JSON.parse(res.body.toString()); 
  } catch { 
    parsed = null; 
  }

  if (res.status !== 200 || !parsed || parsed.ret !== 'ok' || !parsed.data) {
    console.error('  ❌ ZKBio returned error:', parsed ? JSON.stringify(parsed) : res.body.toString().slice(0, 300));
    console.error('  💡 TIP: Your SESSION cookie likely expired. Get a fresh one from the browser Network tab!');
    process.exit(1);
  }
  
  console.log(`  ✅ Received valid Base64 from ZKBio (${String(parsed.data).length} chars)`);
  return String(parsed.data);
}

/* ---------- 2) Supabase Edge Function: save to storage + DB ---------- */
async function sendToSupabase(personId, base64Image) {
  console.log('🚀 2/2 Sending to Supabase Edge Function save-zkteco-photo...');
  
  const body = JSON.stringify({ personId, base64Image });
  const res = await req({
    method: 'POST',
    hostname: SUPABASE_URL.replace('https://', ''),
    port: 443,
    path: '/functions/v1/save-zkteco-photo',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });
  
  let j;
  try { j = JSON.parse(res.body.toString()); } catch { j = null; }
  return { status: res.status, json: j, raw: res.body.toString().slice(0, 300) };
}

/* ---------- main ---------- */
(async () => {
  if (!fs.existsSync(photoPath)) {
    console.error('❌ photo file not found:', photoPath);
    process.exit(1);
  }
  
  const fileBuf = fs.readFileSync(photoPath);
  const filename = path.basename(photoPath);
  console.log(`[${new Date().toISOString()}] sync Person ID: ${personId}  |  photo: ${filename} (${fileBuf.length} bytes)`);

  // 1) ZKBio → valid base64 JPEG
  const base64 = await getValidBase64FromZkbio(fileBuf, filename);

  // 2) Supabase Edge Function
  const r = await sendToSupabase(personId, base64);
  console.log(`  Edge function -> HTTP ${r.status}`);
  console.log(r.json ? '  response: ' + JSON.stringify(r.json) : '  raw: ' + r.raw);

  if (r.status >= 200 && r.status < 300 && r.json?.success) {
    console.log('🎉 SUCCESS — original photo saved to Supabase Storage + zkteco_photos');
    console.log('🔗 photoUrl:', r.json.photoUrl);
    console.log('   (The app will now auto-show this photo when the admin types ID ' + personId + ')');
  } else {
    console.error('❌ Edge function failed; check deployment + SERVICE_ROLE_KEY secret.');
    process.exit(1);
  }
})().catch((e) => { 
  console.error('FATAL:', e.message); 
  process.exit(1); 
});