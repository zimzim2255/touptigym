import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    // Find 'exercises' in path segments to handle any URL prefix
    const allSegments = url.pathname.split('/').filter(Boolean)
    const exercisesIdx = allSegments.lastIndexOf('exercises')
    const segments = exercisesIdx >= 0 ? allSegments.slice(exercisesIdx + 1) : []
    const method = req.method

    // GET /exercises?day=Lundi or ?coach_id=xxx
    if (method === 'GET' && segments.length === 0) {
      const day = url.searchParams.get('day')
      const coachId = url.searchParams.get('coach_id')

      let query = supabase.from('exercises').select('*, trainers(name), groups(name, description)').order('day')
      if (day) query = query.eq('day', day)
      if (coachId) query = query.eq('coach_id', coachId)

      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    // GET /exercises/:id
    if (method === 'GET' && segments.length === 1) {
      const { data, error } = await supabase.from('exercises').select('*, trainers(name), groups(name, description)').eq('id', segments[0]).single()
      if (error) return errorResponse('Exercise not found', 404)
      return jsonResponse(data)
    }

    // POST /exercises
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('exercises').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // PUT /exercises/:id
    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { data, error } = await supabase.from('exercises').update(body).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // DELETE /exercises/:id
    if (method === 'DELETE' && segments.length === 1) {
      const { error } = await supabase.from('exercises').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})