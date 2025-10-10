import { useState } from 'react'
import { convertToJpegFile } from '../utils/convertToJpeg'
import { getMessage } from '@/i18n/messages'
import type { GraphQLResult } from '@aws-amplify/api'
import type { Client } from 'aws-amplify/api'

export type PassportUploadProps = {
  roomId: string
  guestName: string
  guestId: string
  client: Client
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
      // 1. 画像をjpegに変換（HEIC対応・リサイズ）
      const jpegFile = await convertToJpegFile(file, { maxEdge: 1024, quality: 0.6 })

      // 2. ファイル名をguestNameベースに変更（拡張子は .jpg に統一）
      // 名前はから以外の入力を許可し、サニタイズはサーバー側で実行している
      const jpegFileName = `${guestName}.jpg`
      
      // 3. 日本時間 (UTC+9) のタイムスタンプを生成（ISO ベースの文字列）
      const timestamp = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace(/[:.]/g, '-').slice(0, 19)

      // 4. AppSync経由でpresigned URL取得
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
            filename: jpegFileName,
            roomId: roomId,
            timestamp: timestamp
          }
        },
        authMode: 'iam'
      })

      // client.graphql can return different shapes; narrow to GraphQLResult
      const presignedRes = presignedResult as unknown as GraphQLResult<{ getPresignedUrl?: { putUrl?: string; baseUrl?: string } }>
      const putUrl = presignedRes.data?.getPresignedUrl?.putUrl
      const baseUrl = presignedRes.data?.getPresignedUrl?.baseUrl

      if (!putUrl || !baseUrl) {
        throw new Error('Failed to obtain presigned URL')
      }

      // 4. jpeg画像をS3にアップロード
      await fetch(putUrl, {
        method: 'PUT',
        body: jpegFile,
        headers: { 'Content-Type': 'image/jpeg' }
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
        alert(getMessage("uploadSuccess") as string)
        window.location.reload()
      }
    } catch (e) {
      console.error('Upload and register error:', e)
      setError(getMessage("uploadError") as string)
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
                alt="Selected passport image preview" 
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
