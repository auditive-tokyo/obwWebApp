import { PassportUpload } from './PassportUpload'
import type { PassportUploadScreenProps } from '../types'

export function PassportUploadScreen({
  roomId,
  name,
  client,
  passportImageUrl,
  setPassportImageUrl,
  onBack,
  onRegister
}: PassportUploadScreenProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        パスポート写真をアップロード
      </h2>
      
      <div className="space-y-6">
        <PassportUpload 
          onUploaded={setPassportImageUrl} 
          roomId={roomId} 
          guestName={name}
          client={client}
        />
        
        {passportImageUrl && (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <img 
              src={passportImageUrl} 
              alt="パスポート写真" 
              className="mx-auto max-w-xs rounded-lg shadow-sm"
            />
            <p className="mt-2 text-sm text-gray-600">アップロード完了</p>
          </div>
        )}
        
        <div className="flex space-x-4">
          <button 
            onClick={onBack} 
            className="flex-1 py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
          >
            戻る
          </button>
          <button
            onClick={onRegister}
            disabled={!passportImageUrl}
            className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
          >
            登録完了
          </button>
        </div>
      </div>
    </div>
  )
}