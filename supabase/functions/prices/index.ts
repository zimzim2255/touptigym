import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/prices', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    // ─── Prices ───────────────────────────────────
    if (method === 'GET' && segments.length === 0) {
      const { data, error } = await supabase.from('prices').select('*').order('activities')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { data, error } = await supabase.from('prices').update({ amount: body.amount }).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // ─── Discounts ────────────────────────────────
    if (method === 'GET' && segments.length === 1 && segments[0] === 'discounts') {
      const { data, error } = await supabase.from('discounts').select('*').order('name')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'discounts') {
      const body = await req.json()
      const { data, error } = await supabase.from('discounts').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    if (method === 'PUT' && segments.length === 3 && segments[0] === 'discounts' && segments[2] === 'toggle') {
      const body = await req.json()
      const { data, error } = await supabase.from('discounts').update({ active: body.active }).eq('id', segments[1]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})