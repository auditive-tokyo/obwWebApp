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
  const [passportImageUrl, setPassportImageUrl] = useState<string | null>(null)
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

  const handleRegister = async (rid: string, gname: string) => {
    await handleRegisterAction({
      roomId: rid,              // ← クリック選択または現在の部屋IDを使用
      name: gname,              // ← クリック選択の宿泊者名を使用（親stateのnameは使わない）
      email,
      passportImageUrl,
      client,
      setMessage,
      setApprovalStatus,
      loadGuestSession,
      saveGuestSession
    })
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
      <RoomPageView 
        roomId={roomId || ""}
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
        guestSessions={guestSessions}
      />
    </>
  )
}

export default RoomPage