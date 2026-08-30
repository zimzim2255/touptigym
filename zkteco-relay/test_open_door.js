require('dotenv').config();

const https = require('https');

const HOST = process.env.ZKBIO_HOST;
const PORT = Number(process.env.ZKBIO_PORT);

const SESSION = process.env.ZKBIO_SESSION;
const BROWSER_TOKEN = process.env.ZKBIO_BROWSER_TOKEN;

const body =
  'type=openDoor' +
  '&ids=4028814aa04db40301a04db94cd30a30' +
  '&name=192.168.1.201-1' +
  '&disabledDoorsName=' +
  '&offlineDoorsName=' +
  '&notSupportDoorsName=' +
  '&userLoginPwd=Admin123' +
  '&openInterval=5' +
  '&loginPwd=e64b78fc3bc91bcbc7dc232ba8ec59e0' +
  '&browserToken=' + encodeURIComponent(BROWSER_TOKEN);

const options = {
  hostname: HOST,
  port: PORT,

  path: '/accDoor.do?openDoor',

  method: 'POST',

  rejectUnauthorized: false,

  headers: {
    'Host': `${HOST}:${PORT}`,

    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',

    'Accept':
      'application/json, text/javascript, */*; q=0.01',

    'Accept-Language':
      'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',

    'Content-Type':
      'application/x-www-form-urlencoded; charset=UTF-8',

    'pragma': 'no-cache',

    'cache-control': 'no-cache',

    'browser-token':
      BROWSER_TOKEN,

    'X-Requested-With':
      'XMLHttpRequest',

    'Origin':
      `https://${HOST}:${PORT}`,

    'Referer':
      `https://${HOST}:${PORT}/main.do?home&selectSysCode=Acc`,

    'Cookie':
      `org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; SESSION=${SESSION}`,

    'Content-Length':
      Buffer.byteLength(body),
  }
};

console.log('');
console.log('🚪 EXACT ZKBio DOOR TEST');
console.log('==============================');
console.log(`Server: https://${HOST}:${PORT}`);
console.log('Endpoint: /accDoor.do?openDoor');
console.log('Door: 192.168.1.201-1');
console.log('');

const req = https.request(options, (res) => {

  let data = '';

  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {

    console.log('HTTP:', res.statusCode);
    console.log('BODY:', data);
    console.log('');

    if (res.statusCode === 200) {
      console.log('✅ HTTP 200 received');

      if (data.includes('"success":true')) {
        console.log('✅ ZKBio ACCEPTED the door command');
      } else {
        console.log('⚠️ HTTP 200 but response is not success');
      }

    } else {
      console.log(
        `❌ ZKBio returned HTTP ${res.statusCode}`
      );
    }
  });
});

req.on('error', (err) => {
  console.log('');
  console.log('❌ REQUEST ERROR');
  console.log(err.message);
});

req.write(body);
req.end();