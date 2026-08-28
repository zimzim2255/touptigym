import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { fetchAll } from '../_shared/pagination.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    // Find 'attendance' in path segments to handle any URL prefix
    const allSegments = url.pathname.split('/').filter(Boolean)
    const attendanceIdx = allSegments.lastIndexOf('attendance')
    const segments = attendanceIdx >= 0 ? allSegments.slice(attendanceIdx + 1) : []
    const method = req.method

    // ─── Absences ─────────────────────────────────
    if (method === 'GET' && segments.length === 1 && segments[0] === 'absences') {
      const data = await fetchAll(supabase.from('absences').select('*, children(name), exercises(name)'), 'date')
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'absences') {
      const body = await req.json()
      const { data, error } = await supabase.from('absences').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    if (method === 'PUT' && segments.length === 3 && segments[0] === 'absences' && segments[2] === 'justify') {
      const body = await req.json()
      const { data, error } = await supabase.from('absences').update({ justified: true, justification: body.justification }).eq('id', segments[1]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // ─── Check if attendance already marked for exercise+date ──
    if (method === 'GET' && segments.length === 4 && segments[0] === 'exercises' && segments[2] === 'check') {
      const exerciseId = segments[1]
      const date = segments[3]

      // First check if there's an attendance_record (marks when trainer clicked "Enregistrer")
      const { data: record } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('exercise_id', exerciseId)
        .eq('date', date)
        .maybeSingle()

      if (record) {
        // Attendance was marked - return absences if any
        const { data: absences } = await supabase
          .from('absences')
          .select('child_id, type')
          .eq('exercise_id', exerciseId)
          .eq('date', date)

        // Return the absences + a flag that attendance was done
        return jsonResponse({ marked: true, absences: absences || [] })
      }

      // No attendance record found - not yet marked
      return jsonResponse({ marked: false, absences: [] })
    }

    // ─── Get children enrolled in an exercise ─────
    if (method === 'GET' && segments.length === 3 && segments[0] === 'exercises' && segments[2] === 'children') {
      const exerciseId = segments[1]
      // Get subscriptions that include this exercise
      const { data: subs, error: subError } = await supabase
        .from('subscriptions')
        .select('child_id')
        .contains('exercises', [exerciseId])
        .in('status', ['actif', 'en_attente'])
      if (subError && !subError.message?.includes('invalid input')) {
        return errorResponse(subError.message, 500)
      }

      const childIds = subs?.map((s: any) => s.child_id) || []
      if (childIds.length === 0) return jsonResponse([])

      const { data: children, error: childError } = await supabase
        .from('children')
        .select('id, name, gender, age, client_type, photo')
        .in('id', childIds)
        .order('name')
      if (childError) return errorResponse(childError.message, 500)

      return jsonResponse(children)
    }

    // ─── Mark attendance (batch create absences) ──
    if (method === 'POST' && segments.length === 1 && segments[0] === 'mark') {
      const body = await req.json()
      const { exercise_id, date, absences } = body

      if (!exercise_id || !date) {
        return errorResponse('Missing required fields: exercise_id, date', 400)
      }

      // Delete any existing absences for this exercise+date first (to allow re-marking)
      await supabase.from('absences').delete().eq('exercise_id', exercise_id).eq('date', date)

      if (absences && absences.length > 0) {
        const records = absences.map((a: { child_id: string; type: string }) => ({
          child_id: a.child_id,
          exercise_id,
          date,
          type: a.type || 'absence',
          justified: false,
        }))

        const { data, error } = await supabase.from('absences').insert(records).select()
        if (error) return errorResponse(error.message)
      }

      // Always upsert into attendance_records to track that marking was done
      await supabase.from('attendance_records').upsert(
        { exercise_id, date },
        { onConflict: 'exercise_id, date' }
      )

      return jsonResponse({ success: true }, 201)
    }

    // ─── Access Logs ──────────────────────────────
    if (method === 'GET' && segments.length === 1 && segments[0] === 'logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const { data, error } = await supabase.from('access_logs').select('*, children(name), zkteco_devices(name)').order('timestamp', { ascending: false }).limit(limit)
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'logs') {
      const body = await req.json()
      const { data, error } = await supabase.from('access_logs').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // ─── Access Schedules ─────────────────────────
    if (method === 'GET' && segments.length === 2 && segments[0] === 'schedules') {
      const { data, error } = await supabase.from('access_schedules').select('*').eq('child_id', segments[1]).order('weekday')
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data)
    }

    if (method === 'POST' && segments.length === 1 && segments[0] === 'schedules') {
      const body = await req.json()
      const { data, error } = await supabase.from('access_schedules').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})