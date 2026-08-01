import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { fetchAll } from '../_shared/pagination.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const segments = url.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    const method = req.method

    // GET /functions/v1/requests
    if (method === 'GET' && (!last || last === 'requests')) {
      try {
        const data = await fetchAll(supabase.from('urgent_requests').select('*, children(name), exercises(name), users(name)'), 'created_at')
        return jsonResponse(data)
      } catch (err: any) {
        return errorResponse(err.message, 500)
      }
    }

    // POST /functions/v1/requests
    if (method === 'POST' && (!last || last === 'requests')) {
      const body = await req.json()
      const { data, error } = await supabase.from('urgent_requests').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // POST /functions/v1/requests/:id/approve
    if (method === 'POST' && segments.length >= 3 && segments[segments.length - 1] === 'approve') {
      const id = segments[segments.length - 2]
      const { data, error } = await supabase.from('urgent_requests').update({ status: 'approuvée' }).eq('id', id).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // POST /functions/v1/requests/:id/reject
    if (method === 'POST' && segments.length >= 3 && segments[segments.length - 1] === 'reject') {
      const id = segments[segments.length - 2]
      const { data, error } = await supabase.from('urgent_requests').update({ status: 'rejetée' }).eq('id', id).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    return errorResponse('Method not allowed', 405)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorResponse(msg, 500)
  }
})