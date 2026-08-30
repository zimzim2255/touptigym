// cleanup_photo.js — one-off: remove the photo-upload subsystem from relay.js
const fs = require('fs');
const f = 'relay.js';
let src = fs.readFileSync(f, 'utf8');
const lines = src.split(/\r?\n/);

// Remove from the "── Photo import from device face capture" marker through
// the closing of syncPhotosToHold (the line before "async function start")
let startIdx = lines.findIndex(l => l.includes('Photo import from device face capture'));
let endIdx = lines.findIndex(l => l.trim().startsWith('async function start()'));
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error('markers not found', startIdx, endIdx);
  process.exit(1);
}
// Remove photo block lines [startIdx-1 .. endIdx-1]
const removed = lines.splice(startIdx - 1, endIdx - (startIdx - 1));
console.log('removed', removed.length, 'lines: start', lines[Math.max(0,startIdx-2)], '-> end', lines[endIdx-1]);

// Remove photo sync calls in start() (photo-to-hold every 60s)
src = lines.join('\n');
src = src.replace(/^\s*\/\/ Periodic photo import from ZKBio persons into the holding table \(every 60s\)\r?\n\s*const PHOTO_SYNC_MS = 60 \* 1000;\r?\n\s*log\('Photo-to-hold sync every 60s\.\.\.'\);\r?\n\s*setInterval\(syncPhotosToHold, PHOTO_SYNC_MS\);\r?\n\s*syncPhotosToHold\(\);\r?\n/gm, '');

// Remove photo-import config block at top (Supabase REST + Cloudinary constants)
src = src.replace(/\/\/ --- Photo-import config[.\s\S]*?const CLOUDINARY_UPLOAD_PRESET = 'ml_default';\r?\n/gm, '');

// Update the zkCookie comment (no longer "captures from browser")
src = src.replace(/\/\/ ZKBio session cookie \(SESSION=\.\.\.\)\r?\n\/\/ Starts EMPTY[^\r\n]*.*?No hardcoding needed\.\r?\n/gm, '// ZKBio session cookie (SESSION=...) — acquired via direct login.\n');

fs.writeFileSync(f, src);
console.log('done. new line count:', src.split('\n').length);