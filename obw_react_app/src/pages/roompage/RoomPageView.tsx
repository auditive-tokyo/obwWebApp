import ChatWidget from '../../components/ChatWidget'
import type { RoomPageViewProps } from './types'
import { PassportUpload } from './components/PassportUpload'
import { SecurityInfoCards } from './components/SecurityInfoCards'
import BasicInfoForm from './components/BasicInfoForm'
import { getMessage } from '@/i18n/messages'
import { dbg } from '@/utils/debugLogger'

export function RoomPageView(
  props: RoomPageViewProps & {
    hasRoomCheckDates?: boolean
    roomCheckInDate?: Date | null
    roomCheckOutDate?: Date | null
  }
) {
  const {
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
    isRepresentativeFamily,
    showFamilyQuestion,
    onFamilyResponse,
    handleNext,
    handleBack,
    isInfoComplete,
    message,
    client,
    guestSessions,
    selectedGuest,
    onSelectGuest,
    onAddGuest,
    hasRoomCheckDates,
    roomCheckInDate,
    roomCheckOutDate,
  } = props
  const selectedSession = selectedGuest

  // 鍵の4桁コード文書へのアクセス許可: guestSessions の中に approved が1人でもいればOK
  const hasApprovedGuest =
    Array.isArray(guestSessions) &&
    guestSessions.some(g => (g?.approvalStatus || '').toLowerCase() === 'approved')
  const chatRoomId = hasApprovedGuest ? (roomId || '') : ''

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

  // 「Add Guest」ボタンを無効化する条件:
  // どれかのセッションが waitingForBasicInfo かつ guestId を持っている場合は無効化
  const disableAddGuest = !!guestSessions?.some((g: any) => g?.approvalStatus === 'waitingForBasicInfo' && !!g?.guestId)

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
  const BasicInfoFormAny = BasicInfoForm as any

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* ヘッダーカード（ROOM + Room Status + 申請状況リスト） */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            ROOM {roomId}
          </h1>
          {hasRoomCheckDates && (
            <div className="text-sm text-gray-600 mb-2">
              {getMessage("checkInDate")}: {roomCheckInDate ? roomCheckInDate.toLocaleDateString() : ''} 〜 {getMessage("checkOutDate")}: {roomCheckOutDate ? roomCheckOutDate.toLocaleDateString() : ''}
            </div>
          )}
          
          {guestSessions && guestSessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  {getMessage("roomStatus")}
                </h3>
                <div className="relative inline-block group">
                  <button
                    type="button"
                    onClick={onAddGuest}
                    disabled={disableAddGuest}
                    title={disableAddGuest ? getMessage("completeBasicInfoFirst") as string : undefined}
                    className={
                      "text-sm px-2 py-1 rounded bg-gradient-to-r from-blue-300 to-blue-400 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors duration-200 " +
                      (disableAddGuest ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:from-blue-400 hover:to-blue-500")
                    }
                  >
                    {getMessage("addNewPerson")}
                  </button>
                  {disableAddGuest && (
                    <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-max max-w-xs rounded bg-gray-800 text-white text-xs px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                     {getMessage("completeBasicInfoFirst")}
                    </div>
                  )}
                </div>
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
             <div className="text-sm text-gray-600">{getMessage("noRegistrationYet")}</div>
            </div>
          )}
        </div>

        {/* 家族質問モーダル */}
        {showFamilyQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {getMessage("familyQuestionTitle")}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {getMessage("familyQuestionDescription")}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => onFamilyResponse(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {getMessage("no")}
                </button>
                <button
                  type="button"
                  onClick={() => onFamilyResponse(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {getMessage("yes")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* セキュリティ・法的情報カード */}
        <SecurityInfoCards />

        {/* 未選択時の案内テキスト */}
        {!selectedSession && !showForm && !showUpload && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-4 text-gray-700">
           {hasApprovedGuest
             ? getMessage("chatInstructionAfterApproved")
             : getMessage("selectGuestOrAddNew")}
          </div>
        )}

        {/* 基本情報入力フォーム（新規 or waitingForBasicInfo の人を選択時） */}
        {showForm && (
          <BasicInfoFormAny
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
            isRepresentativeFamily={isRepresentativeFamily}
            hasRoomCheckDates={hasRoomCheckDates}
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
          <ChatWidget roomId={chatRoomId} />
        </div>
      </div>
    </div>
  )
}