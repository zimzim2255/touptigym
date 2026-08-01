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
    const parentsIdx = allSegments.lastIndexOf('parents')
    const segments = parentsIdx >= 0 ? allSegments.slice(parentsIdx + 1) : []
    const method = req.method

    // GET / (list all parents, or filter by child_id)
    if (method === 'GET' && segments.length === 0) {
      const childId = url.searchParams.get('child_id')
      if (childId) {
        // Get parents linked to this child via parent_children
        const { data, error } = await supabase
          .from('parent_children')
          .select('parents(*)')
          .eq('child_id', childId)
        if (error) return errorResponse(error.message, 500)
        const parents = data.map((pc: any) => pc.parents).filter(Boolean)
        return jsonResponse(parents)
      }
      try {
        const data = await fetchAll(supabase.from('parents').select('*'), 'name')
        return jsonResponse(data)
      } catch (err: any) {
        return errorResponse(err.message, 500)
      }
    }

    // GET /:id (get one parent with children)
    if (method === 'GET' && segments.length === 1) {
      const { data, error } = await supabase.from('parents').select('*, parent_children(child_id)').eq('id', segments[0]).single()
      if (error) return errorResponse('Parent not found', 404)
      return jsonResponse(data)
    }

    // POST / (create parent)
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('parents').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // POST /:parentId/children/:childId (link child)
    if (method === 'POST' && segments.length === 3 && segments[1] === 'children') {
      const { error } = await supabase.from('parent_children').insert([{ parent_id: segments[0], child_id: segments[2] }])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    // PUT /:id (update parent)
    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { data, error } = await supabase.from('parents').update(body).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // DELETE /:id (delete parent)
    if (method === 'DELETE' && segments.length === 1) {
      const { error } = await supabase.from('parents').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    // DELETE /:parentId/children/:childId (unlink child)
    if (method === 'DELETE' && segments.length === 3 && segments[1] === 'children') {
      const { error } = await supabase.from('parent_children').delete().match({ parent_id: segments[0], child_id: segments[2] })
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
})