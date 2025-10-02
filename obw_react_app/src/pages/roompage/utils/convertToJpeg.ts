/**
 * 画像ファイルをjpeg形式に変換する関数
 * - Fileオブジェクトを受け取り、jpeg形式のBlobを返す
 * - 変換にはcanvasを利用
 * - 変換失敗時はエラーをreject
 */
export function convertToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      try {
        const MAX_EDGE = 1024
        const maxDimension = Math.max(img.width, img.height)
        const scale = maxDimension > MAX_EDGE ? MAX_EDGE / maxDimension : 1
        const targetWidth = Math.round(img.width * scale)
        const targetHeight = Math.round(img.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context unavailable')

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('変換失敗'))
          },
          'image/jpeg',
          0.6
        )
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(img.src)
      }
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}