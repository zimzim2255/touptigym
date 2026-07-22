import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/parents', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    // GET /parents
    if (method === 'GET' && segments.length === 0) {
      const { data, error } = await supabase.from('parents').select('*').order('name')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    // GET /parents/:id
    if (method === 'GET' && segments.length === 1) {
      const { data, error } = await supabase.from('parents').select('*, parent_children(child_id)').eq('id', segments[0]).single()
      if (error) return errorResponse('Parent not found', 404)
      return jsonResponse(data)
    }

    // POST /parents
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('parents').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // PUT /parents/:id
    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { data, error } = await supabase.from('parents').update(body).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // DELETE /parents/:id
    if (method === 'DELETE' && segments.length === 1) {
      const { error } = await supabase.from('parents').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    // POST /parents/:parentId/children/:childId (link)
    if (method === 'POST' && segments.length === 3 && segments[1] === 'children') {
      const { error } = await supabase.from('parent_children').insert([{ parent_id: segments[0], child_id: segments[2] }])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    // DELETE /parents/:parentId/children/:childId (unlink)
    if (method === 'DELETE' && segments.length === 3 && segments[1] === 'children') {
      const { error } = await supabase.from('parent_children').delete().match({ parent_id: segments[0], child_id: segments[2] })
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})