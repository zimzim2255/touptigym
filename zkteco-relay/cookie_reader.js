// ============================================================
// cookie_reader.js — capture ZKBio SESSION cookie from Firefox
// Firefox stores cookies in cookies.sqlite (plaintext on Windows).
// The relay starts "empty", and once you log into ZKBio in the
// browser, this reads the SESSION cookie so the relay can use it.
// ============================================================
const fs = require('fs');
const os = require('os');
const path = require('path');

// Minimal SQLite reader: only supports reading ALL rows of a named table
// (leaf/interior table b-trees). Enough for moz_cookies.
function readSqliteRows(file, tableName) {
  const buf = fs.readFileSync(file);
  if (buf.length < 100 || buf.toString('latin1', 0, 15) !== 'SQLite format 3') return null;

  const pageSize = buf.readUInt16BE(16) === 1 ? 65536 : buf.readUInt16BE(16);
  const pageOffset = (pg) => (pg - 1) * pageSize;

  function readVarint(b, off) {
    let v = 0, i = off;
    for (let n = 0; n < 8; n++) {
      v = (v << 7) | (b[i] & 0x7f);
      if ((b[i] & 0x80) === 0) return { value: v, length: i - off + 1 };
      i++;
    }
    v = (v << 8) | b[i];
    return { value: v, length: i - off + 1 };
  }

  const rows = [];
  function walk(pg, depth, collect) {
    if (depth > 8) return;
    const off = pageOffset(pg) + (pg === 1 ? 100 : 0);
    const type = buf[off];
    const nCells = buf.readUInt16BE(off + 3);
    if (!nCells) return;
    for (let i = 0; i < nCells; i++) {
      const cellOff = pageOffset(pg) + buf.readUInt16BE(off + 8 + i * 2);
      if (type === 5) { // interior table -> child page
        walk(buf.readUInt32BE(cellOff), depth + 1, collect);
      } else if (type === 13) { // leaf table
        const payloadLen = readVarint(buf, cellOff);
        const rowidLen = readVarint(buf, cellOff + payloadLen.length);
        const hdrStart = cellOff + payloadLen.length + rowidLen.length;
        const hdrLen = readVarint(buf, hdrStart).value;
        // serial types
        const serials = [];
        let p = hdrStart + readVarint(buf, hdrStart).length;
        const hdrEnd = hdrStart + hdrLen;
        while (p < hdrEnd) {
          const s = readVarint(buf, p);
          serials.push(s.value);
          p += s.length;
        }
        // values
        const values = [];
        let dp = hdrEnd;
        for (const st of serials) {
          if (st === 0) values.push(null);
          else if (st === 1) { values.push(buf.readInt8(dp)); dp += 1; }
          else if (st === 2) { values.push(buf.readInt16BE(dp)); dp += 2; }
          else if (st === 3) { values.push(buf.readInt32BE(dp)); dp += 4; }
          else if (st === 4) { values.push(buf.readInt32BE(dp)); dp += 8; }
          else if (st === 5) { values.push(Number(buf.readBigInt64BE(dp))); dp += 8; }
          else if (st >= 13 && st % 2 === 1) { const len = (st - 13) / 2; values.push(buf.toString('utf8', dp, dp + len)); dp += len; }
          else if (st >= 12 && st % 2 === 0) { const len = (st - 12) / 2; values.push(Buffer.from(buf.slice(dp, dp + len))); dp += len; }
          else dp += 1; // skip (0,6,7,8 handled above; others fallback)
        }
        collect(values);
      } else if (type === 10 || type === 2) {
        // leaf/interior index — not needed
      }
    }
  }

  // Find root page of the target table via sqlite_master (page 1)
  let rootPage = null;
  walk(1, 0, (vals) => {
    // sqlite_master row: type,name,tbl_name,rootpage,sql
    if (vals && vals[1] === tableName) rootPage = Number(vals[3]);
  });
  if (rootPage == null) return null;

  walk(rootPage, 0, (vals) => rows.push(vals));
  return rows;
}

