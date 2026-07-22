const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'toutigym'

export function useUpload() {
  return {
    async uploadFile(file: File, folder = 'toutigym'): Promise<{ url: string; public_id: string }> {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)
      formData.append('upload_preset', 'ml_default')

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
        { method: 'POST', body: formData }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'Upload failed')
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