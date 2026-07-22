import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/zkteco', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    // GET /zkteco/devices
    if (method === 'GET' && segments.length === 1 && segments[0] === 'devices') {
      const { data, error } = await supabase.from('zkteco_devices').select('*').order('name')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    // PUT /zkteco/devices/:id/status
    if (method === 'PUT' && segments.length === 3 && segments[0] === 'devices' && segments[2] === 'status') {
      const body = await req.json()
      const { data, error } = await supabase.from('zkteco_devices').update({ status: body.status, last_log: new Date() }).eq('id', segments[1]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // ─── PUSH SDK Endpoints ────────────────────────
    // POST /zkteco/iclock/cdata (receives attendance logs from device)
    if (method === 'POST' && segments.join('/') === 'iclock/cdata') {
      const text = await req.text()
      const lines = text.split('\n').filter(l => l.trim())
      for (const line of lines) {
        const parts = line.split('\t')
        if (parts.length >= 4) {
          const pin = parts[0]
          const timestamp = parts[1]
          const status = parseInt(parts[2])
          const verifyMode = parseInt(parts[3])

          // Find child by zkteco_id
          const { data: child } = await supabase.from('children').select('id').eq('zkteco_id', pin).single()
          if (child) {
            // Check active subscription
            const { data: sub } = await supabase.from('subscriptions').select('id').eq('child_id', child.id).eq('status', 'actif').single()
            if (sub) {
              await supabase.from('access_logs').insert([{
                child_id: child.id,
                timestamp,
                type: status === 0 ? 'entry' : 'exit',
                status: 'granted',
                mode: 'online'
              }])
            }
          }
        }
      }
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain', ...corsHeaders } })
    }

    // GET /zkteco/iclock/getrequest (device polls for commands)
    if (method === 'GET' && segments.join('/') === 'iclock/getrequest') {
      return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain', ...corsHeaders } })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})