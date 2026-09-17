/* ============================================================
   fetch_zkbio_photo.js — Extract Valid Photo from ZKBio API
   ------------------------------------------------------------
   Connects to your ZKBio CVAccess web interface, requests the 
   original photo for a specific Person ID, decodes the Base64 
   response, and saves it as a valid .jpg file locally.
   
   USAGE:
     node fetch_zkbio_photo.js --id 10 --photo "C:\Program Files\ZKBio CVAccess\service\zkbiosecurity\BioSecurityFile\upload\pers\user\cropface\10\10.jpg"
   ============================================================ */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------- CONFIG (Pre-filled from your HAR file) ----------
const ZKBIO_HOST = '192.168.1.202';
const ZKBIO_PORT = 8098;
// This is the exact session cookie captured from your browser request
const ZKBIO_SESSION = 'org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en-US; SESSION=ZDIwMDRjMzEtNTQ5MC00ZDBhLTlmYTItMWQ5M2QyZTNlYWEw';
const OUTPUT_DIR = './extracted_photos';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

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
        help: args.includes('--help') || args.includes('-h'),
    };
}

function l(s) { console.log(`[${new Date().toISOString()}] ${s}`); }

// ---------- minimal HTTPS helper ----------
function req({ method, hostname, port = 443, path, headers = {}, body }) {
    return new Promise((resolve, reject) => {
        const r = https.request({ 
            method, 
            hostname, 
            port, 
            path, 
            headers,
            rejectUnauthorized: false // Ignore self-signed cert warnings
        }, (res) => {
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

/* ---------- Main Logic ---------- */
(async () => {
    const A = parseArgs();
    
    if (A.help || !A.id || !A.photo) {
        console.log(`
USAGE:
  node fetch_zkbio_photo.js --id <PERSON_ID> --photo <path_to_corrupted_jpg>

EXAMPLE:
  node fetch_zkbio_photo.js --id 10 --photo "C:\\Program Files\\ZKBio CVAccess\\service\\zkbiosecurity\\BioSecurityFile\\upload\\pers\\user\\cropface\\10\\10.jpg"
`);
        process.exit(A.help ? 0 : 1);
    }

    if (!fs.existsSync(A.photo)) {
        l(`❌ Local source photo not found at: ${A.photo}`);
        l(`ℹ️  Please ensure the person has been registered locally first.`);
        process.exit(1);
    }

    const fileBuf = fs.readFileSync(A.photo);
    const filename = path.basename(A.photo);
    const boundary = '----NodeJSFormBoundary' + Date.now().toString(16);
    
    // Construct multipart/form-data body matching the browser's request
    const parts = [];
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="personPhoto"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`));
    parts.push(fileBuf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const requestBody = Buffer.concat(parts);

    l(`📤 Requesting valid photo for Person ID: ${A.id}...`);

    const res = await req({
        method: 'POST',
        hostname: ZKBIO_HOST,
        port: ZKBIO_PORT,
        path: `/persPerson.do?validPersonPhoto`,
        headers: {
            'Cookie': ZKBIO_SESSION,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': requestBody.length,
        },
        body: requestBody,
    });

    if (res.status !== 200) {
        l(`❌ ZKBio API Error: Status ${res.status}`);
        l(`Response: ${res.body.toString().slice(0, 300)}`);
        process.exit(1);
    }

    let responseData;
    try {
        responseData = JSON.parse(res.body.toString());
    } catch (e) {
        l(`❌ Failed to parse ZKBio JSON response.`);
        l(`Raw response: ${res.body.toString().slice(0, 300)}`);
        process.exit(1);
    }

    if (responseData.ret !== 'ok' || !responseData.data) {
        l(`❌ ZKBio returned an error or no photo data: ${JSON.stringify(responseData).substring(0, 200)}...`);
        process.exit(1);
    }

    // Decode Base64 to Binary Buffer
    const photoBuffer = Buffer.from(responseData.data, 'base64');
    const outputPath = path.join(OUTPUT_DIR, `${A.id}_valid.jpg`);

    // Save the valid photo
    fs.writeFileSync(outputPath, photoBuffer);

    l(`✅ Successfully extracted valid photo!`);
    l(`💾 Saved to: ${outputPath}`);
    l(`📏 Size: ${photoBuffer.length} bytes`);
    l(`🚀 You can now use this file with your register_person.js script!`);

})().catch((e) => { 
    console.error('FATAL:', e.message); 
    process.exit(1); 
});