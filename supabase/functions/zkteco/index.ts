import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { fetchAll } from '../_shared/pagination.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/zkteco', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    // ─── Logs & Access Control API ─────────────────

    // GET /zkteco/logs — list all access logs (Contrôle d'Accès)
    if (method === 'GET' && segments.length === 1 && segments[0] === 'logs') {
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
    if (method === 'GET' && segments.join('/') === 'access-logs') {
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
    if (method === 'GET' && segments.join('/') === 'logs/stats') {
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

    // ─── Device Management API ─────────────────────

    // GET /zkteco/devices — list all devices
    if (method === 'GET' && segments.length === 1 && segments[0] === 'devices') {
      const data = await fetchAll(supabase.from('zkteco_devices').select('*'), 'name')
      return jsonResponse(data)
    }

    // PUT /zkteco/devices/:id/status — update device status
    if (method === 'PUT' && segments.length === 3 && segments[0] === 'devices' && segments[2] === 'status') {
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
    if (method === 'GET' && segments.length === 3 && segments[0] === 'devices' && segments[2] === 'commands') {
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
    if (method === 'POST' && segments.length === 3 && segments[0] === 'devices' && segments[2] === 'commands') {
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
    if (method === 'POST' && segments.join('/') === 'iclock/cdata') {
      const text = await req.text()
      const deviceIp = req.headers.get('x-forwarded-for') || url.hostname || 'unknown'
      const lines = text.split('\n').filter(l => l.trim())

      console.log(`[ZKTeco] Received cdata from ${deviceIp}: ${lines.length} records`)

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
    if (method === 'GET' && segments.join('/') === 'iclock/getrequest') {
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
    if (method === 'GET' && segments.join('/') === 'iclock/devicecmd') {
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
    if (method === 'GET' && segments.join('/') === 'iclock/registry') {
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