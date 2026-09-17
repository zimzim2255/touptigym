/* ============================================================
   register_person.js  —  REGISTRATION / SYNC PROCESS
   ------------------------------------------------------------
   ONE workflow: given a PERSON ID + ORIGINAL PHOTO, it:

     1. Uploads the original photo to Supabase Storage
        -> profiles/{ID}.{ext}   (public bucket)
        (fallback: Cloudinary via the `upload` edge function)

     2. Saves the photo URL linked to the Person ID in the
        `zkteco_photos` holding table (status='pending').

     3. Auto-claims: if a child in the app already has that
        zkteco_id, sets children.photo to the uploaded URL.

   The Person ID is the key that connects the ZKTeco biometric
   registration (done separately in ZKBio) with the original
   photo stored in our system.

   USAGE (gym PC / dev):
     node register_person.js --id 10 --photo C:\path\to\person.jpg
     node register_person.js --id 10 --photo ./10.jpg --storage cloudinary
   ============================================================ */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------- CONFIG ----------
function env(k, d) { return process.env[k] || d; }
const SUPABASE_HOST = env('SUPABASE_HOST', 'atvdorphwnpzhobvfmtz.supabase.co');
const SUPABASE_ANON = env('SUPABASE_ANON', 'sb_publishable_A6MqQPu7dnrtr04JFtHGBg_rRw8e_Nb');
const STORAGE_BUCKET = env('STORAGE_BUCKET', 'profiles');
const USE_CLOUDINARY = String(env('USE_CLOUDINARY', 'false')).toLowerCase() === 'true';

// ---------- tiny CLI ----------
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };
  return {
    id: get('--id'),
    photo: get('--photo'),
    storage: get('--storage') || (USE_CLOUDINARY ? 'cloudinary' : 'supabase'),
    claim: args.includes('--claim'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function l(s) { console.log(`[${new Date().toISOString()}] ${s}`); }

// ---------- minimal https helper ----------
function req({ method, hostname, port = 443, path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const r = https.request({ method, hostname, port, path, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: buf });
      });
    });
    r.on('error', reject);
    if (body != null) r.write(body);
    r.end();
  });
}

// ---------- media type by extension ----------
function mimeOf(filename) {
  const ext = (path.extname(filename) || '.jpg').toLowerCase().replace('.', '');
  if (['png'].includes(ext)) return 'image/png';
  if (['webp'].includes(ext)) return 'image/webp';
  if (['gif'].includes(ext)) return 'image/gif';
  if (['bmp'].includes(ext)) return 'image/bmp';
  return 'image/jpeg';
}

function extOf(filename) {
  let e = (path.extname(filename) || '.jpg').toLowerCase().replace('.', '');
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(e)) e = 'jpg';
  if (e === 'jpeg') e = 'jpg';
  return e;
}

