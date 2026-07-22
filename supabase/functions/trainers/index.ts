import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/trainers', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    if (method === 'GET' && segments.length === 0) {
      const { data, error } = await supabase.from('trainers').select('*').order('name')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
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