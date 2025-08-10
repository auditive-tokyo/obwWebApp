import { useParams } from 'react-router-dom'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { generateClient } from 'aws-amplify/api'
import { saveGuestSession, loadGuestSession, listGuestSessionsByRoom } from './roompage/sessionUtils'
import type { GuestSession, ApprovalStatus } from './roompage/types'
import { RoomPageView } from './roompage/RoomPageView' 
import { handleNext as handleNextAction, handleRegister as handleRegisterAction } from './roompage/roomPageHandlers'

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [occupation, setOccupation] = useState("")
  const [nationality, setNationality] = useState("")
  const [checkInDate, setCheckInDate] = useState<Date | null>(null)
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null)
  const [promoConsent, setPromoConsent] = useState(false)
  const [passportImageUrl, setPassportImageUrl] = useState("")
  const [message, setMessage] = useState("")
  const [currentStep, setCurrentStep] = useState<'info' | 'upload'>('info')
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('waitingForPassportImage')
  const [guestSessions, setGuestSessions] = useState<GuestSession[]>([])  // ← 追加

  // 一覧を読み込むヘルパー
  const refreshGuestSessions = useCallback(() => {
    if (roomId) setGuestSessions(listGuestSessionsByRoom(roomId))
  }, [roomId])

  // 初回/部屋変更時に読み込み
  useEffect(() => {
    refreshGuestSessions()
  }, [refreshGuestSessions])

  const handleNext = async () => {
    if (isInfoComplete) {
      await handleNextAction({
        roomId: roomId || "",
        name,
        email,
        address,
        phone,
        occupation,
        nationality,
        checkInDate,
        checkOutDate,
        promoConsent,
        client,
        setMessage,
        setApprovalStatus,
        setCurrentStep
      })
      // 保存後に一覧を再取得
      if (roomId) setGuestSessions(listGuestSessionsByRoom(roomId))
    }
  }

  const handleRegister = async () => {
    await handleRegisterAction({
      roomId: roomId || "",
      name,
      email,
      passportImageUrl,
      client,
      setMessage,
      setApprovalStatus,
      loadGuestSession,
      saveGuestSession
    })
    // 保存後に一覧を再取得
    if (roomId) setGuestSessions(listGuestSessionsByRoom(roomId))
  }

  // ページロード時のセッション復旧
  useEffect(() => {
    if (roomId && name) {
      const session = loadGuestSession(roomId, name)
      if (session) {
        setApprovalStatus(session.approvalStatus)
        // ← 他のstateも復元
        setPhone(session.phone)
        
        // ← ステップも復旧
        if (session.approvalStatus !== 'waitingForPassportImage') {
          setCurrentStep('upload')
        }
      }
    }
  }, [roomId, name])

  const client = useMemo(() => generateClient(), [])

  // バリデーション
  const isInfoComplete = Boolean(
    name.trim() && 
    email.trim() && 
    address.trim() && 
    phone.trim() && 
    occupation.trim() && 
    nationality.trim() && 
    checkInDate && 
    checkOutDate
  )

  const handleBack = () => {
    setCurrentStep('info')
  }

  return (
    <>
      {/* この部屋の申請状況（RoomPageViewを使わずに表示） */}
      {guestSessions.length > 0 && (
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">この部屋の申請状況</h3>
            <ul className="divide-y divide-gray-200">
              {guestSessions.map(g => (
                <li key={`${g.roomNumber}_${g.guestName}`} className="py-2 flex items-center justify-between">
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
                    title={new Date(g.lastUpdated).toLocaleString()}
                  >
                    {g.approvalStatus}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 既存のページ本体 */}
      <RoomPageView 
        roomId={roomId || ""}
        approvalStatus={approvalStatus}
        currentStep={currentStep}
        name={name}
        setName={setName}
        email={email}
        setEmail={setEmail}
        address={address}
        setAddress={setAddress}
        phone={phone}
        setPhone={setPhone}
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
        passportImageUrl={passportImageUrl}
        setPassportImageUrl={setPassportImageUrl}
        handleNext={handleNext}
        handleBack={handleBack}
        handleRegister={handleRegister}
        isInfoComplete={isInfoComplete}
        message={message}
        client={client}
        // guestSessions={guestSessions} // ← 一覧を表示する場合はRoomPageViewのpropsに追加して渡す
      />
    </>
  )
}

export default RoomPage