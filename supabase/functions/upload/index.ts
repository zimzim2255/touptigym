import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'toutigym'

    if (!file) {
      return errorResponse('No file provided')
    }

    // Cloudinary credentials (set via: supabase secrets set CLOUDINARY_* )
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

    if (!cloudName || !apiKey || !apiSecret) {
      return errorResponse('Cloudinary credentials are not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)', 500)
    }

    // ---- Signed upload to Cloudinary ----
    // Signature = SHA1("folder=...&timestamp=..." + apiSecret)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
    const signature = await sha1Hex(toSign)

    const cloudFormData = new FormData()
    cloudFormData.append('file', file)
    cloudFormData.append('folder', folder)
    cloudFormData.append('timestamp', timestamp)
    cloudFormData.append('api_key', apiKey)
    cloudFormData.append('signature', signature)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: 'POST', body: cloudFormData }
    )

    const result = await response.json()

    if (!response.ok) {
      return errorResponse(result.error?.message || 'Upload failed')
    }

    return jsonResponse({
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    }, 201)
  } catch (err) {
    return errorResponse(err.message, 500)
  }
})

// Cloudinary signed-upload signature: SHA1 hex of "param=value&..." + apiSecret
async function sha1Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}