/* ---------- 1) Upload photo to Supabase Storage ---------- */
async function uploadToSupabaseStorage(fileBuf, mime, objectPath) {
  const res = await req({
    method: 'POST',
    hostname: SUPABASE_HOST,
    path: `/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': mime,
      'x-upsert': 'true',
      'Cache-Control': '3600',
    },
    body: fileBuf,
  });
  if (res.status >= 200 && res.status < 300) {
    return {
      ok: true,
      url: `https://${SUPABASE_HOST}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`,
    };
  }
  return { ok: false, status: res.status, body: res.body.toString().slice(0, 300) };
}
/* ---------- 1b) Fallback: Cloudinary via upload edge function ---------- */
async function uploadToCloudinary(fileBuf, filename) {
  const boundary = '----registerperson' + Date.now().toString(16);
  const parts = [];
  const appendField = (name, value) => {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  };
  appendField('folder', 'profiles');
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeOf(filename)}\r\n\r\n`
  ));
  parts.push(fileBuf);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);
  const res = await req({
    method: 'POST',
    hostname: SUPABASE_HOST,
    path: '/functions/v1/upload',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    body,
  });
  try {
    const j = JSON.parse(res.body.toString());
    if (res.status >= 200 && res.status < 300 && j.url) return { ok: true, url: j.url, public_id: j.public_id };
    return { ok: false, status: res.status, body: res.body.toString().slice(0, 300) };
  } catch {
    return { ok: false, status: res.status, body: res.body.toString().slice(0, 300) };
  }
}

/* ---------- 2) Upsert into zkteco_photos ---------- */
async function saveHeldPhoto(zktecoId, photoUrl, publicId) {
  const body = JSON.stringify({
    zkteco_id: zktecoId,
    photo_url: photoUrl,
    cloudinary_public_id: publicId || null,
    source: 'profile',
    status: 'pending',
  });
  const res = await req({
    method: 'POST',
    hostname: SUPABASE_HOST,
    path: '/rest/v1/zkteco_photos',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body,
  });
  return { ok: res.status >= 200 && res.status < 300, status: res.status, body: res.body.toString().slice(0, 200) };
}

/* ---------- 3) Auto-claim into children ---------- */
async function claimIntoChildren(zktecoId, photoUrl, doClaim) {
  if (!doClaim) return { claimed: false, reason: '--claim not passed' };
  const find = await req({
    method: 'GET',
    hostname: SUPABASE_HOST,
    path: `/rest/v1/children?select=id,name&zkteco_id=eq.${encodeURIComponent(zktecoId)}&limit=1`,
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  let rows = [];
  try { rows = JSON.parse(find.body.toString()); } catch {}
  if (find.status !== 200 || !rows.length) return { claimed: false, reason: 'no child with that zkteco_id yet (photo kept pending)' };

  const childId = rows[0].id;
  const patch = await req({
    method: 'PATCH',
    hostname: SUPABASE_HOST,
    path: `/rest/v1/children?id=eq.${encodeURIComponent(childId)}`,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ photo: photoUrl }),
  });
  if (patch.status >= 200 && patch.status < 300) return { claimed: true, childId, name: rows[0].name };
  return { claimed: false, reason: 'children PATCH failed (' + patch.status + ') — photo kept pending for app claim' };
}

/* ---------- main ---------- */
(async () => {
  const A = parseArgs();
  if (A.help || !A.id || !A.photo) {
    console.log(`
register_person.js — register a person with their ORIGINAL photo

USAGE:
  node register_person.js --id <PERSON_ID> --photo <path/to/photo> [--storage supabase|cloudinary] [--claim]

Examples:
  node register_person.js --id 10 --photo C:\\photos\\person10.jpg --claim
`);
    process.exit(A.help ? 0 : 1);
  }

  if (!fs.existsSync(A.photo)) {
    l('❌ photo file not found: ' + A.photo);
    process.exit(1);
  }
  const fileBuf = fs.readFileSync(A.photo);
  const ext = extOf(A.photo);
  const objectPath = `${A.id}.${ext}`;

  l(`Person ID: ${A.id}  |  Photo: ${A.photo} (${fileBuf.length} bytes) → profiles/${objectPath}`);

  // STEP 1 — upload
  let upload;
  if (A.storage === 'cloudinary') {
    l('Uploading to Cloudinary (folder=profiles)...');
    upload = await uploadToCloudinary(fileBuf, `${A.id}.${ext}`);
  } else {
    l(`Uploading to Supabase Storage: profiles/${objectPath}...`);
    upload = await uploadToSupabaseStorage(fileBuf, mimeOf(A.photo), objectPath);
  }

  if (!upload.ok) {
    // fallback to the other one
    if (A.storage !== 'cloudinary') {
      l('⚠ Supabase Storage failed — trying Cloudinary fallback... ' + JSON.stringify({ status: upload.status, body: upload.body }));
      upload = await uploadToCloudinary(fileBuf, `${A.id}.${ext}`);
    } else {
      l('⚠ Cloudinary failed — trying Supabase Storage fallback...');
      upload = await uploadToSupabaseStorage(fileBuf, mimeOf(A.photo), objectPath);
    }
  }

  if (!upload.ok) {
    l('❌ upload FAILED: ' + JSON.stringify(upload));
    process.exit(1);
  }
  l('✅ uploaded → ' + upload.url);

  // STEP 2 — save to zkteco_photos (linked by ID)
  const held = await saveHeldPhoto(A.id, upload.url, upload.public_id || null);
  l(held.ok ? `✅ linked Person ID ${A.id} -> photo (zkteco_photos, pending)` : '⚠ zkteco_photos upsert issue: ' + JSON.stringify(held));

  // STEP 3 — auto-claim
  const claim = await claimIntoChildren(A.id, upload.url, A.claim);
  if (claim.claimed) l(`✅ auto-claimed → children.photo set for ${claim.name} (${claim.childId})`);
  else l('ℹ ' + (claim.reason || 'not claimed'));

  l(`DONE — Person ID ${A.id} ↔ ${upload.url}`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });