import ChatWidget from '../../components/ChatWidget'
import type { RoomPageViewProps } from './types'
import { PassportUpload } from './components/PassportUpload'
import { SecurityInfoCards } from './components/SecurityInfoCards'
import BasicInfoForm from './components/BasicInfoForm'
import { getMessage } from '@/i18n/messages'
import { dbg } from '@/utils/debugLogger'

export function RoomPageView({
  roomId,
  name,
  setName,
  email,
  setEmail,
  address,
  setAddress,
  phone,
  setPhone,
  occupation,
  setOccupation,
  nationality,
  setNationality,
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate,
  promoConsent,
  setPromoConsent,
  handleNext,
  handleBack,
  isInfoComplete,
  message,
  client,
  guestSessions,
  selectedGuest,
  onSelectGuest,
  onAddGuest,
}: RoomPageViewProps) {
  const selectedSession = selectedGuest

  // クリック選択時の表示判定
  const shouldShowBasicInfoForSession = (g: any) =>
    g?.approvalStatus === 'waitingForBasicInfo'

  const shouldShowUploadForSession = (g: any) =>
    g?.approvalStatus === 'waitingForPassportImage'

  const getStatusMessage = (g: any): string | null => {
    const status = g?.approvalStatus
    if (status === 'pending') return getMessage("statusPending") as string
    if (status === 'approved') return getMessage("statusApproved") as string
    if (status === 'rejected') return getMessage("statusRejected") as string
    return null
  }

  const getStatusLabel = (status?: string): string => {
    switch (status) {
      case 'waitingForBasicInfo':
        return getMessage('enterBasicInfo') as string
      case 'waitingForPassportImage':
        return getMessage('enterPassportImage') as string
      case 'pending':
        return getMessage('statusPending') as string
      case 'approved':
        return getMessage('statusApproved') as string
      case 'rejected':
        return getMessage('statusRejected') as string
      default:
        return status ?? ''
    }
  }

  // 選択されている人がいる場合のみフォーム/アップロードを出す
  const showForm =
    !!selectedSession && shouldShowBasicInfoForSession(selectedSession)

  const showUpload =
    !!selectedSession && shouldShowUploadForSession(selectedSession)

  const showStatus =
    selectedSession &&
    !showForm &&
    !showUpload &&
    !!getStatusMessage(selectedSession)

  dbg('selectedSession:', selectedSession)
  dbg('shouldShowUploadForSession:', selectedSession && shouldShowUploadForSession(selectedSession))

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* ヘッダーカード（ROOM + Room Status + 申請状況リスト） */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            ROOM {roomId}
          </h1>
          
          {guestSessions && guestSessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  {getMessage("roomStatus")}
                </h3>
                <button
                  type="button"
                  onClick={onAddGuest}
                  className="text-sm px-2 py-1 rounded bg-gradient-to-r from-blue-300 to-blue-400 hover:from-blue-400 hover:to-blue-500 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors duration-200"
                >
                  {getMessage("addNewPerson")}
                </button>
              </div>

              <ul className="divide-y divide-gray-200 border border-gray-100 rounded-md">
                {guestSessions.map(g => {
                  const isSelected =
                    !!selectedSession && selectedSession.guestId === g.guestId
                  return (
                    <li
                      key={g.guestId || `${g.roomNumber}_${g.guestName}`}
                      className={
                        "py-2 px-3 flex items-center justify-between cursor-pointer select-none " +
                        (isSelected ? "bg-blue-50 ring-1 ring-blue-300 rounded-md" : "hover:bg-gray-50")
                      }
                      onClick={() => onSelectGuest(g.guestId)}
                      aria-selected={isSelected}
                      title={g.lastUpdated ? new Date(g.lastUpdated).toLocaleString() : ''}
                    >
                      <span className="text-sm text-gray-800 truncate">{g.guestName || getMessage("unfilled")}</span>
                      <span
                        className={
                          'text-xs px-2 py-0.5 rounded-full ' +
                          (g.approvalStatus === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : g.approvalStatus === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : g.approvalStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : g.approvalStatus === 'waitingForBasicInfo'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-blue-100 text-blue-700')
                        }
                      >
                        {getStatusLabel(g.approvalStatus)}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {selectedSession && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline"
                    onClick={() => onSelectGuest(null)}
                  >
                    {getMessage("unselect")}
                  </button>
                </div>
              )}
            </div>
          )}

          {!guestSessions?.length && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">現在、この部屋の登録はありません。</div>
            </div>
          )}
        </div>

        {/* セキュリティ・法的情報カード */}
        <SecurityInfoCards />

        {/* 未選択時の案内テキスト */}
        {!selectedSession && !showForm && !showUpload && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-4 text-gray-700">
            お客様の情報を入力してください。上のリストから対象の方を選択するか、「新規追加」を押してください。
          </div>
        )}

        {/* 基本情報入力フォーム（新規 or waitingForBasicInfo の人を選択時） */}
        {showForm && (
          <BasicInfoForm
            // 常にローカルstateをフォームに渡す（selectedSessionの値は使わない）
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            email={email}
            setEmail={setEmail}
            address={address}
            setAddress={setAddress}
            occupation={occupation}
            setOccupation={setOccupation}
            nationality={nationality}
            setNationality={setNationality}
            checkInDate={checkInDate}
            setCheckInDate={setCheckInDate}
            checkOutDate={checkOutDate}
            setCheckOutDate={setCheckOutDate}
            promoConsent={promoConsent}
            setPromoConsent={setPromoConsent}
            isInfoComplete={isInfoComplete}
            onNext={handleNext}
          />
        )}

        {/* パスポートアップロード画面 */}
        {showUpload && (
          <div className="mt-4">
            <PassportUpload
              roomId={(selectedSession?.roomNumber ?? roomId) || ""}
              guestName={selectedSession?.guestName ?? name}
              guestId={selectedSession?.guestId ?? ""}
              client={client}
              onBack={selectedSession ? () => onSelectGuest(null) : handleBack}
              showEditInfo={selectedSession?.approvalStatus === 'waitingForPassportImage'}
            />
          </div>
        )}

        {/* ステータスメッセージ */}
        {showStatus && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {selectedSession?.guestName}
            </h2>
            <p className="text-gray-700">{getStatusMessage(selectedSession)}</p>
          </div>
        )}

        {/* メッセージ表示 */}
        {message && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
            {message}
          </div>
        )}

        {/* チャット */}
        <div className="mt-8">
          <ChatWidget roomId={roomId || ""} />
        </div>
      </div>
    </div>
  )
}