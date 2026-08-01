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
    const trainersIdx = allSegments.lastIndexOf('trainers')
    const segments = trainersIdx >= 0 ? allSegments.slice(trainersIdx + 1) : []
    const method = req.method

    if (method === 'GET' && segments.length === 0) {
      try {
        const data = await fetchAll(supabase.from('trainers').select('*'), 'name')
        return jsonResponse(data)
      } catch (err: any) {
        return errorResponse(err.message, 500)
      }
    }

    if (method === 'GET' && segments.length === 1) {
      const { data, error } = await supabase.from('trainers').select('*').eq('id', segments[0]).single()
      if (error) return errorResponse('Trainer not found', 404)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('trainers').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { data, error } = await supabase.from('trainers').update(body).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    if (method === 'DELETE' && segments.length === 1) {
      const { error } = await supabase.from('trainers').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})