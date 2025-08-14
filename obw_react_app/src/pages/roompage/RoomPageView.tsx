import ChatWidget from '../../components/ChatWidget'
import type { RoomPageViewProps } from './types'
import { PassportUploadScreen } from './components/PassportUploadScreen'
import { SecurityInfoCards } from './components/SecurityInfoCards'
import BasicInfoForm from './components/BasicInfoForm'
import { getMessage } from '../../i18n/messages'

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
  passportImageUrl,
  setPassportImageUrl,
  handleNext,
  handleBack,
  handleRegister,
  isInfoComplete,
  message,
  client,
  guestSessions,
  selectedGuest,
  onSelectGuest,
  onAddGuest,
}: RoomPageViewProps) {
  const selectedSession = selectedGuest

  // Date 変換ヘルパー（string|Date|null を Date|null に）
  const toDate = (v: unknown): Date | null => {
    if (!v) return null
    if (v instanceof Date) return v
    if (typeof v === 'string') {
      const d = new Date(v)
      return isNaN(d.getTime()) ? null : d
    }
    return null
  }

  // クリック選択時の表示判定
  const shouldShowBasicInfoForSession = (g: any) =>
    g?.approvalStatus === 'waitingForBasicInfo'

  const shouldShowUploadForSession = (g: any) =>
    g?.approvalStatus === 'waitingForPassportImage'

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

  console.debug('selectedSession:', selectedSession)
  console.debug('shouldShowUploadForSession:', selectedSession && shouldShowUploadForSession(selectedSession))

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
                  className="text-sm px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  ＋ 新規追加
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
                      <span className="text-sm text-gray-800 truncate">{g.guestName || '(未入力)'}</span>
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
                    onClick={() => onSelectGuest(null)}
                  >
                    クリア
                  </button>
                </div>
              )}
            </div>
          )}

          {!guestSessions?.length && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">現在、この部屋の登録はありません。</div>
              <button
                type="button"
                onClick={onAddGuest}
                className="text-sm px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                ＋ 新規追加
              </button>
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
            name={selectedSession?.guestName ?? name}
            setName={setName}
            phone={selectedSession?.phone ?? phone}
            setPhone={setPhone}
            email={selectedSession?.email ?? email}
            setEmail={setEmail}
            address={selectedSession?.address ?? address}
            setAddress={setAddress}
            occupation={selectedSession?.occupation ?? occupation}
            setOccupation={setOccupation}
            nationality={selectedSession?.nationality ?? nationality}
            setNationality={setNationality}
            checkInDate={toDate(selectedSession?.checkInDate) ?? checkInDate}
            setCheckInDate={setCheckInDate}
            checkOutDate={toDate(selectedSession?.checkOutDate) ?? checkOutDate}
            setCheckOutDate={setCheckOutDate}
            promoConsent={selectedSession?.promoConsent ?? promoConsent}
            setPromoConsent={setPromoConsent}
            isInfoComplete={isInfoComplete}
            onNext={handleNext}
          />
        )}

        {/* パスポートアップロード画面 */}
        {showUpload && (
          <div className="mt-4">
            <PassportUploadScreen
              roomId={(selectedSession?.roomNumber ?? roomId) || ""}
              name={selectedSession?.guestName ?? name}
              client={client}
              passportImageUrl={passportImageUrl}
              setPassportImageUrl={setPassportImageUrl}
              onBack={selectedSession ? () => onSelectGuest(null) : handleBack}
              onRegister={handleRegisterWrapper}
              showEditInfo={selectedSession?.approvalStatus === 'waitingForPassportImage'}
            />
          </div>
        )}

        {/* ステータスメッセージ */}
        {showStatus && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {selectedSession?.guestName} | Status
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