// ---------- DPAPI decrypt (Windows) ----------
function decryptWithDPAPI(buf) {
  try {
    const { execSync } = require('child_process');
    const b64 = buf.toString('base64');
    const ps = [
      "Add-Type -AssemblyName System.Security",
      `$bytes = [System.Convert]::FromBase64String('${b64}')`,
      "$r = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser')",
      "[System.Convert]::ToBase64String($r)",
    ].join('; ');
    const out = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8', timeout: 15000 }).trim();
    return Buffer.from(out, 'base64');
  } catch (_) { return null; }
}

// Read SESSION from Chrome/Edge (encrypted Cookies DB)
function readChromeCookie(dbFile, localStateFile) {
  try {
    const state = JSON.parse(fs.readFileSync(localStateFile, 'utf8'));
    const encKey = state.os_crypt?.encrypted_key;
    if (!encKey) return null;
    const key = decryptWithDPAPI(Buffer.from(encKey, 'base64').slice(5)); // strip 'DPAPI'
    if (!key) return null;

    const rows = readSqliteRows(dbFile, 'cookies');
    if (!rows) return null;
    const crypto = require('crypto');
    for (const row of rows) {
      // cookies: id, host_key, name, value, path, expires_utc, is_secure, is_httponly,
      // last_access_utc, has_expires, is_persistent, priority, encrypted_value, ...
      const name = String(row[2] || '');
      const host = String(row[1] || '');
      if (name !== 'SESSION') continue;
      let value = String(row[3] || '');
      if (!value && row.length > 12) {
        const enc = row[12];
        if (Buffer.isBuffer(enc) && enc.length > 20) {
          try {
            const nonce = enc.slice(3, 15);
            const tag = enc.slice(enc.length - 16);
            const ct = enc.slice(15, enc.length - 16);
            const dec = crypto.createDecipheriv('aes-256-gcm', key, nonce);
            dec.setAuthTag(tag);
            value = dec.update(ct, null, 'utf8') + dec.final('utf8');
          } catch (_) {}
        }
      }
      if (value && /(192\.168\.\d+\.\d+|localhost)/.test(host)) {
        return { session: value, host, from: dbFile };
      }
    }
  } catch (_) {}
  return null;
}

// Read the SESSION cookie for any ZKBio host (192.168.x.x or localhost)
function findZkBsessionCookie() {
  // 1) Firefox (normal + Developer Edition share the Profiles root)
  const profilesRoot = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Mozilla', 'Firefox', 'Profiles'
  );
  if (fs.existsSync(profilesRoot)) {
    for (const dir of fs.readdirSync(profilesRoot)) {
      const db = path.join(profilesRoot, dir, 'cookies.sqlite');
      if (!fs.existsSync(db)) continue;
      try {
        const rows = readSqliteRows(db, 'moz_cookies');
        if (!rows) continue;
        for (const row of rows) {
          // moz_cookies columns: id, originAttributes, name, value, host, path, ...
          const name = String(row[2] || '');
          const value = String(row[3] || '');
          const host = String(row[4] || '');
          if (name === 'SESSION' && value && /(192\.168\.\d+\.\d+|localhost)/.test(host)) {
            return { session: value, host, from: db };
          }
        }
      } catch (_) {}
    }
  }

  // 2) Chrome / Edge (encrypted cookies)
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = [
    { db: ['Google', 'Chrome', 'User Data', 'Default', 'Cookies'], local: ['Google', 'Chrome', 'User Data', 'Local State'] },
    { db: ['Microsoft', 'Edge', 'User Data', 'Default', 'Cookies'], local: ['Microsoft', 'Edge', 'User Data', 'Local State'] },
  ];
  for (const c of candidates) {
    try {
      const db = path.join(local, ...c.db);
      const lf = path.join(local, ...c.local);
      if (!fs.existsSync(db) || !fs.existsSync(lf)) continue;
      const found = readChromeCookie(db, lf);
      if (found) return found;
    } catch (_) {}
  }

  return null;
}

// Also fallback: read from a Netscape-format cookie file (zkcookie.txt)
function readCookieFile(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length >= 7 && parts[5] === 'SESSION') {
        return { session: parts[6], host: parts[0], from: file };
      }
    }
  } catch (_) {}
  return null;
}

module.exports = { findZkBsessionCookie, readCookieFile, readSqliteRows };