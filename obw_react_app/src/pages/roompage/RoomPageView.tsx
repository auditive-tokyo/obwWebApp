import ChatWidget from '../../components/ChatWidget'
import type { RoomPageViewProps } from './types'
import { PassportUploadScreen } from './components/PassportUploadScreen'
import { SecurityInfoCards } from './components/SecurityInfoCards'
import BasicInfoForm from './components/BasicInfoForm'
import { useState } from 'react'
import { getMessage } from '../../i18n/messages'

export function RoomPageView(props: RoomPageViewProps) {
  const {
    roomId,
    currentStep,
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
    passportImageUrl,
    setPassportImageUrl,
    handleNext,
    handleBack,
    handleRegister,
    isInfoComplete,
    message,
    client,
    guestSessions
  } = props

  // 申請リストから選択された人
  const [selectedSession, setSelectedSession] = useState<any | null>(null)

  // クリック選択時の表示判定
  const shouldShowUploadForSession = (g: any) => {
    const step = g?.currentStep || g?.step || g?.statusStep
    const status = g?.approvalStatus
    return (
      step === 'waitingForPassportImage' ||
      step === 'upload' ||
      status === 'waitingForPassportImage'
    )
  }
  const getStatusMessage = (g: any): string | null => {
    const status = g?.approvalStatus
    if (status === 'pending') return '現在承認待ちです。'
    if (status === 'approved') return '承認されました。'
    if (status === 'rejected') return '承認されませんでした。'
    return null
  }

  const handleRegisterWrapper = async (rid: string, gname: string) => {
    try {
      await handleRegister(rid, gname)
      alert(getMessage("registrationSuccess") as string)
      window.location.reload()
    } catch (e) {
      alert(getMessage("registrationError") as string)
    }
  }

  const showForm = !selectedSession && currentStep === 'info'
  const showUpload = selectedSession ? shouldShowUploadForSession(selectedSession) : currentStep === 'upload'
  const showStatus = selectedSession && !showUpload && !!getStatusMessage(selectedSession)

  console.debug('selectedSession:', selectedSession)
  console.debug('shouldShowUploadForSession:', selectedSession && shouldShowUploadForSession(selectedSession))

  const clearSelection = () => setSelectedSession(null)

  // 選択中の人/未選択時の有効値
  const effectiveRoomId = (selectedSession?.roomNumber ?? roomId) || ""
  const effectiveGuestName = selectedSession?.guestName ?? name

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* この部屋の申請状況 */}
        {guestSessions && guestSessions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">{getMessage("roomStatus")}</h3>
            <ul className="divide-y divide-gray-200">
              {guestSessions.map(g => {
                const isSelected = selectedSession &&
                  selectedSession.roomNumber === g.roomNumber &&
                  selectedSession.guestName === g.guestName
                return (
                  <li
                    key={`${g.roomNumber}_${g.guestName}`}
                    className={
                      "py-2 px-2 flex items-center justify-between cursor-pointer select-none " +
                      (isSelected ? "bg-blue-50 ring-1 ring-blue-300 rounded-md" : "hover:bg-gray-50")
                    }
                    onClick={() => setSelectedSession(g)}
                    aria-selected={isSelected}
                    title={new Date(g.lastUpdated).toLocaleString()}
                  >
                    <span className="text-sm text-gray-800 truncate">{g.guestName}</span>
                    <span
                      className={
                        'text-xs px-2 py-0.5 rounded-full ' +
                        (g.approvalStatus === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : g.approvalStatus === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : g.approvalStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700')
                      }
                    >
                      {g.approvalStatus}
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
                  onClick={clearSelection}
                >
                  {getMessage("clear")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ヘッダーカード */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            ROOM {roomId}
          </h1>
        </div>

        {/* セキュリティ・法的情報カード */}
        <SecurityInfoCards />

        {/* 基本情報入力フォーム（新規 or 未選択時のみ） */}
        {showForm && (
          <BasicInfoForm
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

        {/* クリック選択: ステータスメッセージ表示 */}
        {showStatus && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {selectedSession?.guestName} | Status
            </h2>
            <p className="text-gray-700">{getStatusMessage(selectedSession)}</p>
          </div>
        )}

        {/* パスポートアップロード画面（クリック選択 or 従来ステップ） */}
        {showUpload && (
          <div className="mt-4">
            <PassportUploadScreen
              roomId={effectiveRoomId}
              name={effectiveGuestName}
              client={client}
              passportImageUrl={passportImageUrl}
              setPassportImageUrl={setPassportImageUrl}
              onBack={
                selectedSession
                  ? () => {
                      // setEditSession(selectedSession);
                      setSelectedSession(null);

                      // ここでeditSessionの値をstateに反映
                      setName(selectedSession.guestName ?? "");
                      setPhone(selectedSession.phone ?? "");
                      setEmail(selectedSession.email ?? "");
                      setAddress(selectedSession.address ?? "");
                      setOccupation(selectedSession.occupation ?? "");
                      setNationality(selectedSession.nationality ?? "");
                      setCheckInDate(selectedSession.checkInDate ?? null);
                      setCheckOutDate(selectedSession.checkOutDate ?? null);
                      setPromoConsent(selectedSession.promoConsent ?? false);
                    }
                  : handleBack
              }
              onRegister={handleRegisterWrapper}
              showEditInfo={selectedSession?.approvalStatus === 'waitingForPassportImage'}
            />
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