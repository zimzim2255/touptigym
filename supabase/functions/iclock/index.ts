import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

// ─────────────────────────────────────────────────────────────────
// ZKTeco ADMS / iClock Protocol Handler
//
// This Edge Function handles the ZKTeco ADMS (Attendance Device
// Management Server) protocol used by SpeedFace-V5L devices.
//
// The device sends plain-text or URL-encoded form data, NOT JSON.
// It expects "OK" as a response, NOT JSON.
//
// Endpoints (all under /iclock/):
//   POST /iclock/cdata       — Receive attendance logs
//   GET  /iclock/getrequest  — Device polls for commands
//   GET  /iclock/devicecmd   — Send commands to device
//   GET  /iclock/registry    — Device registration
//   POST /iclock/deviceid    — Device identification
// ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const url = new URL(req.url)
    // Robust path parsing: find "iclock" anywhere in the path and take
    // everything after it. This handles /functions/v1/iclock/iclock/...
    // and any other prefix the gateway may use.
    const allSegments = url.pathname.split('/').filter(Boolean)
    // The gateway passes the function name as the first segment
    // (e.g. /iclock/iclock/registry). Use the LAST "iclock" so we get
    // /registry, /getrequest, /cdata etc.
    const iclockIdx = allSegments.lastIndexOf('iclock')
    const segments = iclockIdx >= 0 ? allSegments.slice(iclockIdx + 1) : allSegments
    const route = segments.join('/')
    const method = req.method

    // ── Debug helper: call with ?debug=1 to see how the path is parsed ──
    if (url.searchParams.get('debug')) {
      return new Response(JSON.stringify({ pathname: url.pathname, allSegments, segments, route }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // ── POST /iclock/cdata ─────────────────────────
    // The device pushes attendance logs via POST.
    //
    // Format examples:
    //   PIN=1023&TTime=2026-07-23%2010%3A21%3A55&Verify=15&Status=0
    //   or tab-separated: PIN \t TTime \t Status \t Verify
    //
    // The device sends plain text or URL-encoded form data.
    if ((method === 'POST' || method === 'GET') && route === 'cdata') {
      const deviceIp = req.headers.get('x-forwarded-for') || url.hostname || 'unknown'
      let rawBody = ''
      let params: Record<string, string> = {}

      // Parse the request body — could be form-encoded or plain text
      const contentType = req.headers.get('content-type') || ''

      if (contentType.includes('application/x-www-form-urlencoded') || method === 'GET') {
        // URL-encoded form data (ADMS protocol)
        if (method === 'GET') {
          params = Object.fromEntries(url.searchParams.entries())
        } else {
          const form = await req.formData().catch(() => null)
          if (form) {
            for (const [key, value] of form.entries()) {
              params[key] = value.toString()
            }
          } else {
            const text = await req.text()
            rawBody = text
            // Try manual URL-encoded parsing if formData fails
            text.split('&').forEach(pair => {
              const [k, v] = pair.split('=')
              if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : ''
            })
          }
        }
      } else {
        // Plain text / tab-separated (traditional PUSH SDK)
        rawBody = await req.text()
      }

      console.log(`[iclock] Request from ${deviceIp}: ${method} ${route}`)
      console.log(`[iclock] Params:`, JSON.stringify(params))
      console.log(`[iclock] Raw body:`, rawBody.substring(0, 500))

      let processed = 0
      let denied = 0

      // Process attendance records from params (ADMS format)
      if (params.PIN || params.pin) {
        // Single attendance record from ADMS
        const pin = (params.PIN || params.pin || '').trim()
        const eventTime = params.TTime || params.Time || params.timestamp || ''
        const verifyType = parseInt(params.Verify || params.verify || '0')
        const statusCode = parseInt(params.Status || params.status || '0')
        const deviceSn = params.SN || params.serial || deviceIp

        await processAttendanceRecord({
          pin,
          eventTime: eventTime.replace(/\+/g, ' '),
          statusCode,
          verifyType,
          deviceSn,
          deviceIp,
          rawData: params
        }).then(r => { processed += r.processed; denied += r.denied })
      }

      // Process attendance records from raw body (tab-separated)
      if (rawBody) {
        const lines = rawBody.split('\n').filter(l => l.trim())
        for (const line of lines) {
          // Parse tab-separated: PIN \t YYYY-MM-DD HH:MM:SS \t Status \t VerifyMode
          const parts = line.split('\t')
          if (parts.length >= 2) {
            const pin = parts[0].trim()
            const eventTime = parts[1].trim()
            const statusCode = parseInt(parts[2]) || 0
            const verifyType = parseInt(parts[3]) || 0

            await processAttendanceRecord({
              pin,
              eventTime,
              statusCode,
              verifyType,
              deviceSn: deviceIp,
              deviceIp,
              rawData: { line }
            }).then(r => { processed += r.processed; denied += r.denied })
          }
        }
      }

      console.log(`[iclock] Processed: ${processed} granted, ${denied} denied`)

      // Update device heartbeat
      await supabase
        .from('zkteco_devices')
        .update({ last_seen: new Date().toISOString(), status: 'online' })
        .eq('ip_address', deviceIp)
        .then(() => {}).catch(() => {})

      // ⚠️ IMPORTANT: The device expects "OK" as plain text, NOT JSON
      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    // ── GET /iclock/getrequest ─────────────────────
    // Device polls for pending commands. Returns commands or empty.
    if (method === 'GET' && route === 'getrequest') {
      const deviceSn = url.searchParams.get('SN') || ''

      const { data: device } = await supabase
        .from('zkteco_devices')
        .select('id')
        .eq('serial_number', deviceSn)
        .maybeSingle()

      if (device) {
        await supabase
          .from('zkteco_devices')
          .update({ last_seen: new Date().toISOString(), status: 'online' })
          .eq('id', device.id)
          .then(() => {}).catch(() => {})

        const { data: pendingCommands } = await supabase
          .from('zkteco_commands')
          .select('id, command, params')
          .eq('device_id', device.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)

        if (pendingCommands && pendingCommands.length > 0) {
          const cmd = pendingCommands[0]
          await supabase
            .from('zkteco_commands')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', cmd.id)
            .then(() => {}).catch(() => {})

          const cmdText = `${cmd.command}${cmd.params && Object.keys(cmd.params).length ? '	' + JSON.stringify(cmd.params) : ''}`
          console.log(`[iclock] Sending command to ${deviceSn}: ${cmdText}`)

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
    // Queue a command from the ERP to be delivered to the device
    if (method === 'GET' && route === 'devicecmd') {
      const deviceSn = url.searchParams.get('SN') || ''
      const cmd = url.searchParams.get('cmd') || ''

      if (!deviceSn || !cmd) {
        return new Response('ERROR: Missing SN or cmd', {
          status: 400,
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        })
      }

      const { data: device } = await supabase
        .from('zkteco_devices')
        .select('id')
        .eq('serial_number', deviceSn)
        .maybeSingle()

      if (device) {
        await supabase.from('zkteco_commands').insert([{
          device_id: device.id,
          command: cmd,
          params: {},
          status: 'pending'
        }]).then(() => {}).catch(err => console.error('[iclock] devicecmd error:', err))
        console.log(`[iclock] Queued command for ${deviceSn}: ${cmd}`)
      }

      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    // ── GET /iclock/registry ───────────────────────
    // Device registers itself on first connection
    if (method === 'GET' && route === 'registry') {
      const serial = url.searchParams.get('SN') || ''
      const model = url.searchParams.get('model') || ''
      const fwVersion = url.searchParams.get('FWVersion') || ''
      const deviceIp = req.headers.get('x-forwarded-for') || url.hostname || ''

      console.log(`[iclock] Registration: SN=${serial} Model=${model} FW=${fwVersion} IP=${deviceIp}`)

      if (serial) {
        const { data: existing } = await supabase
          .from('zkteco_devices')
          .select('id')
          .eq('serial_number', serial)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('zkteco_devices')
            .update({ ip_address: deviceIp, status: 'online', last_seen: new Date().toISOString() })
            .eq('id', existing.id)
            .then(() => {}).catch(() => {})
        } else {
          await supabase
            .from('zkteco_devices')
            .insert([{
              name: `${model || 'SpeedFace-V5L'} (${serial.substring(0, 8)}...)`,
              ip_address: deviceIp,
              serial_number: serial,
              location: `Auto-registered ${model || 'Unknown'}`,
              status: 'online'
            }])
            .then(() => {}).catch(err => console.error('[iclock] registration error:', err))
        }
      }

      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      })
    }

    // ── Fallback ───────────────────────────────────
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain', ...corsHeaders }
    })
  } catch (err) {
    console.error('[iclock] Error:', err)
    return new Response('ERROR: ' + (err?.message || 'Unknown error'), {
      status: 500,
      headers: { 'Content-Type': 'text/plain', ...corsHeaders }
    })
  }
})

