import { useState } from 'react'
import { convertToWebp } from '../utils'
import { getMessage } from '../../../i18n/messages'

export type PassportUploadProps = {
  roomId: string
  guestName: string
  guestId: string
  client: any
  // 画面側の操作（任意）
  onBack?: () => void
  showEditInfo?: boolean
  // 完了時の外部ハンドラ（任意）。未指定ならデフォルトでアラート+リロード
  onCompleted?: () => void
}

export function PassportUpload({ 
  roomId,
  guestName,
  guestId,
  client,
  onBack,
  showEditInfo,
  onCompleted
}: PassportUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
    } else {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
    }
  }

  const handleUploadAndRegister = async () => {
    if (!file || !previewUrl) return
    setUploading(true)
    setError("")
    try {
      // 1. 画像をwebpに変換
      const webpBlob = await convertToWebp(file)
      
      // 2. ファイル名をguestNameベースに変更
      const sanitizedGuestName = guestName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')
      const webpFileName = `${sanitizedGuestName}_passport.webp`
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

      // 3. AppSync経由でpresigned URL取得
      const presignedQuery = `
        mutation GetPresignedUrl($input: GetPresignedUrlInput!) {
          getPresignedUrl(input: $input) {
            putUrl
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

      const { putUrl, baseUrl } = presignedResult.data.getPresignedUrl

      // 4. webp画像をS3にアップロード
      await fetch(putUrl, {
        method: 'PUT',
        body: webpBlob,
        headers: { 'Content-Type': 'image/webp' }
      })

      // 5. DynamoDBにpassportImageUrlを登録
      const updateQuery = `
        mutation UpdateGuest($input: UpdateGuestInput!) {
          updateGuest(input: $input) {
            roomNumber
            guestId
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

      // 6. 完了通知（外部ハンドラ優先、なければデフォルト挙動）
      if (onCompleted) {
        onCompleted()
      } else {
        alert(getMessage("registrationSuccess") as string)
        window.location.reload()
      }
    } catch (e) {
      console.error('Upload and register error:', e)
      setError("アップロード・登録に失敗しました。")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        {getMessage("enterPassportImage")}
      </h2>
      
      <div className="space-y-6">
        <div className="space-y-4">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange}
            className="w-full"
          />
          
          {/* プレビュー表示 */}
          {previewUrl && (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
              <img 
                src={previewUrl} 
                alt="パスポート写真プレビュー" 
                className="mx-auto max-w-xs rounded-lg shadow-sm"
              />
              <p className="mt-2 text-sm text-gray-600">{getMessage("preview")}</p>
            </div>
          )}
          
                    
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>

        <div className="flex gap-4">
          {showEditInfo && onBack && (
            <button
              onClick={onBack}
              className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-800 bg-gradient-to-r from-yellow-200 to-yellow-400 hover:from-yellow-300 hover:to-yellow-500 transition-colors duration-200 shadow-sm hover:shadow"
            >
              {getMessage("editBasicInfo")}
            </button>
          )}
          <button
            onClick={handleUploadAndRegister}
            disabled={!file || uploading}
            className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-800 bg-gradient-to-r from-green-200 to-green-400 hover:from-green-300 hover:to-green-500 transition-colors duration-200 shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? getMessage("uploading") : getMessage("upload")}
          </button>
        </div>
      </div>
    </div>
  )
}
