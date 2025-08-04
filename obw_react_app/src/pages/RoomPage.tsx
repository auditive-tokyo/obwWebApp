import { useParams } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { generateClient } from 'aws-amplify/api'
import { saveGuestSession, loadGuestSession, type ApprovalStatus } from './roompage/sessionUtils'
import { RoomPageView } from './roompage/RoomPageView' 
import { handleNext as handleNextAction, handleRegister as handleRegisterAction } from './roompage/roomPageHandlers'

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [occupation, setOccupation] = useState("")
  const [nationality, setNationality] = useState("")
  const [checkInDate, setCheckInDate] = useState("")
  const [checkOutDate, setCheckOutDate] = useState("")
  const [promoConsent, setPromoConsent] = useState(false)
  const [passportImageUrl, setPassportImageUrl] = useState("")
  const [message, setMessage] = useState("")
  const [currentStep, setCurrentStep] = useState<'info' | 'upload'>('info')
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('waitingForPassportImage')

  const handleNext = async () => {
    if (isInfoComplete) {
      await handleNextAction({
        roomId: roomId || "",
        name,
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
    }
  }

  const handleRegister = async () => {
    await handleRegisterAction({
      roomId: roomId || "",
      name,
      passportImageUrl,
      client,
      setMessage,
      setApprovalStatus,
      loadGuestSession,
      saveGuestSession
    })
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
    <RoomPageView 
      roomId={roomId || ""}
      approvalStatus={approvalStatus}
      currentStep={currentStep}
      name={name}
      setName={setName}
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
    />
  )
}

export default RoomPage