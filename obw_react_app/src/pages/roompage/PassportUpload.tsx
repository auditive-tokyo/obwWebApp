import { useState } from 'react'
import { convertToWebp } from './utils'

export function PassportUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError("")
    try {
      // 1. 画像をwebpに変換
      const webpBlob = await convertToWebp(file)
      const webpFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp"

      // 2. presigned URL取得
      const res = await fetch('https://gk76nywrt6v6twjkkzrimwcate0rtizt.lambda-url.ap-northeast-1.on.aws/', {
        method: 'POST',
        body: JSON.stringify({ filename: webpFileName }),
        headers: { 'Content-Type': 'application/json' }
      })
      const { put_url, get_url } = await res.json()

      // 3. webp画像をアップロード
      await fetch(put_url, {
        method: 'PUT',
        body: webpBlob,
        headers: { 'Content-Type': 'image/webp' }
      })
      onUploaded(get_url) // ← ここでGET用presigned URLを渡す
    } catch (e) {
      setError("アップロードに失敗しました")
    }
    setUploading(false)
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? "アップロード中..." : "アップロード"}
      </button>
      {error && <div className="text-red-500">{error}</div>}
    </div>
  )
}