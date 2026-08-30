// test_cookie.js — debug why the SESSION cookie isn't captured
const fs = require('fs');
const path = require('path');
const os = require('os');
const { findZkBsessionCookie, readCookieFile, readSqliteRows } = require('./cookie_reader');

console.log('APPDATA:', process.env.APPDATA);
const profilesRoot = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Mozilla', 'Firefox', 'Profiles');
console.log('Profiles root:', profilesRoot);
console.log('Exists?', fs.existsSync(profilesRoot));

if (fs.existsSync(profilesRoot)) {
  for (const dir of fs.readdirSync(profilesRoot)) {
    const db = path.join(profilesRoot, dir, 'cookies.sqlite');
    console.log(`\nProfile: ${dir}`);
    console.log('  cookies.sqlite:', db, 'exists=', fs.existsSync(db));
    if (!fs.existsSync(db)) continue;
    try {
      const rows = readSqliteRows(db, 'moz_cookies');
      console.log('  moz_cookies rows:', rows ? rows.length : null);
      if (rows) {
        const hosts = {};
        for (const r of rows) {
          const name = String(r[2] || '');
          const host = String(r[4] || '');
          hosts[host] = (hosts[host] || 0) + 1;
          if (/192\.168|localhost/.test(host) || /session|SESS/i.test(name)) {
            console.log(`  -> cookie name=${name} host=${host} value=${String(r[3] || '').slice(0, 40)}`);
          }
        }
        console.log('  hosts seen:', Object.keys(hosts).join(', '));
      }
    } catch (e) { console.log('  ERR', e.message); }
  }
}

// Chrome
const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
for (const b of ['Google', 'Chrome', 'Microsoft', 'Edge']) {console.log('\n' + b + ' cookies DB exists?', ['Google','Chrome'].includes(b) ? fs.existsSync(path.join(local, b, 'User Data', 'Default', 'Cookies')) : fs.existsSync(path.join(local, b, 'User Data', 'Default', 'Cookies')));}

// fallback file
console.log('\nzkcookie.txt?', fs.existsSync(path.join(__dirname, 'zkcookie.txt')));
const cap = findZkBsessionCookie();
console.log('findZkBsessionCookie() ->', cap);