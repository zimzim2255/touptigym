import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/requests', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    if (method === 'GET' && segments.length === 0) {
      const { data, error } = await supabase.from('urgent_requests').select('*, children(name), exercises(name), users(name)').order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('urgent_requests').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    if (method === 'POST' && segments.length === 2 && segments[1] === 'approve') {
      const { data, error } = await supabase.from('urgent_requests').update({ status: 'approuvée' }).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 2 && segments[1] === 'reject') {
      const { data, error } = await supabase.from('urgent_requests').update({ status: 'rejetée' }).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})