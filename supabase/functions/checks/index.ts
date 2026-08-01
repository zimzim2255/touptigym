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
    const checksIdx = allSegments.lastIndexOf('checks')
    const segments = checksIdx >= 0 ? allSegments.slice(checksIdx + 1) : []
    const method = req.method

    // GET / (list all checks)
    if (method === 'GET' && segments.length === 0) {
      try {
        const data = await fetchAll(supabase.from('checks').select('*'), 'created_at')
        return jsonResponse(data)
      } catch (err: any) {
        return errorResponse(err.message, 500)
      }
    }

    // GET /:id (get one check)
    if (method === 'GET' && segments.length === 1) {
      const { data, error } = await supabase.from('checks').select('*').eq('id', segments[0]).single()
      if (error) return errorResponse('Check not found', 404)
      return jsonResponse(data)
    }

    // POST / (create check)
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { data, error } = await supabase.from('checks').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // PUT /:id (update check)
    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { data, error } = await supabase.from('checks').update(body).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // PUT /:id/use (use partial amount of a check)
    if (method === 'PUT' && segments.length === 2 && segments[1] === 'use') {
      const body = await req.json()
      const useAmount = body.amount_used || 0

      // Get current check
      const { data: check, error: getError } = await supabase.from('checks').select('*').eq('id', segments[0]).single()
      if (getError) return errorResponse('Check not found', 404)

      const currentUsed = Number(check.montant_used) || 0
      const totalAmount = Number(check.amount) || 0
      const newUsed = currentUsed + useAmount
      const rest = totalAmount - newUsed

      if (newUsed > totalAmount) {
        return errorResponse('Amount exceeds remaining check balance', 400)
      }

      const updateData: any = {
        montant_used: newUsed,
        used: rest <= 0,
      }
      if (body.payment_id) {
        updateData.payment_id = body.payment_id
      }

      const { data, error } = await supabase.from('checks').update(updateData).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // DELETE /:id (delete check)
    if (method === 'DELETE' && segments.length === 1) {
      const { error } = await supabase.from('checks').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
})