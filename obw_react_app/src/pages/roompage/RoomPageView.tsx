import { useState, useMemo } from 'react'
import ChatWidget from '@/components/ChatWidget'
import type { RoomPageViewProps } from './types'
import { PassportUpload } from './components/PassportUpload'
import { SecurityInfoCards } from './components/SecurityInfoCards'
import BasicInfoForm from './components/BasicInfoForm'
import { BasicCheckInOutDate } from './components/BasicCheckInOutDate'
import { updateRoomCheckDates, refreshGuestSessions } from './services/apiCalls'
import { getMessage } from '@/i18n/messages'
import { dbg } from '@/utils/debugLogger'

export function RoomPageView(
  props: RoomPageViewProps & {
    hasRoomCheckDates?: boolean
    roomCheckInDate?: Date | null
    roomCheckOutDate?: Date | null
    forceShowForm?: boolean | null
    overrideIsRepresentativeFamily?: boolean | null
    handleSyncGeo?: () => Promise<void>
    handleClearLocation?: () => Promise<void>
    myCurrentLocation?: string | null
    setGuestSessions?: (sessions: any[]) => void
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
    forceShowForm,
    overrideIsRepresentativeFamily,
    handleSyncGeo,
    handleClearLocation,
    myCurrentLocation,
    setGuestSessions,
  } = props
  const selectedSession = selectedGuest

  // 鍵の4桁コード文書へのアクセス許可: guestSessions の中に approved が1人でもいればOK
  const hasApprovedGuest =
    Array.isArray(guestSessions) &&
    guestSessions.some(g => (g?.approvalStatus || '').toLowerCase() === 'approved')

  // チェックイン日の0時以降かどうかを判定（日本時間）
  const isAfterCheckInTime = useMemo(() => {
    if (!roomCheckInDate) return false; // チェックイン日が設定されていない場合は常にfalse
    
    // 現在の日本時間を取得
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    
    // チェックイン日の0時（日本時間）を作成
    const checkInStart = new Date(roomCheckInDate);
    checkInStart.setHours(0, 0, 0, 0); // 0時0分0秒に設定
    
    return japanTime >= checkInStart;
  }, [roomCheckInDate]);

  // 承認状態の最終判定: 承認済みゲストがいて、かつチェックイン日の0時以降
  const isApproved = hasApprovedGuest && isAfterCheckInTime;

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
    forceShowForm === true
      ? true
      : (!!selectedSession && shouldShowBasicInfoForSession(selectedSession))

  const showUpload =
    !!selectedSession && !showForm && shouldShowUploadForSession(selectedSession)

  const showStatus =
    selectedSession &&
    !showForm &&
    !showUpload &&
    !!getStatusMessage(selectedSession)

  dbg('selectedSession:', selectedSession)
  dbg('shouldShowUploadForSession:', selectedSession && shouldShowUploadForSession(selectedSession))
  const BasicInfoFormAny = BasicInfoForm as any

  // 位置情報同期モーダルの状態
  const [showGeoModal, setShowGeoModal] = useState(false)
  // 現在地詳細ポップアップの状態
  const [showLocationDetail, setShowLocationDetail] = useState(false)
  // 日付編集モーダルの状態
  const [showDateEditor, setShowDateEditor] = useState(false)
  // 一時的なチェックイン・チェックアウト日
  const [tempCheckInDate, setTempCheckInDate] = useState<Date | null>(null)
  const [tempCheckOutDate, setTempCheckOutDate] = useState<Date | null>(null)

  // 位置情報同期の確認後実行
  const handleGeoConfirm = async () => {
    setShowGeoModal(false)
    if (handleSyncGeo) {
      await handleSyncGeo()
    }
  }

  // 日付の保存処理
  const handleRoomDateSave = async () => {
    if (!tempCheckInDate || !tempCheckOutDate) return
    
    const bookingId = localStorage.getItem('bookingId')
    if (!bookingId) {
      alert(getMessage("bookingNotFound"))
      return
    }
    
    try {
      // JST形式で日付文字列を作成
      const checkInDateString = tempCheckInDate.toISOString().split('T')[0]
      const checkOutDateString = tempCheckOutDate.toISOString().split('T')[0]
      
      // API呼び出し
      const result = await updateRoomCheckDates({
        client,
        bookingId,
        checkInDate: checkInDateString,
        checkOutDate: checkOutDateString
      })
      
      dbg("✅ Room dates updated successfully:", result)
      
      // 既存のsetterを直接使用（propsから）
      setCheckInDate(tempCheckInDate)      // 既存のprop
      setCheckOutDate(tempCheckOutDate)    // 既存のprop
    
      // ゲストセッション情報を再読み込み
      await refreshGuestSessions({ client, roomId, setGuestSessions })
      
      // モーダルを閉じる
      setShowDateEditor(false)
      setTempCheckInDate(null)
      setTempCheckOutDate(null)
      
    } catch (error) {
      console.error("❌ Failed to update room dates:", error)
      alert(getMessage("dateUpdateFailed"))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* ヘッダーカード（ROOM + Room Status + 申請状況リスト） */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold text-gray-800">
              ROOM {roomId}
            </h1>
            {/* 同期ボタン（右上）とメッセージ */}
            <div className="flex items-center gap-2">
              {myCurrentLocation ? (
                // 位置情報がある場合: 現在地ボタンと同期解除ボタン + クルクル
                <>
                  <button
                    type="button"
                    onClick={() => setShowLocationDetail(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {getMessage("currentLocation")}
                  </button>
                  <span className="text-xs text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    {getMessage("unsyncLocation")}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowGeoModal(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    title={getMessage("locationResyncTitle") as string}
                  >
                    <svg 
                      className="w-5 h-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                  </button>
                </>
              ) : (
                // 位置情報がない場合: 同期ボタン
                <>
                  <span className="text-xs text-gray-500">{getMessage("syncLocation")}</span>
                  <button 
                    type="button"
                    onClick={() => setShowGeoModal(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    title={getMessage("syncLocation") as string}
                  >
                    <svg 
                      className="w-5 h-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
          {hasRoomCheckDates && (
            <div className="text-sm text-gray-600 mb-2">
              {hasApprovedGuest ? (
                // 承認済み：編集不可
                <div className="flex items-center gap-1">
                  <span>
                    {getMessage("checkInDate")}: {roomCheckInDate ? roomCheckInDate.toLocaleDateString() : ''} 〜 {getMessage("checkOutDate")}: {roomCheckOutDate ? roomCheckOutDate.toLocaleDateString() : ''}
                  </span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-xs text-gray-500">({getMessage("editLockedAfterApproval")})</span>
                </div>
              ) : (
                // 未承認：編集可能
                <button 
                  onClick={() => setShowDateEditor(true)}
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  {getMessage("checkInDate")}: {roomCheckInDate ? roomCheckInDate.toLocaleDateString() : ''} 〜 {getMessage("checkOutDate")}: {roomCheckOutDate ? roomCheckOutDate.toLocaleDateString() : ''}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
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

        {/* 位置情報同期確認モーダル */}
        {showGeoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {getMessage(myCurrentLocation ? "locationResyncTitle" : "locationShareTitle")}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {getMessage("locationShareMessage")}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowGeoModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {getMessage("close")}
                </button>
                <button
                  type="button"
                  onClick={handleGeoConfirm}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {getMessage(myCurrentLocation ? "resync" : "share")}
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* セキュリティ・法的情報カード（approvedが1人でもいれば非表示） */}
        {!hasApprovedGuest && <SecurityInfoCards />}

        {/* 未選択時の案内テキスト */}
        {!selectedSession && !showForm && !showUpload && (
          hasApprovedGuest ? (
            isAfterCheckInTime ? (
              // 承認済み + チェックイン日以降
              <div className="mt-4 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 shadow-md p-6">
                <div className="flex items-center gap-3">
                  <img src="/icons8-bot-64.png" alt="" className="w-8 h-8 shrink-0" />
                  <p className="text-lg font-semibold text-teal-900">
                    {getMessage("chatInstructionAfterApproved")}
                  </p>
                </div>
              </div>
            ) : (
              // 承認済み + チェックイン前
              <div className="mt-4 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 shadow-md p-6">
                <div className="flex items-center gap-3">
                  <img src="/icons8-bot-64.png" alt="" className="w-8 h-8 shrink-0" />
                  <p className="text-lg font-semibold text-teal-900">
                    {getMessage("chatInstructionBeforeCheckIn")}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 mt-4 text-gray-700">
              {getMessage("selectGuestOrAddNew")}
            </div>
          )
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
            isRepresentativeFamily={
              overrideIsRepresentativeFamily ?? isRepresentativeFamily
            }
            hasRoomCheckDates={hasRoomCheckDates}
            isInfoComplete={isInfoComplete}
            onNext={handleNext}
          />
        )}

        {/* IDアップロード画面 */}
        {showUpload && (
          <div className="mt-4">
            <PassportUpload
              roomId={(selectedSession?.roomNumber ?? roomId) || ""}
              guestName={selectedSession?.guestName ?? name}
              guestId={selectedSession?.guestId ?? ""}
              client={client}
              onBack={handleBack}
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
          <ChatWidget 
            roomId={roomId || ''} 
            approved={isApproved}
            currentLocation={myCurrentLocation || undefined}
          />
        </div>
      </div>

      {/* 現在地詳細ポップアップ */}
      {showLocationDetail && myCurrentLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {getMessage("locationInfo")}
            </h3>
            <p className="text-sm text-gray-700 mb-6 break-words">
              {myCurrentLocation.split('@')[0]}
            </p>
            <div className="text-xs text-gray-500 mb-4">
              {getMessage("updatedAt")}: {myCurrentLocation.split('@')[1]}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowLocationDetail(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {getMessage("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 日付編集モーダル */}
      {showDateEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {getMessage("editRoomDates")}
            </h3>
            <div className="mb-4">
              <BasicCheckInOutDate
                checkInDate={tempCheckInDate}
                setCheckInDate={setTempCheckInDate}
                checkOutDate={tempCheckOutDate}
                setCheckOutDate={setTempCheckOutDate}
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              <p className="text-sm text-yellow-800">
                ⚠️ {getMessage("roomDateChangeWarning")}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDateEditor(false)
                  setTempCheckInDate(null)
                  setTempCheckOutDate(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {getMessage("cancel")}
              </button>
              <button
                type="button"
                onClick={handleRoomDateSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {getMessage("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}