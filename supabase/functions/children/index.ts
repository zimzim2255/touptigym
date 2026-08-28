import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { fetchAll } from '../_shared/pagination.ts'

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop()
    const method = req.method

    // GET /children or /children?q=search
    if (method === 'GET' && (!id || id === 'children')) {
      const q = url.searchParams.get('q')
      let query = supabase.from('children').select('*')
      if (q) query = query.ilike('name', `%${q}%`)
      const data = await fetchAll(query, 'name')
      return jsonResponse(data)
    }

    // GET /children/:id
    if (method === 'GET' && id && id !== 'children') {
      const { data, error } = await supabase.from('children').select('*').eq('id', id).single()
      if (error) return errorResponse('Child not found', 404)
      return jsonResponse(data)
    }

    // POST /children
    if (method === 'POST') {
      const body = await req.json()
      // Compute age from birth_date if provided
      if (body.birth_date) {
        body.age = calculateAge(body.birth_date)
      }
      const { data, error } = await supabase.from('children').insert([body]).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data, 201)
    }

    // PUT /children/:id
    if (method === 'PUT' && id) {
      const body = await req.json()
      // Recompute age if birth_date was changed
      if (body.birth_date) {
        body.age = calculateAge(body.birth_date)
      }
      const { data, error } = await supabase.from('children').update(body).eq('id', id).select().single()
      if (error) return errorResponse(error.message)
      return jsonResponse(data)
    }

    // DELETE /children/:id
    if (method === 'DELETE' && id) {
      const { error } = await supabase.from('children').delete().eq('id', id)
      if (error) return errorResponse(error.message)
      return jsonResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})