// ─── Helper: Process a single attendance record ────────────────

interface AttendanceRecord {
  pin: string
  eventTime: string
  statusCode: number
  verifyType: number
  deviceSn: string
  deviceIp: string
  rawData: any
}

async function processAttendanceRecord(record: AttendanceRecord) {
  let processed = 0
  let denied = 0

  if (!record.pin || !record.eventTime) {
    return { processed, denied }
  }

  const eventType = record.statusCode === 0 ? 'entry' : 'exit'

  // Resolve device by serial number (SN) so we can target AC_UNLOCK
  let deviceId: string | null = null
  const { data: device } = await supabase
    .from('zkteco_devices')
    .select('id')
    .eq('serial_number', record.deviceSn)
    .maybeSingle()
  if (device) deviceId = device.id

  // Find child by zkteco_id (device PIN)
  const { data: child } = await supabase
    .from('children')
    .select('id, name')
    .eq('zkteco_id', record.pin)
    .maybeSingle()

  if (child) {
    // Check active subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('child_id', child.id)
      .eq('status', 'actif')
      .maybeSingle()

    let accessStatus = sub ? 'granted' : 'denied_no_subscription'

    // If subscribed, also check access schedule (weekday + time window)
    if (sub) {
      const scheduleOk = await isWithinSchedule(child.id, record.eventTime)
      if (!scheduleOk) {
        accessStatus = 'denied_schedule'
      }
    }

    // Log to zkteco_logs
    await supabase.from('zkteco_logs').insert([{
      child_id: child.id,
      device_id: deviceId || record.deviceSn || record.deviceIp,
      event_type: eventType,
      event_time: record.eventTime,
      status: accessStatus,
      raw_data: record.rawData
    }]).then(() => {}).catch(err => console.error('[iclock] log error:', err))

    if (accessStatus === 'granted') {
      await supabase.from('access_logs').insert([{
        child_id: child.id,
        timestamp: record.eventTime,
        type: eventType,
        status: 'granted',
        mode: 'online'
      }]).then(() => {}).catch(err => console.error('[iclock] access_log error:', err))

      // 🔓 Queue AC_UNLOCK so the device opens the door on next poll
      if (deviceId) {
        await supabase.from('zkteco_commands').insert([{
          device_id: deviceId,
          command: 'AC_UNLOCK',
          params: {},
          status: 'pending'
        }]).then(() => {}).catch(err => console.error('[iclock] AC_UNLOCK queue error:', err))
        console.log(`[iclock] Queued AC_UNLOCK for device ${record.deviceSn} (child ${child.id})`)
      }
      processed++
    } else {
      denied++
    }
  } else {
    // Unknown PIN — log orphan record
    await supabase.from('zkteco_logs').insert([{
      child_id: null,
      device_id: deviceId || record.deviceSn || record.deviceIp,
      event_type: 'unknown_pin',
      event_time: record.eventTime,
      status: 'denied_unknown_user',
      raw_data: record.rawData
    }]).then(() => {}).catch(err => console.error('[iclock] orphan error:', err))
    denied++
  }

  return { processed, denied }
}

// ─── Helper: Check if the event time falls inside an access schedule ──────────
async function isWithinSchedule(childId: string, eventTime: string): Promise<boolean> {
  try {
    const d = new Date(eventTime.replace(' ', 'T'))
    if (isNaN(d.getTime())) return true // can't parse → don't block

    const weekday = d.getDay()
    const timeStr = d.toTimeString().slice(0, 5) + ':00' // HH:MM:SS

    const { data } = await supabase
      .from('access_schedules')
      .select('start_time, end_time')
      .eq('child_id', childId)
      .eq('weekday', weekday)

    // No schedule configured → allow (fallback to subscription-only)
    if (!data || data.length === 0) return true

    for (const s of data) {
      if (timeStr >= s.start_time && timeStr <= s.end_time) return true
    }
    return false
  } catch (err) {
    console.error('[iclock] schedule check error:', err)
    return true // fail open to avoid blocking access on schedule errors
  }
}
