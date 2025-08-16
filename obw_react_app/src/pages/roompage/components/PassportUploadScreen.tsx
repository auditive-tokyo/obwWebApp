import { PassportUpload } from './PassportUpload'
import type { PassportUploadScreenProps } from '../types'
import { getMessage } from '../../../i18n/messages'

export function PassportUploadScreen({
  roomId,
  name,
  guestId,
  client,
  onBack,
  showEditInfo
}: PassportUploadScreenProps & { showEditInfo?: boolean }) {

  const handleCompleted = () => {
    alert(getMessage("registrationSuccess") as string)
    window.location.reload()
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        {getMessage("enterPassportImage")}
      </h2>
      
      <div className="space-y-6">
        <PassportUpload 
          onCompleted={handleCompleted}  // ← 完了時の処理
          roomId={roomId} 
          guestId={guestId}
          guestName={name}
          client={client}
        />
        
        <div className="flex space-x-4">
          {showEditInfo && (
            <button
              onClick={onBack}
              className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors duration-200"
            >
              {getMessage("editBasicInfo")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}