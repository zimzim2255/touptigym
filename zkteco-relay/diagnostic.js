// diagnostic.js
const https = require('https');
const fs = require('fs');

const SUPABASE_HOST = 'atvdorphwnpzhobvfmtz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_A6MqQPu7dnrtr04JFtHGBg_rRw8e_Nb';

async function downloadAndCheck() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'GET',
      hostname: SUPABASE_HOST,
      path: '/storage/v1/object/public/profiles/10.jpg',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON}`
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log('Status:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);
        console.log('Size:', data.length, 'bytes');
        console.log('First 200 chars:', data.toString('utf8', 0, 200));
        
        // Save to check locally
        fs.writeFileSync('downloaded_10.jpg', data);
        console.log('\n✅ Saved to downloaded_10.jpg - open it to see what it contains');
        resolve();
      });
    });
    req.on('error', reject);
    req.end();
  });
}

downloadAndCheck().catch(console.error);