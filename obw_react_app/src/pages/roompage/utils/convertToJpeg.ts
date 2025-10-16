// HEICの場合のみこのライブラリが読み込まれる
declare module 'heic2any'


// heic2any で作った JPEG Blob を再処理するためのラッパー
async function processJpegBlob(file: File, maxEdge?: number, quality?: number): Promise<File> {
  return await convertToJpegFile(file, { maxEdge, quality })
}

/**
 * Convert an input File to a JPEG File.
 * - Handles resize (no EXIF orientation correction).
 * - Tries to convert HEIC/HEIF via optional dynamic import of `heic2any` if needed.
 * - Returns a File with `.jpg` extension and MIME `image/jpeg`.
 */
export async function convertToJpegFile(
  file: File,
  options?: { maxEdge?: number; quality?: number }
): Promise<File> {
  // 処理順: (1) 必要なら HEIC → JPEG に変換
  //         (2) リサイズ → (3) 最終 JPEG 出力
  // サイズはPassportUpload.tsxで引数で指定されている
  const maxEdge = options?.maxEdge
  const quality = options?.quality ?? 0.8

  const isHeic = (f: File) => {
    const t = (f.type || '').toLowerCase()
    const n = (f.name || '').toLowerCase()
    return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif')
  }

  // HEIC の扱い: まず heic2any で JPEG Blob に変換してから再処理する
  if (isHeic(file)) {
    try {
      type Heic2AnyModule = { default: (opts: { blob: Blob; toType: string }) => Promise<Blob> }
      const mod = (await import('heic2any')) as unknown as Heic2AnyModule
      const ab = await file.arrayBuffer()
      const blob: Blob = await mod.default({ blob: new Blob([ab]), toType: 'image/jpeg' })
      const jpgFile = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
      return await processJpegBlob(jpgFile, maxEdge, quality)
    } catch {
      throw new Error('HEIC conversion failed. Install heic2any or upload a JPEG/PNG')
    }
  }

  // For non-HEIC files, obtain an ImageBitmap for drawing
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file as Blob)
  } catch {
    // fallback: use Image + objectURL
    bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
      const img = new Image()
      img.onload = async () => {
        try {
          const bmp = await createImageBitmap(img)
          resolve(bmp)
        } catch (er) {
          reject(er)
        } finally {
          URL.revokeObjectURL(img.src)
        }
      }
      img.onerror = () => reject(new Error('image load failed'))
      img.src = URL.createObjectURL(file)
    })
  }

  // Compute target dimensions. If maxEdge is undefined, keep original dimensions.
  let w = bitmap.width
  let h = bitmap.height
  if (typeof maxEdge === 'number' && maxEdge > 0) {
    const maxDim = Math.max(bitmap.width, bitmap.height)
    const scale = maxDim > maxEdge ? maxEdge / maxDim : 1
    w = Math.round(bitmap.width * scale)
    h = Math.round(bitmap.height * scale)
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')

  canvas.width = w
  canvas.height = h

  // If source had transparency (PNG), fill background with white so JPEG doesn't get black/transparent background
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)

  // Draw the image into the canvas without any orientation transform
  ctx.drawImage(bitmap, 0, 0, w, h)

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('JPEG conversion failed')

  const baseName = file.name.replace(/\.[^.]+$/, '')
  const outFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  return outFile
}
