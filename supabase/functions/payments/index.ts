import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const allSegments = url.pathname.split('/').filter(Boolean)
    const paymentsIdx = allSegments.lastIndexOf('payments')
    const segments = paymentsIdx >= 0 ? allSegments.slice(paymentsIdx + 1) : []
    const method = req.method

    // GET / (list all payments)
    if (method === 'GET' && segments.length === 0) {
      const { data, error } = await supabase.from('payments').select('*, subscriptions(children(name))').order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    // POST / (create payment)
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('payments').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // GET /checks (list all checks - legacy)
    if (method === 'GET' && segments.length === 1 && segments[0] === 'checks') {
      const { data, error } = await supabase.from('checks').select('*').order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    // POST /checks (create check - legacy)
    if (method === 'POST' && segments.length === 1 && segments[0] === 'checks') {
      const body = await req.json()
      const { data, error } = await supabase.from('checks').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // PUT /checks/:id/use (mark check as used - legacy)
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