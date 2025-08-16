import { useState } from 'react'
import { convertToWebp } from '../utils'

export function PassportUpload({ 
  onUploaded, 
  roomId, 
  guestName, 
  guestId, 
  client 
}: { 
  onUploaded: (url: string) => void
  roomId: string
  guestName: string
  guestId: string
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

      // AppSync経由でpresigned URL取得
      const presignedQuery = `
        mutation GetPresignedUrl($input: GetPresignedUrlInput!) {
          getPresignedUrl(input: $input) {
            putUrl
            getUrl
            baseUrl
          }
        }
      `
      
      const presignedResult = await client.graphql({
        query: presignedQuery,
        variables: {
          input: {
            filename: webpFileName,
            roomId: roomId,
            timestamp: timestamp
          }
        },
        authMode: 'iam'
      })

      // 3. presigned URL取得      
      const { putUrl, getUrl, baseUrl } = presignedResult.data.getPresignedUrl

      // webp画像をアップロード
      await fetch(putUrl, {
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
            guestId: guestId,
            passportImageUrl: baseUrl,
            approvalStatus: 'pending'
          }
        },
        authMode: 'iam'
      })

      // 6. 親コンポーネントに通知
      onUploaded(getUrl)
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