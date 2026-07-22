import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/attendance', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    // ─── Absences ─────────────────────────────────
    if (method === 'GET' && segments.length === 1 && segments[0] === 'absences') {
      const { data, error } = await supabase.from('absences').select('*, children(name), exercises(name)').order('date', { ascending: false })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'absences') {
      const body = await req.json()
      const { data, error } = await supabase.from('absences').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    if (method === 'PUT' && segments.length === 3 && segments[0] === 'absences' && segments[2] === 'justify') {
      const body = await req.json()
      const { data, error } = await supabase.from('absences').update({ justified: true, justification: body.justification }).eq('id', segments[1]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // ─── Access Logs ──────────────────────────────
    if (method === 'GET' && segments.length === 1 && segments[0] === 'logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const { data, error } = await supabase.from('access_logs').select('*, children(name), zkteco_devices(name)').order('timestamp', { ascending: false }).limit(limit)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'logs') {
      const body = await req.json()
      const { data, error } = await supabase.from('access_logs').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // ─── Access Schedules ─────────────────────────
    if (method === 'GET' && segments.length === 2 && segments[0] === 'schedules') {
      const { data, error } = await supabase.from('access_schedules').select('*').eq('child_id', segments[1]).order('weekday')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'schedules') {
      const body = await req.json()
      const { data, error } = await supabase.from('access_schedules').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})