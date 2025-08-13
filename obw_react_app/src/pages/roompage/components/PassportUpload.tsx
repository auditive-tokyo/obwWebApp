import { useState } from 'react'
import { convertToWebp } from '../utils'

export function PassportUpload({ 
  onUploaded, 
  roomId, 
  guestName, 
  client 
}: { 
  onUploaded: (url: string) => void
  roomId: string
  guestName: string
  client: any
}) {
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
      
      // 2. ファイル名をguestNameベースに変更
      const sanitizedGuestName = guestName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')
      const webpFileName = `${sanitizedGuestName}_passport.webp`  // ← 元のファイル名ではなくguestName使用
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

      // 3. presigned URL取得
      const res = await fetch(import.meta.env.VITE_UPLOAD_LAMBDA_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          filename: webpFileName,
          roomId,
          timestamp
        }),
        headers: { 'Content-Type': 'application/json' }
      })
      const { put_url, get_url } = await res.json()

      // 4. webp画像をアップロード
      await fetch(put_url, {
        method: 'PUT',
        body: webpBlob,
        headers: { 'Content-Type': 'image/webp' }
      })

      // 5. DynamoDBを更新
      const updateQuery = `
        mutation UpdateGuest($input: UpdateGuestInput!) {
          updateGuest(input: $input) {
            roomNumber
            guestName
            passportImageUrl
            approvalStatus
          }
        }
      `
      
      await client.graphql({
        query: updateQuery,
        variables: {
          input: {
            roomNumber: roomId,
            guestName: guestName,
            passportImageUrl: get_url,
            approvalStatus: 'pending'
          }
        },
        authMode: 'iam'
      })

      // 6. 親コンポーネントに通知
      onUploaded(get_url)
    } catch (e) {
      console.error('Upload error:', e)
      setError("Failed to upload passport image.")
    }
    setUploading(false)
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? "Uploading..." : "Upload"}
      </button>
      {error && <div className="text-red-500">{error}</div>}
    </div>
  )
}