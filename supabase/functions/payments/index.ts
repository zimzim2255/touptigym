import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/payments', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    // ─── Payments ─────────────────────────────────
    if (method === 'GET' && segments.length === 0) {
      const { data, error } = await supabase.from('payments').select('*, subscriptions(children(name))').order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('payments').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // ─── Checks ───────────────────────────────────
    if (method === 'GET' && segments.length === 1 && segments[0] === 'checks') {
      const { data, error } = await supabase.from('checks').select('*').order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'checks') {
      const body = await req.json()
      const { data, error } = await supabase.from('checks').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    if (method === 'PUT' && segments.length === 3 && segments[0] === 'checks' && segments[2] === 'use') {
      const body = await req.json()
      const { data, error } = await supabase.from('checks').update({ used: true, payment_id: body.payment_id }).eq('id', segments[1]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})