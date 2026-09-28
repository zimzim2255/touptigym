/* ============================================================
   access_sync.js  —  enforcement writer (Casa / toptigym-v2)
   ------------------------------------------------------------
   What the other project does (gym-project connector) but for
   this relay + time-window rule.

   The terminal fires the relay on a LOCAL biometric match. So a
   post-scan DENIED is always too late to stop the door. Instead we
   keep acc_person.disabled in the LOCAL ZKBio PostgreSQL in sync
   with the Supabase decision, so the terminal refuses members
   locally (block before/after their scheduled exercise window).

   Reads:  GET {CASA_PROJECT}/functions/v1/zkteco/access-state
           -> { children: [ { pin, allowed_now, window } ] }
   Writes: UPDATE public.acc_person SET disabled = $1
           WHERE pers_person_id = (SELECT id FROM pers_person WHERE pin = $2)

   USAGE:
     node access_sync.js --dry-run          # show diff, write nothing
     node access_sync.js                    # apply now
     node access_sync.js --interval 30000   # run every 30s (like a service)

   Config via .env (loaded below) or hard defaults for Casa:
     ZKBIO_PG_HOST/PORT/DB/USER/PASS
     CLV_SUPABASE_URL     (e.g. https://lpjdpcguplkpdfgxomps.supabase.co)
     CLV_SUPABASE_ANON
     CLV_DEVICE_TOKEN     (must match server's device token for access-state)
   ============================================================ */

const { Client } = require('pg')
const https = require('https')
const fs = require('fs')
const path = require('path')

// ── minimal .env loader ───────────────────────────────────────────
function loadEnvFile(file) {
  try {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const m = t.match(/^([\w.-]+)\s*=\s*(.*)$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch (_) {}
}
loadEnvFile(path.join(__dirname, '.env'))

const PG = {
  host: process.env.ZKBIO_PG_HOST || '127.0.0.1',
  port: Number(process.env.ZKBIO_PG_PORT || 5442),
  database: process.env.ZKBIO_PG_DB || 'biosecurity-boot',
  user: process.env.ZKBIO_PG_USER || 'root',
  password: process.env.ZKBIO_PG_PASS || '',
}

// Casa Supabase project + device token (from .env-casa/.env)
const SUPABASE_HOST = (process.env.CLV_SUPABASE_URL || 'https://lpjdpcguplkpdfgxomps.supabase.co')
  .replace(/^https?:\/\//, '')
const SUPABASE_ANON = process.env.CLV_SUPABASE_ANON || 'sb_publishable_51kPQ-pyABP2B8gK4aAkrQ_p3BPRnxJ'
const DEVICE_TOKEN = process.env.CLV_DEVICE_TOKEN || 'zk_relay_2026_9X4K_secret'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const intervalArg = args[args.indexOf('--interval') + 1]
const INTERVAL_MS = intervalArg ? Math.max(5000, Number(intervalArg)) : 0

function log(m) { console.log(`[${new Date().toISOString()}] ${m}`) }

// ── HTTPS GET to the edge function ────────────────────────────────
function getAccessState() {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: SUPABASE_HOST,
        port: 443,
        path: '/functions/v1/zkteco/access-state',
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          'x-device-token': DEVICE_TOKEN,
          'Content-Type': 'application/json',
        },
      },
      (resp) => {
        let d = ''
        resp.on('data', (c) => (d += c))
        resp.on('end', () => resolve({ status: resp.statusCode, body: d }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

// Current acc_person → { pin, disabled } (same shape as the other project)
async function listLocalUsers(client) {
  const q = await client.query(
    `SELECT pp.pin AS pin, ap.disabled AS disabled
     FROM public.acc_person ap
     JOIN public.pers_person pp ON pp.id = ap.pers_person_id
     WHERE pp.pin IS NOT NULL`
  )
  return q.rows || []
}

// Build the target map: pin -> shouldBeDisabled
function buildTarget(state) {
  const target = new Map() // pin -> boolean (true = disabled / block)
  for (const c of state.children || []) {
    const pin = String(c.pin || '').trim()
    if (!pin) continue
    // allowed_now TRUE → enable (disabled=false); otherwise block (disabled=true)
    target.set(pin, !c.allowed_now)
  }
  return target
}
async function runOnce(client) {
  // 1) ask Supabase who may enter right now
  const res = await getAccessState()
  if (res.status !== 200) {
    throw new Error(`access-state HTTP ${res.status}: ${res.body.slice(0, 200)}`)
  }
  let state = {}
  try { state = JSON.parse(res.body) } catch (_) { throw new Error('invalid JSON from access-state') }

  const target = buildTarget(state)
  const local = await listLocalUsers(client)

  // 2) diff
  const toEnable = []
  const toDisable = []
  for (const u of local) {
    const pin = String(u.pin || '').trim()
    if (!pin) continue
    const shouldDisable = target.has(pin) ? target.get(pin) : true // unknown pin -> block
    const isDisabled = !!u.disabled
    if (shouldDisable !== isDisabled) {
      if (shouldDisable) toDisable.push(pin)
      else toEnable.push(pin)
    }
  }

  log(`access-state allowed=${[...target].filter(([, v]) => !v).length} blocked=${[...target].filter(([, v]) => v).length} local=${local.length}`)
  log(`toDisable=${toDisable.length} toEnable=${toEnable.length}`)

  if (!dryRun) {
    const SQL = 'UPDATE public.acc_person SET disabled=$1 WHERE pers_person_id = (SELECT id FROM public.pers_person WHERE pin=$2)'
    for (const pin of toDisable) {
      try { await client.query(SQL, [true, pin]); log(`  block ${pin}`) } catch (e) { log(`  ERR block ${pin}: ${e.message}`) }
    }
    for (const pin of toEnable) {
      try { await client.query(SQL, [false, pin]); log(`  free  ${pin}`) } catch (e) { log(`  ERR free  ${pin}: ${e.message}`) }
    }
    log(`APPLIED: blocked=${toDisable.length} released=${toEnable.length}`)
    return { toDisable, toEnable }
  }
  log('DRY-RUN — nothing written.')
  return { toDisable, toEnable, dryRun }
}

(async () => {
  const client = new Client(PG)
  await client.connect()
  log('✅ Connected to PostgreSQL')

  log(`access-state source: https://${SUPABASE_HOST}/functions/v1/zkteco/access-state`)

  await runOnce(client)
  if (INTERVAL_MS > 0) {
    log(`Polling every ${INTERVAL_MS}ms...`)
    setInterval(() => { try { runOnce(client) } catch (e) { log(`sync error: ${e.message}`) } }, INTERVAL_MS)
  } else {
    await client.end()
    process.exit(0)
  }
})().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})