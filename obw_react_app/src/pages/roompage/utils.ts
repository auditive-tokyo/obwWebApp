export function convertToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('変換失敗'))
        },
        'image/webp',
        0.8 // quality
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}