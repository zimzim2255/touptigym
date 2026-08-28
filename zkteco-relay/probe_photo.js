// ============================================================
// PROBE: discover how ZKBio serves a person's photo.
// Run on the gym PC:  node probe_photo.js
// It fetches the person list + detail pages and looks for base64
// image data / <img> URLs so we can build the photo sync.
// ============================================================
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const ZKBIO_HOST = '192.168.1.202';
const ZKBIO_PORT = 8098;
const ZKBIO_USER = 'admin';
const ZKBIO_PASS_PLAIN = 'Admin123';
const ZKBIO_PASS_MD5 = crypto.createHash('md5').update(ZKBIO_PASS_PLAIN, 'utf8').digest('hex');

let zkCookie = '';

function httpsReq({ hostname, port, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, port, path, method, rejectUnauthorized: false, headers: headers || {} }, (resp) => {
      let data = '';
      resp.on('data', (c) => (data += c));
      resp.on('end', () => resolve({ statusCode: resp.statusCode, headers: resp.headers, body: data }));
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
    body: form,
  });
  const sc = res.headers['set-cookie'] || [];
  const line = sc.find((c) => String(c).toUpperCase().startsWith('SESSION='));
  if (line) zkCookie = line.split(';')[0];
  console.log('login status', res.statusCode, 'cookie', zkCookie ? 'ok' : 'none');
  try {
    const parsed = JSON.parse(res.body || '{}');
    const next = parsed?.data ? `/${String(parsed.data).replace(/^\//,'')}` : '/';
    await httpsReq({ hostname: ZKBIO_HOST, port: ZKBIO_PORT, path: next, method: 'GET', headers: { Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}` } });
  } catch (_) {}
}

// candidate endpoints that may return person HTML/JSON/photo
const candidates = [
  '/accPerson.do?queryPerson&departmentId=',
  '/accPerson.do?action=getList&page=1&rows=20',
  '/accPerson.do?getAllPerson',
  '/accPerson.do?list&page=1&rows=20',
  '/accPerson.do?queryPersonList&page=1&rows=20',
  '/accPerson.do?data&page=1&rows=20',
  '/accPerson.do?getPhoto&personId=7',
  '/accPerson.do?getImg&personId=7',
  '/accPerson.do?getPersonPhoto&personId=7',
];

(async () => {
  await login();
  for (const path of candidates) {
    try {
      const res = await httpsReq({
        hostname: ZKBIO_HOST, port: ZKBIO_PORT, path, method: 'GET',
        headers: { Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; ${zkCookie}`, 'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*' },
      });
      const ct = String(res.headers['content-type'] || '');
      const isHtml = /html/.test(ct);
      const isJson = /json/.test(ct);
      const body = res.body || '';
      const hasB64 = /base64|data:image/i.test(body);
      console.log(`\n[${path}]`);
      console.log(`  ${res.statusCode} ${ct} len=${body.length} hasBase64=${hasB64}`);
      if (isHtml) {
        // extract img tags / data uris
        const imgs = body.match(/<img[^>]+src=["']([^"']+)/gi) || [];
        console.log('  img tags:', imgs.slice(0, 5));
      }
      if (isJson) {
        console.log('  json head:', body.slice(0, 300));
      }
    } catch (e) {
      console.log(`\n[${path}] ERR ${e.message}`);
    }
  }
})();