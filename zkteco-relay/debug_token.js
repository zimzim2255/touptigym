// TEMP DEBUG: dump how ZKBio provides the browser-token after login
const { Client } = require('pg');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const ZKBIO_HOST = '192.168.1.202';
const ZKBIO_PORT = 8098;
const ZKBIO_USER = 'admin';
const ZKBIO_PASS_PLAIN = 'Admin123';
const ZKBIO_PASS_MD5 = crypto.createHash('md5').update(ZKBIO_PASS_PLAIN, 'utf8').digest('hex');

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

(async () => {
  const form = querystring.stringify({ username: ZKBIO_USER, password: ZKBIO_PASS_MD5 });
  const res = await httpsReq({ hostname: ZKBIO_HOST, port: ZKBIO_PORT, path: '/login.do', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) }, body: form });
  console.log('LOGIN status', res.statusCode);
  for (const [k, v] of Object.entries(res.headers)) console.log('header', k, '=', v);
  console.log('LOGIN body head:', res.body.slice(0, 400));

  const parsed = JSON.parse(res.body || '{}');
  const nextPath = parsed?.data ? `/${String(parsed.data).replace(/^\//, '')}` : '/';
  const setCookie = res.headers['set-cookie'] || [];
  const sessionLine = setCookie.find((c) => String(c).toUpperCase().startsWith('SESSION='));
  const zkCookie = sessionLine ? sessionLine.split(';')[0] : '';
  console.log('nextPath', nextPath, 'cookie', zkCookie);

  const landing = await httpsReq({ hostname: ZKBIO_HOST, port: ZKBIO_PORT, path: nextPath, method: 'GET', headers: { Cookie: `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; persUsbDevice=0; ${zkCookie}` } });
  console.log('LANDING status', landing.statusCode);
  for (const [k, v] of Object.entries(landing.headers)) console.log('land hdr', k, '=', v);
  const html = landing.body || '';
  console.log('LANDING body length', html.length);
  console.log('LANDING head 1200:', html.slice(0, 1200));
  const m = html.match(/browser[\s_:-]*token['"]?\s*[:=]\s*['"]?([a-f0-9]{32})/i);
  console.log('browserToken regex match:', m ? m[0] : 'NONE');
})();