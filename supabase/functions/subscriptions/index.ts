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

      let query = supabase.from('subscriptions').select('*, children(name), parents!parent_id(name, gender)').order('created_at', { ascending: false })
      if (childId) query = query.eq('child_id', childId)
      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data || [])
    }

    // GET /subscriptions/:id
    if (method === 'GET' && segments.length === 1) {
      const { data, error } = await supabase.from('subscriptions').select('*, children(name), parents!parent_id(name, gender)').eq('id', segments[0]).maybeSingle()
      if (!data) return errorResponse('Subscription not found', 404)
      return jsonResponse(data)
    }

    // GET /subscriptions/:id/activities — get selected activities for a subscription
    if (method === 'GET' && segments.length === 3 && segments[1] === 'activities') {
      const { data, error } = await supabase.from('subscription_activities').select('*, exercises!activity_id(id, name, type, day, start_time, end_time, group_id)').eq('subscription_id', segments[0])
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data || [])
    }

    // GET /subscriptions/:id/groups — get selected groups for a subscription
    if (method === 'GET' && segments.length === 3 && segments[1] === 'groups') {
      const { data, error } = await supabase.from('subscription_groups').select('*, groups!group_id(id, name, description)').eq('subscription_id', segments[0])
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data || [])
    }

    // GET /subscriptions/:id/courses — get selected courses for a subscription
    if (method === 'GET' && segments.length === 3 && segments[1] === 'courses') {
      const { data, error } = await supabase.from('subscription_courses').select('*, exercises!exercise_id(id, name, type, day, start_time, end_time, group_id)').eq('subscription_id', segments[0])
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data || [])
    }

    // POST /subscriptions
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { activity_ids, group_ids, course_ids, ...subData } = body

      // Insert the subscription
      const { data, error } = await supabase.from('subscriptions').insert([subData]).select().single()
      if (error) return errorResponse(error.message)
      const subscriptionId = data.id

      // Insert junction records for activities
      if (activity_ids && activity_ids.length > 0) {
        const activityRows = activity_ids.map((activity_id: string) => ({
          subscription_id: subscriptionId,
          activity_id,
        }))
        const { error: actError } = await supabase.from('subscription_activities').insert(activityRows)
        if (actError) console.error('Failed to insert activities:', actError)
      }

      // Insert junction records for groups
      if (group_ids && group_ids.length > 0) {
        const groupRows = group_ids.map((group_id: string) => ({
          subscription_id: subscriptionId,
          group_id,
        }))
        const { error: grpError } = await supabase.from('subscription_groups').insert(groupRows)
        if (grpError) console.error('Failed to insert groups:', grpError)
      }

      // Insert junction records for courses (exercises)
      if (course_ids && course_ids.length > 0) {
        const courseRows = course_ids.map((exercise_id: string) => ({
          subscription_id: subscriptionId,
          exercise_id,
        }))
        const { error: crsError } = await supabase.from('subscription_courses').insert(courseRows)
        if (crsError) console.error('Failed to insert courses:', crsError)
      }

      return jsonResponse(data, 201)
    }

    // PUT /subscriptions/:id
    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const { activity_ids, group_ids, course_ids, ...subData } = body

      // Update subscription
      const { data, error } = await supabase.from('subscriptions').update(subData).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      const subscriptionId = segments[0]

      // Replace activity junction records
      if (activity_ids !== undefined) {
        await supabase.from('subscription_activities').delete().eq('subscription_id', subscriptionId)
        if (activity_ids.length > 0) {
          const activityRows = activity_ids.map((activity_id: string) => ({
            subscription_id: subscriptionId,
            activity_id,
          }))
          const { error: actError } = await supabase.from('subscription_activities').insert(activityRows)
          if (actError) console.error('Failed to update activities:', actError)
        }
      }

      // Replace group junction records
      if (group_ids !== undefined) {
        await supabase.from('subscription_groups').delete().eq('subscription_id', subscriptionId)
        if (group_ids.length > 0) {
          const groupRows = group_ids.map((group_id: string) => ({
            subscription_id: subscriptionId,
            group_id,
          }))
          const { error: grpError } = await supabase.from('subscription_groups').insert(groupRows)
          if (grpError) console.error('Failed to update groups:', grpError)
        }
      }

      // Replace course junction records
      if (course_ids !== undefined) {
        await supabase.from('subscription_courses').delete().eq('subscription_id', subscriptionId)
        if (course_ids.length > 0) {
          const courseRows = course_ids.map((exercise_id: string) => ({
            subscription_id: subscriptionId,
            exercise_id,
          }))
          const { error: crsError } = await supabase.from('subscription_courses').insert(courseRows)
          if (crsError) console.error('Failed to update courses:', crsError)
        }
      }

      return jsonResponse(data)
    }

    // DELETE /subscriptions/:id
    if (method === 'DELETE' && segments.length === 1) {
      // First delete junction records (cascade should handle this, but be explicit)
      await supabase.from('subscription_activities').delete().eq('subscription_id', segments[0])
      await supabase.from('subscription_groups').delete().eq('subscription_id', segments[0])
      await supabase.from('subscription_courses').delete().eq('subscription_id', segments[0])
      
      const { error } = await supabase.from('subscriptions').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    // POST /subscriptions/:id/confirm — admin confirms the subscription
    if (method === 'POST' && segments.length === 2 && segments[1] === 'confirm') {
      const body = await req.json()
      const { data, error } = await supabase.from('subscriptions').update({
        status: 'actif',
        confirmed_by: body.confirmed_by,
        confirmation_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // POST /subscriptions/:id/unconfirm — admin unconfirms the subscription
    if (method === 'POST' && segments.length === 2 && segments[1] === 'unconfirm') {
      const { data, error } = await supabase.from('subscriptions').update({
        confirmation_status: 'unconfirmed',
        confirmed_at: new Date().toISOString(),
      }).eq('id', segments[0]).select().single()
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