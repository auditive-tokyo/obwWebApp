// HEICの場合のみこのライブラリが読み込まれる
declare module 'heic2any'


// heic2any で作った JPEG Blob を再処理するためのラッパー
async function processJpegBlob(file: File, maxEdge?: number, quality?: number): Promise<File> {
  return await convertToJpegFile(file, { maxEdge, quality })
}

// Read JPEG EXIF orientation from ArrayBuffer. Returns 1 if unknown/no EXIF.
function getJpegOrientation(arrayBuffer: ArrayBuffer): number {
  try {
    const view = new DataView(arrayBuffer)
    if (view.getUint16(0, false) !== 0xffd8) return 1
    let offset = 2
    const length = view.byteLength
    while (offset < length) {
      const marker = view.getUint16(offset, false)
      offset += 2
      if (marker === 0xffe1) {
        const exifStart = offset + 2
        if (exifStart + 6 > length) break
        // Check for "Exif\0\0"
        if (
          view.getUint8(exifStart) !== 0x45 ||
          view.getUint8(exifStart + 1) !== 0x78 ||
          view.getUint8(exifStart + 2) !== 0x69 ||
          view.getUint8(exifStart + 3) !== 0x66
        )
          break

        const tiffOffset = exifStart + 6
        const littleEndian = view.getUint16(tiffOffset, false) === 0x4949
        const bo = littleEndian
        const firstIFDOffset = view.getUint32(tiffOffset + 4, bo)
        const dirStart = tiffOffset + firstIFDOffset
        if (dirStart + 2 > length) break
        const entries = view.getUint16(dirStart, bo)
        for (let i = 0; i < entries; i++) {
          const entryOffset = dirStart + 2 + i * 12
          if (entryOffset + 10 > length) break
          const tag = view.getUint16(entryOffset, bo)
          if (tag === 0x0112) {
            const val = view.getUint16(entryOffset + 8, bo)
            return val
          }
        }
        break
      } else {
        const size = view.getUint16(offset, false)
        offset += size
      }
    }
  } catch {
    // ignore and fallback
  }
  return 1
}

// Apply canvas transforms according to EXIF orientation and target width/height
function applyOrientationTransform(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, orientation: number, w: number, h: number) {
  switch (orientation) {
    case 2: // horizontal flip
      canvas.width = w
      canvas.height = h
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      break
    case 3: // 180°
      canvas.width = w
      canvas.height = h
      ctx.translate(w, h)
      ctx.rotate(Math.PI)
      break
    case 4: // vertical flip
      canvas.width = w
      canvas.height = h
      ctx.translate(0, h)
      ctx.scale(1, -1)
      break
    case 5: // transpose
      canvas.width = h
      canvas.height = w
      ctx.rotate(0.5 * Math.PI)
      ctx.scale(1, -1)
      break
    case 6: // 90° rotate right
      canvas.width = h
      canvas.height = w
      ctx.rotate(0.5 * Math.PI)
      ctx.translate(0, -h)
      break
    case 7: // transverse
      canvas.width = h
      canvas.height = w
      ctx.rotate(0.5 * Math.PI)
      ctx.translate(w, -h)
      ctx.scale(-1, 1)
      break
    case 8: // 90° rotate left
      canvas.width = h
      canvas.height = w
      ctx.rotate(-0.5 * Math.PI)
      ctx.translate(-w, 0)
      break
    default: // 1 normal
      canvas.width = w
      canvas.height = h
      break
  }
}

/**
 * Convert an input File to a JPEG File.
 * - Handles resize, EXIF orientation correction for JPEGs.
 * - Tries to convert HEIC/HEIF via optional dynamic import of `heic2any` if needed.
 * - Returns a File with `.jpg` extension and MIME `image/jpeg`.
 */
export async function convertToJpegFile(
  file: File,
  options?: { maxEdge?: number; quality?: number }
): Promise<File> {
  // 処理順: (1) 必要なら HEIC → JPEG に変換
  //         (2) EXIF 補正 → (3) リサイズ → (4) 最終 JPEG 出力
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

  // For non-HEIC files, obtain orientation (for JPEG) and an ImageBitmap for drawing
  const arrayBuffer = await file.arrayBuffer()
  const orientation = getJpegOrientation(arrayBuffer)

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

  applyOrientationTransform(canvas, ctx, orientation, w, h)

  // If source had transparency (PNG), fill background with white so JPEG doesn't get black/transparent background
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw the image into the transformed canvas. If rotation swapped dims, draw with new dims.
  ctx.drawImage(bitmap, 0, 0, w, h)

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('JPEG conversion failed')

  const baseName = file.name.replace(/\.[^.]+$/, '')
  const outFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  return outFile
}
