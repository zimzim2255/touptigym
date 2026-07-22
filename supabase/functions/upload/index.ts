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

    // Upload to Cloudinary
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY')!
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!

    const cloudFormData = new FormData()
    cloudFormData.append('file', file)
    cloudFormData.append('folder', folder)
    cloudFormData.append('upload_preset', 'ml_default')
    cloudFormData.append('api_key', apiKey)
    cloudFormData.append('timestamp', String(Math.floor(Date.now() / 1000)))

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