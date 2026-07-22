import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/subscriptions', '')
    const segments = path.split('/').filter(Boolean)
    const method = req.method

    // GET /subscriptions?child_id=xxx or ?status=actif
    if (method === 'GET' && (segments.length === 0 || (segments.length === 1 && url.searchParams.has('child_id')))) {
      const childId = url.searchParams.get('child_id')
      const status = url.searchParams.get('status')

      let query = supabase.from('subscriptions').select('*, children(name)').order('created_at', { ascending: false })
      if (childId) query = query.eq('child_id', childId)
      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data || [])
    }

    // GET /subscriptions/:id
    if (method === 'GET' && segments.length === 1 && !url.searchParams.has('child_id')) {
      const { data, error } = await supabase.from('subscriptions').select('*, children(name)').eq('id', segments[0]).maybeSingle()
      if (!data) return errorResponse('Subscription not found', 404)
      return jsonResponse(data)
    }

    // POST /subscriptions
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('subscriptions').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // PUT /subscriptions/:id
    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { data, error } = await supabase.from('subscriptions').update(body).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // DELETE /subscriptions/:id
    if (method === 'DELETE' && segments.length === 1) {
      const { error } = await supabase.from('subscriptions').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    // POST /subscriptions/:id/confirm
    if (method === 'POST' && segments.length === 2 && segments[1] === 'confirm') {
      const body = await req.json()
      const { data, error } = await supabase.from('subscriptions').update({ status: 'actif', confirmed_by: body.confirmed_by }).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // POST /subscriptions/:id/reject
    if (method === 'POST' && segments.length === 2 && segments[1] === 'reject') {
      const { data, error } = await supabase.from('subscriptions').update({ status: 'résilié' }).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})