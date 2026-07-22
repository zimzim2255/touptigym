import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const allSegments = url.pathname.split('/').filter(Boolean)
    const subscriptionsIdx = allSegments.lastIndexOf('subscriptions')
    const segments = subscriptionsIdx >= 0 ? allSegments.slice(subscriptionsIdx + 1) : []
    const method = req.method

    // GET /subscriptions?child_id=xxx or ?status=actif
    if (method === 'GET' && segments.length === 0) {
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
    if (method === 'GET' && segments.length === 1) {
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

    // POST /subscriptions/:id/pay (add partial payment)
    if (method === 'POST' && segments.length === 2 && segments[1] === 'pay') {
      const body = await req.json()
      const payAmount = body.amount || 0

      // Get current subscription
      const { data: sub, error: getError } = await supabase.from('subscriptions').select('*').eq('id', segments[0]).single()
      if (getError) return errorResponse('Subscription not found', 404)

      const totalDue = Number(sub.amount) - Number(sub.discount) + Number(sub.insurance) + Number(sub.entry_fee)
      const currentPaid = Number(sub.paid_amount) || 0
      const newPaid = currentPaid + payAmount

      if (newPaid > totalDue) {
        return errorResponse('Payment exceeds total due amount', 400)
      }

      // Update subscription paid_amount
      const { error: updateError } = await supabase.from('subscriptions').update({ paid_amount: newPaid }).eq('id', segments[0])
      if (updateError) return errorResponse(updateError.message)

      // Create payment record
      const { error: payError } = await supabase.from('payments').insert([{
        subscription_id: segments[0],
        amount: payAmount,
        method: body.method || ['espece'],
        check_ids: body.check_ids || [],
      }])
      if (payError) return errorResponse(payError.message)

      // Update checks if any
      if (body.check_ids && body.check_ids.length > 0) {
        for (const checkId of body.check_ids) {
          const { data: check } = await supabase.from('checks').select('montant_used, amount').eq('id', checkId).single()
          if (check) {
            const newUsed = Number(check.montant_used) + (body.pay_amount_per_check?.[checkId] || payAmount)
            await supabase.from('checks').update({
              montant_used: newUsed,
              used: newUsed >= Number(check.amount),
              payment_id: body.payment_id || null,
            }).eq('id', checkId)
          }
        }
      }

      return jsonResponse({ success: true, paid_amount: newPaid, rest: totalDue - newPaid })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
})