const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'td3fzirz'

export function useUpload() {
  return {
    /**
     * Uploads a file through the Supabase `upload` edge function, which
     * performs a SIGNED upload to Cloudinary (real account: td3fzirz).
     * The API secret never leaves the server.
     */
    async uploadFile(file: File, folder = 'toutigym'): Promise<{ url: string; public_id: string }> {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)

      const res = await fetch(`${SUPABASE_URL}/functions/v1/upload`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || 'Upload failed')
      }

      return res.json()
    },

    getImageUrl(publicId: string, options: { width?: number; height?: number; quality?: number } = {}): string {
      let url = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`
      const transforms: string[] = []
      if (options.width) transforms.push(`w_${options.width}`)
      if (options.height) transforms.push(`h_${options.height}`)
      if (options.quality) transforms.push(`q_${options.quality}`)
      if (transforms.length) url += `/${transforms.join(',')}`
      url += `/${publicId}`
      return url
    },
  }
}