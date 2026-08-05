import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { fetchAll } from '../_shared/pagination.ts'
import bcrypt from 'npm:bcryptjs@2.4.3'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const allSegments = url.pathname.split('/').filter(Boolean)
    const usersIdx = allSegments.lastIndexOf('users')
    const segments = usersIdx >= 0 ? allSegments.slice(usersIdx + 1) : []
    const method = req.method

    // GET /users - list all user accounts (paginated)
    if (method === 'GET' && segments.length === 0) {
      try {
        const data = await fetchAll(supabase.from('users').select('*'), 'created_at')
        // Never expose password_hash
        const safe = (data || []).map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          trainer_id: u.trainer_id,
          active: u.active !== false,
          created_at: u.created_at,
        }))
        return jsonResponse(safe)
      } catch (err: any) {
        return errorResponse(err.message, 500)
      }
    }

    // GET /users/:id - get one account
    if (method === 'GET' && segments.length === 1) {
      const { data, error } = await supabase.from('users').select('*').eq('id', segments[0]).maybeSingle()
      if (error || !data) return errorResponse('User not found', 404)
      const u = data as any
      return jsonResponse({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        trainer_id: u.trainer_id,
        active: u.active !== false,
        created_at: u.created_at,
      })
    }

    // POST /users - create an employee account
    if (method === 'POST' && segments.length === 0) {
      const body = await req.json()
      const { email, name, role, password } = body

      if (!email || !name || !password) {
        return errorResponse('Email, name and password are required', 400)
      }
      const defaultRole = role === 'admin' || role === 'trainer' || role === 'parent' ? role : 'worker'

      // Hash the password with bcrypt
      const password_hash = bcrypt.hashSync(password)

      const { data, error } = await supabase.from('users').insert([{
        email,
        name,
        role: defaultRole,
        password_hash,
        trainer_id: body.trainer_id || null,
      }]).select().single()
      if (error) return errorResponse(error.message)

      // Never return the hash
      const u = data as any
      return jsonResponse({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        trainer_id: u.trainer_id,
        active: true,
        created_at: u.created_at,
      }, 201)
    }

    // PUT /users/:id - update an account (name, email, role, password, active)
    if (method === 'PUT' && segments.length === 1) {
      const body = await req.json()
      const updateData: any = {}
      if (body.name !== undefined) updateData.name = body.name
      if (body.email !== undefined) updateData.email = body.email
      if (body.role !== undefined) updateData.role = body.role
      if (body.trainer_id !== undefined) updateData.trainer_id = body.trainer_id
      if (body.active !== undefined) updateData.active = body.active === true

      // If a new password is provided, hash it
      if (body.password) {
        updateData.password_hash = bcrypt.hashSync(body.password)
      }

      const { data, error } = await supabase.from('users').update(updateData).eq('id', segments[0]).select().single()
      if (error) return errorResponse(error.message)

      const u = data as any
      return jsonResponse({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        trainer_id: u.trainer_id,
        active: u.active !== false,
        created_at: u.created_at,
      })
    }

    // DELETE /users/:id - remove an account
    if (method === 'DELETE' && segments.length === 1) {
      const { error } = await supabase.from('users').delete().eq('id', segments[0])
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
})