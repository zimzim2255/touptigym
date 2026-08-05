import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { supabase } from '../_shared/supabaseClient.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import bcrypt from 'npm:bcryptjs@2.4.3'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405)
    }

    const body = await req.json()
    const { email, password } = body || {}

    if (!email || !password) {
      return errorResponse('Email et mot de passe requis', 400)
    }

    // Find the user account by email (case-insensitive match)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', `%${String(email).trim()}%`)
      .maybeSingle()

    if (error) return errorResponse(error.message, 500)
    if (!user) return errorResponse('Email ou mot de passe incorrect', 401)

    // Account must be active
    if (user.active === false) {
      return errorResponse('Ce compte est désactivé. Contactez un administrateur.', 403)
    }

    // Verify the password with bcrypt
    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) return errorResponse('Email ou mot de passe incorrect', 401)

    // Never return the password hash
    const { password_hash, ...safe } = user
    return jsonResponse(safe)
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
})