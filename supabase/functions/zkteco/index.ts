import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    // Robust path parsing: find "zkteco" anywhere in the path and take
    // everything after it. Handles any prefix the gateway may use.
    const allSegments = url.pathname.split('/').filter(Boolean)
    const zktecoIdx = allSegments.findIndex(s => s === 'zkteco')
    const segments = zktecoIdx >= 0 ? allSegments.slice(zktecoIdx + 1) : allSegments
    const route = segments.join('/')
    // For device endpoints: /iclock/xxx → extract the part after "iclock"
    const iclockIdx = segments.findIndex(s => s === 'iclock')
    const iclockRoute = iclockIdx >= 0 ? segments.slice(iclockIdx + 1).join('/') : ''
    const method = req.method

    // ── Debug helper: call with ?debug=1 to see how the path is parsed ──
    if (url.searchParams.get('debug')) {
      return jsonResponse({ pathname: url.pathname, allSegments, segments, route, iclockRoute })
    }

    // ─── Logs & Access Control API ─────────────────

    // GET /zkteco/latest — enrich the latest scan with child + parents + subscription
    if (method === 'GET' && route === 'latest') {
      const { data, error } = await supabase
        .from('zkteco_logs')
        .select('*, children:child_id(id, name, gender, birth_date, age, zkteco_id, photo, client_type)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return errorResponse(error.message, 500)
      if (!data) return jsonResponse(null)

      // Enrich: parents + active subscription + today's exercises for this child
      let parents: any[] = []
      let subscription: any = null
      let todayExercises: any[] = []
      const childId = data.child_id
      if (childId) {
        const nowDate = new Date()
        const dayName = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][nowDate.getDay()]
        const [pRes, sRes] = await Promise.all([
          supabase.from('parent_children')
            .select('parents!parent_id(id, name, phone, email, gender)')
            .eq('child_id', childId),
          supabase.from('subscriptions')
            .select('id, type, sub_type, status, start_date, end_date, amount, discount, insurance, entry_fee')
            .eq('child_id', childId)
            .order('end_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        parents = (pRes.data || []).map((r: any) => r.parents).filter(Boolean)
        subscription = sRes.data || null

        // Today's subscribed exercises (through subscription_courses)
        if (subscription) {
          const { data: courseRows } = await supabase
            .from('subscription_courses')
            .select('exercises!exercise_id(id, name, day, start_time, end_time, type)')
            .eq('subscription_id', subscription.id)
            .eq('exercises.day', dayName)
          todayExercises = (courseRows || []).map((r: any) => r.exercises).filter(Boolean).slice(0, 6)
        }
      }

      return jsonResponse({ log: data, parents, subscription, todayExercises })
    }

    // GET /zkteco/logs — list all access logs (Contrôle d'Accès)
    if (method === 'GET' && route === 'logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const childId = url.searchParams.get('child_id') || ''
      const status = url.searchParams.get('status') || ''
      const fromDate = url.searchParams.get('from') || ''
      const toDate = url.searchParams.get('to') || ''

      let query = supabase
        .from('zkteco_logs')
        .select('*, children:child_id(name, zkteco_id)', { count: 'exact' })
        .order('event_time', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)

      if (childId) query = query.eq('child_id', childId)
      if (status) query = query.eq('status', status)
      if (fromDate) query = query.gte('event_time', fromDate)
      if (toDate) query = query.lte('event_time', toDate)

      const { data, error, count } = await query
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ data, total: count, limit, offset })
    }

    // GET /zkteco/access-logs — ERP attendance logs (entry/exit)
    if (method === 'GET' && route === 'access-logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const childId = url.searchParams.get('child_id') || ''

      let query = supabase
        .from('access_logs')
        .select('*, children:child_id(name)', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)

      if (childId) query = query.eq('child_id', childId)

      const { data, error, count } = await query
      if (error) return errorResponse(error.message, 500)
      return jsonResponse({ data, total: count, limit, offset })
    }

    // GET /zkteco/logs/stats — summary statistics
    if (method === 'GET' && route === 'logs/stats') {
      const today = new Date().toISOString().split('T')[0]

      const [todayLogs, totalDevices, unknownPins] = await Promise.all([
        supabase.from('zkteco_logs').select('id', { count: 'exact' }).gte('event_time', today),
        supabase.from('zkteco_devices').select('id', { count: 'exact' }),
        supabase.from('zkteco_logs').select('id', { count: 'exact' }).eq('status', 'denied_unknown_user').gte('event_time', today),
      ])

      const { data: recentLogs } = await supabase
        .from('zkteco_logs')
        .select('*, children:child_id(name)')
        .order('event_time', { ascending: false })
        .limit(10)

      return jsonResponse({
        today_total: todayLogs.count || 0,
        total_devices: totalDevices.count || 0,
        today_unknown: unknownPins.count || 0,
        recent: recentLogs || []
      })
    }

    // ─── Relay Events ─────────────────────────────
    // relay.js (local gym-PC ZKBio relay) posts every new ZKBio transaction
    // to {project}/functions/v1/zkteco/events with header x-device-token.
    // We map the PIN → child, enforce subscription + schedule, log the event,
    // and reply {"app_result":"allowed"|"denied"} so the relay opens the door.
    if (method === 'POST' && route === 'events') {
      const DEVICE_TOKEN = 'zk_relay_2026_9X4K_secret'
      const token = req.headers.get('x-device-token') || ''
      if (token !== DEVICE_TOKEN) {
        return jsonResponse({ app_result: 'denied', reason: 'bad_token' }, 401)
      }

      let body: any = {}
      try { body = await req.json() } catch { /* ignore malformed JSON */ }

      const personnelId = String(body.personnelId ?? '').trim()
      const capturedAt = body.captured_at || new Date().toISOString()
      const device = body.device || ''
      const raw = body.raw || {}

      // ── Device heartbeat from the relay ──────────────────────────
      // Each scan that the relay forwards refreshes this device's
      // last_seen/status so the app can show "En ligne / Hors ligne".
      const devSn = String(raw.dev_sn || raw.serial_number || '').trim()
      const devAlias = String(device || raw.dev_alias || '').trim()
      if (devSn) {
        const { data: dev } = await supabase
          .from('zkteco_devices')
          .select('id')
          .eq('serial_number', devSn)
          .maybeSingle()
        if (dev) {
          await supabase
            .from('zkteco_devices')
            .update({ status: 'online', last_seen: new Date().toISOString() })
            .eq('id', dev.id)
            .then(() => {}).catch(() => {})
        } else {
          await supabase
            .from('zkteco_devices')
            .insert([{
              name: devAlias || `ZKTeco (${devSn.substring(0, 8)}...)`,
              serial_number: devSn,
              ip_address: String(raw.dev_ip || ''),
              location: 'Auto-registered (relay)',
              status: 'online',
              last_seen: new Date().toISOString(),
            }])
            .then(() => {}).catch(() => {})
        }
      }

      if (!personnelId) {
        return jsonResponse({ app_result: 'denied', reason: 'missing_personnelId' })
      }

      // Map device PIN → child via children.zkteco_id
      const { data: child } = await supabase
        .from('children')
        .select('id')
        .eq('zkteco_id', personnelId)
        .maybeSingle()

      if (!child) {
        await supabase.from('zkteco_logs').insert([{
          child_id: null,
          device_id: device || null,
          event_type: 'access',
          event_time: capturedAt,
          status: 'denied_unknown_user',
          raw_data: { ...raw, personnelId },
        }]).then(() => {}).catch(() => {})
        return jsonResponse({ app_result: 'denied', reason: 'unknown_user' })
      }

      // Active subscription check (must be 'actif' AND not expired).
      // A child may hold several actif rows; pick the one with the latest
      // end_date (limit 1 = deterministic). maybeSingle() would ERROR on >1.
      const today = localDateStr(capturedAt)
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select('id, start_date, end_date, exercises, status')
        .eq('child_id', child.id)
        .eq('status', 'actif')
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      let accessStatus = 'denied_no_sub'
      if (sub) {
        const subEnd = sub.end_date ? String(sub.end_date).slice(0, 10) : ''
        if (subEnd && today > subEnd) {
          // Subscription has already expired (end_date passed)
          accessStatus = 'denied_expired'
        } else {
          // Check the child's subscribed exercises for the scan's day + window
          // (queried through the subscription_courses join inside exerciseGrantFor).
          const grant = await exerciseGrantFor(sub.id, child.id, capturedAt)
          if (grant === 'none') {
            // Child has an active subscription but no exercise scheduled today
            accessStatus = 'denied_no_exercise'
          } else if (grant === true) {
            accessStatus = 'granted'
          } else {
            // Has an exercise today but the scan is outside [start-10min, start+15min]
            accessStatus = 'denied_window'
          }
        }
      }

      await supabase.from('zkteco_logs').insert([{
        child_id: child.id,
        device_id: device || null,
        event_type: 'access',
        event_time: capturedAt,
        status: accessStatus,
        raw_data: { ...raw, personnelId },
      }]).then(() => {}).catch(err => console.error('[ZKTeco] relay log insert error:', err))

      if (accessStatus === 'granted') {
        await supabase.from('access_logs').insert([{
          child_id: child.id,
          timestamp: capturedAt,
          type: 'entry',
          status: 'granted',
          mode: 'online',
        }]).then(() => {}).catch(err => console.error('[ZKTeco] relay access_log error:', err))

        console.log(`[ZKTeco] relay GRANTED pin=${personnelId} -> open ZKBio door`)
        return jsonResponse({ app_result: 'allowed' })
      }

      console.log(`[ZKTeco] relay DENIED pin=${personnelId} reason=${accessStatus}`)
      return jsonResponse({ app_result: 'denied', reason: accessStatus })
    }

    // ─── Device Management API ─────────────────────

    // GET /zkteco/devices — list all devices
    if (method === 'GET' && route === 'devices') {
      const { data, error } = await supabase.from('zkteco_devices').select('*').order('name')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    // PUT /zkteco/devices/:id/status — update device status
    if (method === 'PUT' && segments[0] === 'devices' && segments[2] === 'status') {
      const body = await req.json()
      const { data, error } = await supabase
        .from('zkteco_devices')
        .update({ status: body.status, last_seen: new Date().toISOString() })
        .eq('id', segments[1])
        .select()
        .single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // GET /zkteco/devices/:id/commands — list pending commands for a device
    if (method === 'GET' && segments[0] === 'devices' && segments[2] === 'commands') {
      const { data, error } = await supabase
        .from('zkteco_commands')
        .select('*')
        .eq('device_id', segments[1])
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    // POST /zkteco/devices/:id/commands — queue a command for a device
    if (method === 'POST' && segments[0] === 'devices' && segments[2] === 'commands') {
      const body = await req.json()
      const { data, error } = await supabase
        .from('zkteco_commands')
        .insert([{
          device_id: segments[1],
          command: body.command,
          params: body.params || {},
          status: 'pending'
        }])
        .select()
        .single()
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data, 201)
    }

    // ─── ZKTeco PUSH SDK Protocol Endpoints ────────
    //
    // These must match exactly what the device expects:
    //   /iclock/cdata       → POST — receive attendance logs
    //   /iclock/getrequest  → GET  — device polls for commands
    //   /iclock/devicecmd   → GET  — server responds with command
    //   /iclock/registry    → GET  — device registration
    //
    // The device sends requests to:
    //   http://<BACKEND_IP>/iclock/<endpoint>
    //

    // ── POST /iclock/cdata ─────────────────────────
    // Receives attendance logs pushed by the device.
    // Format: tab-separated lines: PIN  \t  YYYY-MM-DD HH:MM:SS  \t  Status  \t  VerifyMode
    if (method === 'POST' && iclockRoute === 'cdata') {
      const text = await req.text()
      const deviceIp = req.headers.get('x-forwarded-for') || url.hostname || 'unknown'
      const deviceSn = url.searchParams.get('SN') || ''
      const lines = text.split('\n').filter(l => l.trim())

      // Resolve device by serial number so we can queue AC_UNLOCK to the right device
      let deviceRowId: string | null = null
      if (deviceSn) {
        const { data: dev } = await supabase
          .from('zkteco_devices')
          .select('id')
          .eq('serial_number', deviceSn)
          .maybeSingle()
        if (dev) deviceRowId = dev.id
      }

      console.log(`[ZKTeco] Received cdata from ${deviceIp} (SN=${deviceSn}): ${lines.length} records`)

      let processed = 0
      let denied = 0

      for (const line of lines) {
        const parts = line.split('\t')
        if (parts.length >= 4) {
          const pin = parts[0].trim()
          const eventTime = parts[1].trim()
          const statusCode = parseInt(parts[2])
          const verifyMode = parseInt(parts[3])

          // Map ZKTeco status to event type
          // 0 = entry/in, 1 = exit/out, other = unknown
          const eventType = statusCode === 0 ? 'entry' : 'exit'

          // Find child by zkteco_id
          const { data: child } = await supabase
            .from('children')
            .select('id, name')
            .eq('zkteco_id', pin)
            .maybeSingle()

          if (child) {
            // Check active subscription
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('id')
              .eq('child_id', child.id)
              .eq('status', 'actif')
              .maybeSingle()

            const accessStatus = sub ? 'granted' : 'denied_no_subscription'

            // Log to zkteco_logs (raw logging)
            await supabase.from('zkteco_logs').insert([{
              child_id: child.id,
              device_id: deviceIp,
              event_type: eventType,
              event_time: eventTime,
              status: accessStatus,
              raw_data: { line, pin, statusCode, verifyMode }
            }]).then(() => {}).catch(err => console.error('[ZKTeco] log insert error:', err))

            if (sub) {
              // Also insert into access_logs for the ERP
              await supabase.from('access_logs').insert([{
                child_id: child.id,
                timestamp: eventTime,
                type: eventType,
                status: 'granted',
                mode: 'online'
              }]).then(() => {}).catch(err => console.error('[ZKTeco] access_log insert error:', err))

              // 🔓 Queue AC_UNLOCK so the device opens the door on next poll
              if (deviceRowId) {
                await supabase.from('zkteco_commands').insert([{
                  device_id: deviceRowId,
                  command: 'AC_UNLOCK',
                  params: {},
                  status: 'pending'
                }]).then(() => {}).catch(err => console.error('[ZKTeco] AC_UNLOCK queue error:', err))
                console.log(`[ZKTeco] Queued AC_UNLOCK for device ${deviceSn} (child ${child.id})`)
              }
              processed++
            } else {
              denied++
            }
          } else {
            // Unknown PIN — log orphan record
            await supabase.from('zkteco_logs').insert([{
              child_id: null,
              device_id: deviceIp,
              event_type: 'unknown_pin',
              event_time: eventTime,
              status: 'denied_unknown_user',
              raw_data: { line, pin, statusCode, verifyMode }
            }]).then(() => {}).catch(err => console.error('[ZKTeco] orphan log error:', err))
            denied++
          }
        }
      }

      console.log(`[ZKTeco] Processed: ${processed} granted, ${denied} denied`)

      // Update device heartbeat
      await supabase
        .from('zkteco_devices')
        .update({ last_seen: new Date().toISOString(), status: 'online' })
        .eq('ip_address', deviceIp)
        .then(() => {}).catch(() => {})

      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    // ── GET /iclock/getrequest ─────────────────────
    // Called by the device to check for pending commands.
    // Returns a command line or empty body.
    if (method === 'GET' && iclockRoute === 'getrequest') {
      const deviceSn = url.searchParams.get('SN') || ''

      // Find device by serial number
      const { data: device } = await supabase
        .from('zkteco_devices')
        .select('id')
        .eq('serial_number', deviceSn)
        .maybeSingle()

      if (device) {
        // Update heartbeat
        await supabase
          .from('zkteco_devices')
          .update({ last_seen: new Date().toISOString(), status: 'online' })
          .eq('id', device.id)
          .then(() => {}).catch(() => {})

        // Check for pending commands
        const { data: pendingCommands } = await supabase
          .from('zkteco_commands')
          .select('id, command, params')
          .eq('device_id', device.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)

        if (pendingCommands && pendingCommands.length > 0) {
          const cmd = pendingCommands[0]

          // Mark command as sent
          await supabase
            .from('zkteco_commands')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', cmd.id)
            .then(() => {}).catch(() => {})

          const cmdText = `${cmd.command}${cmd.params ? '	' + JSON.stringify(cmd.params) : ''}`
          console.log(`[ZKTeco] Sending command to device ${deviceSn}: ${cmdText}`)

          return new Response(cmdText, {
            status: 200,
            headers: { 'Content-Type': 'text/plain', ...corsHeaders }
          })
        }
      }

      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    // ── GET /iclock/devicecmd ──────────────────────
    // Server sends a direct command to the device.
    // This endpoint is called by our ERP, not by the device.
    // The command is queued, then delivered when the device polls /iclock/getrequest.
    // Direct command format: CMD<tab>PARAMS
    if (method === 'GET' && iclockRoute === 'devicecmd') {
      const deviceSn = url.searchParams.get('SN') || ''
      const cmd = url.searchParams.get('cmd') || ''

      if (!deviceSn || !cmd) {
        return new Response('ERROR: Missing SN or cmd parameter', {
          status: 400,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        })
      }

      // Find device
      const { data: device } = await supabase
        .from('zkteco_devices')
        .select('id')
        .eq('serial_number', deviceSn)
        .maybeSingle()

      if (device) {
        // Queue the command
        await supabase.from('zkteco_commands').insert([{
          device_id: device.id,
          command: cmd,
          params: {},
          status: 'pending'
        }]).then(() => {}).catch(err => console.error('[ZKTeco] devicecmd queue error:', err))

        console.log(`[ZKTeco] Queued command for ${deviceSn}: ${cmd}`)
      }

      // Return OK — device will pick up the command on next poll
      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    // ── GET /iclock/registry ───────────────────────
    // Device registers itself on first connection.
    // Query params: SN=<serial>&model=<model>&FWVersion=<version>
    if (method === 'GET' && iclockRoute === 'registry') {
      const serial = url.searchParams.get('SN') || ''
      const model = url.searchParams.get('model') || ''
      const fwVersion = url.searchParams.get('FWVersion') || ''
      const deviceIp = req.headers.get('x-forwarded-for') || url.hostname || ''

      console.log(`[ZKTeco] Device registration request: SN=${serial} Model=${model} FW=${fwVersion} IP=${deviceIp}`)

      if (serial) {
        // Check if device already registered
        const { data: existingDevice } = await supabase
          .from('zkteco_devices')
          .select('id')
          .eq('serial_number', serial)
          .maybeSingle()

        if (existingDevice) {
          // Update existing device info
          await supabase
            .from('zkteco_devices')
            .update({
              ip_address: deviceIp,
              status: 'online',
              last_seen: new Date().toISOString()
            })
            .eq('id', existingDevice.id)
            .then(() => {}).catch(() => {})
        } else {
          // Register new device
          await supabase
            .from('zkteco_devices')
            .insert([{
              name: `${model || 'SpeedFace-V5L'} (${serial.substring(0, 8)}...)`,
              ip_address: deviceIp,
              serial_number: serial,
              location: `Auto-registered ${model || 'unknown model'}`,
              status: 'online'
            }])
            .then(() => {}).catch(err => console.error('[ZKTeco] device registration error:', err))
        }
      }

      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    // ── Fallback ───────────────────────────────────
    return errorResponse('Not found', 404)
  } catch (err) {
    console.error('[ZKTeco] Unhandled error:', err)
    return errorResponse(err.message, 500)
  }
})
// ─── Helpers: access enforcement (subscription end-date + day + time window) ──

const ACCESS_DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const ALLOWED_BEFORE_MIN = 10 // entry allowed this many minutes before exercise start
const ALLOWED_AFTER_MIN = 15  // entry allowed this many minutes after exercise start

// From an ISO timestamp, return the local (UTC+1) calendar date "YYYY-MM-DD".
function localDateStr(iso: string): string {
  const d = new Date(String(iso).replace(' ', 'T'))
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  const loc = new Date(d.getTime() + 60 * 60000) // UTC+1
  const y = loc.getUTCFullYear()
  const m = String(loc.getUTCMonth() + 1).padStart(2, '0')
  const day = String(loc.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Return the day name (e.g. "Lundi") for an ISO timestamp, in UTC+1.
function localDayName(iso: string): string {
  const d = new Date(String(iso).replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  const loc = new Date(d.getTime() + 60 * 60000)
  return ACCESS_DAY_NAMES[loc.getUTCDay()] || ''
}

// Convert "HH:MM[:SS]" into minutes from midnight. Returns -1 if unparsable.
function toMinutes(timeStr: any): number | null {
  const s = String(timeStr || '')
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

// True / false / 'none' whether the child is inside the allowed window for one
// of their subscribed exercises scheduled on the scan's day.
// Queries through subscription_courses (join) so we never send thousands of
// exercise IDs in a single .in() (PostgREST URL limits would fail).
async function exerciseGrantFor(
  subId: string,
  childId: string,
  capturedAt: string
): Promise<boolean | 'none'> {
  const dayName = localDayName(capturedAt)
  if (!dayName) return 'none'

  const { data: rows, error } = await supabase
    .from('subscription_courses')
    .select('exercises!exercise_id(id, day, start_time, end_time, start_date, end_date)')
    .eq('subscription_id', subId)
    .eq('exercises.day', dayName)

  if (error || !rows || rows.length === 0) return 'none'

  const exercises = rows.map((r: any) =>
    Array.isArray(r.exercises) ? r.exercises[0] : r.exercises
  ).filter(Boolean)

  if (exercises.length === 0) return 'none'

  const today = localDateStr(capturedAt)
  // keep only exercises that are within their own date range (if set)
  const activeOnDay = exercises.filter(e => {
    if (e.start_date && today < String(e.start_date).slice(0, 10)) return false
    if (e.end_date && today > String(e.end_date).slice(0, 10)) return false
    return true
  })
  if (activeOnDay.length === 0) return 'none'

  const base = new Date(String(capturedAt).replace(' ', 'T'))
  const scanLocal =
    (base.getUTCHours() + 1) * 60 + base.getUTCMinutes() // local UTC+1 minutes

  for (const ex of activeOnDay) {
    const startMin = toMinutes(ex.start_time)
    if (startMin === null) continue
    const lo = (startMin - ALLOWED_BEFORE_MIN + 1440) % 1440
    const hi = (startMin + ALLOWED_AFTER_MIN) % 1440
    // single window within the day
    if (lo <= hi) {
      if (scanLocal >= lo && scanLocal <= hi) return true
    } else {
      // window wrapped past midnight (not expected for gym); allow if either side
      if (scanLocal >= lo || scanLocal <= hi) return true
    }
  }

  return false
}