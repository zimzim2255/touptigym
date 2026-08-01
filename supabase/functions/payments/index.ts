import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { fetchAll } from '../_shared/pagination.ts'

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
      try {
        const data = await fetchAll(supabase.from('payments').select('*, subscriptions(children(name))'), 'created_at')
        return jsonResponse(data)
      } catch (err: any) {
        return errorResponse(err.message, 500)
      }
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
      try {
        const data = await fetchAll(supabase.from('checks').select('*'), 'created_at')
        return jsonResponse(data)
      } catch (err: any) {
        return errorResponse(err.message, 500)
      }
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