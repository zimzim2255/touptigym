// supabase/functions/save-zkteco-photo/index.ts
// ============================================================
// Serverless bridge: receives a valid Base64 JPEG (from ZKBio's
// validPersonPhoto response) + person ID, decodes it, uploads the
// ORIGINAL photo to the `profiles` storage bucket as {ID}.jpg, and
// upserts the link into `zkteco_photos` (by zkteco_id).
//
// Uses the SERVICE ROLE key (bypasses RLS). Deploy with:
//   npx supabase functions deploy save-zkteco-photo --project-ref atvdorphwnpzhobvfmtz
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { personId, base64Image } = await req.json()

    if (!personId || !base64Image) {
      return errorResponse('Missing personId or base64Image')
    }
    if (typeof base64Image !== 'string' || !/^[A-Za-z0-9+\/=]+$/.test(base64Image) || base64Image.length < 100) {
      return errorResponse('base64Image is not a valid Base64 payload')
    }

    // 1) Service-role client (bypasses RLS on storage + tables)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return errorResponse('Service-role credentials not configured', 500)
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    // 2) Decode Base64 → Uint8Array
    const binary = atob(base64Image)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    const fileName = `${personId}.jpg`

    // 3) Upload to `profiles` bucket (public) with upsert
    const { error: storageError } = await supabase.storage.from('profiles').upload(fileName, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '3600',
    })
    if (storageError) return errorResponse('Storage upload failed: ' + storageError.message, 500)

    const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(fileName)

    // 4) Upsert the link in zkteco_photos (RLS is OFF so anon can read; service key writes safely)
    const { error: dbError } = await supabase
      .from('zkteco_photos')
      .upsert(
        {
          zkteco_id: String(personId),
          photo_url: publicUrl,
          source: 'profile',
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'zkteco_id' }
      )
    if (dbError) return errorResponse('Database update failed: ' + dbError.message, 500)

    return jsonResponse({ success: true, photoUrl: publicUrl, zkteco_id: String(personId) }, 201)
  } catch (err) {
    return errorResponse(err.message || 'Unhandled error', 500)
  }
})