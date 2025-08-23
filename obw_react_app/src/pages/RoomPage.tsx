import { useParams } from 'react-router-dom'
import AccessForm from '@/components/AccessForm'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { GuestSession } from './roompage/types'
import { RoomPageView } from './roompage/RoomPageView' 
import { handleNextAction, handleRegisterAction, verifyOnLoad } from './roompage/handlers/roomPageHandlers'
import { addGuestId } from './roompage/utils/guestIdsStorage'
import { refreshGuestSessions as refreshGuestSessionsSvc, loadMyGuest as loadMyGuestSvc } from './roompage/services/apiCalls'
import { checkFormCompletion } from './roompage/utils/formValidation'

export default function RoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>()
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
  const [guestSessions, setGuestSessions] = useState<GuestSession[]>([])
  const [sessionChecked, setSessionChecked] = useState(false)
  const [sessionValid, setSessionValid] = useState(false)
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const selectedGuest = guestSessions.find(g => g.guestId === selectedGuestId) || null

  const client = useMemo(() => generateClient(), [])

  // サービス関数のラッパー（引数を束ねる）
  const refreshGuestSessions = useCallback(() => {
    return refreshGuestSessionsSvc({ client, roomId, setGuestSessions })
  }, [client, roomId, setGuestSessions])

  // 入力完了判定
  const isInfoComplete = useMemo(() => 
    checkFormCompletion({
      name,
      email,
      address,
      phone,
      occupation,
      nationality,
      checkInDate,
      checkOutDate,
      guestCount: guestSessions.length
    }), [name, email, address, phone, occupation, nationality, checkInDate, checkOutDate, guestSessions.length])

  // 戻る（TODO: 現状はダミー、将来のために残す）
  const handleBack = () => {}

  // 次へ（基本情報送信）
  const handleNext = async () => {
    if (!isInfoComplete) return
    await handleNextAction({
      roomId,
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
      guestId: selectedGuestId,
      selectedGuest: selectedGuest,
    })
    
    // DynamoDB登録成功後、localStorageに保存
    if (selectedGuestId) {
      addGuestId(selectedGuestId)
    }
    
    await refreshGuestSessions()
  }

  // 登録（パスポート画像など）
  const handleRegister = async (rid: string, guestId: string) => {
    await handleRegisterAction({
      roomId: rid,
      guestId: guestId,
      passportImageUrl,
      client,
      setMessage,
    })
    await refreshGuestSessions()
  }

  // 認証チェック（ページロード/リロード時）
  useEffect(() => {
    verifyOnLoad({ roomId, client, setSessionChecked, setSessionValid })
  }, [roomId, client])

  useEffect(() => {
    if (selectedGuest) {
      setName(selectedGuest.guestName || '')
      setEmail(selectedGuest.email || '')
      setAddress(selectedGuest.address || '')
      setPhone(selectedGuest.phone || '')
      setOccupation(selectedGuest.occupation || '')
      setNationality(selectedGuest.nationality || '')
      setCheckInDate(selectedGuest.checkInDate ? new Date(selectedGuest.checkInDate) : null)
      setCheckOutDate(selectedGuest.checkOutDate ? new Date(selectedGuest.checkOutDate) : null)
      setPassportImageUrl(selectedGuest.passportImageUrl ?? null)
      setPromoConsent(!!selectedGuest.promoConsent)
    } else {
      setName('')
      setEmail('')
      setAddress('')
      setPhone('')
      setOccupation('')
      setNationality('')
      setCheckInDate(null)
      setCheckOutDate(null)
      setPassportImageUrl(null)
      setPromoConsent(false)
    }
    // selectedGuestの切替時のみ同期され、入力中に上書きされない
  }, [selectedGuest?.guestId])

  // 新規ゲスト追加（guestIdを生成 → 選択 → フォームへ）
  const handleAddGuest = useCallback(() => {
    const newId =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      Math.random().toString(36).slice(0) + Date.now().toString(36)
    
    setSelectedGuestId(newId)
    // 未保存の新規ゲストを一時的にリストへ反映（表示上のプレースホルダー）
    setGuestSessions(prev => {
      if (prev.some(p => p.guestId === newId)) return prev
      const placeholder: GuestSession = {
        roomNumber: roomId || '',
        guestId: newId,
        guestName: '',
        phone: '',
        registrationDate: new Date().toISOString().slice(0,10),
        approvalStatus: 'waitingForBasicInfo',
        lastUpdated: new Date().toISOString()
      }
      return [placeholder, ...prev]
    })
    // 入力欄をクリア
    setName('')
    setEmail('')
    setAddress('')
    setPhone('')
    setOccupation('')
    setNationality('')
    setCheckInDate(null)
    setCheckOutDate(null)
    setPromoConsent(false)
  }, [roomId])

  // 検証OKのときだけ一覧取得（このガードは残す）
  useEffect(() => {
    if (sessionValid) refreshGuestSessions()
  }, [sessionValid, refreshGuestSessions])

  // 自分のゲスト情報をDynamoDBから読み込む（services 経由）
  const loadMyGuest = useCallback(async () => {
    if (!roomId) return
    const g = await loadMyGuestSvc({ client, roomId })
    if (!g) return
    setName(g.guestName || "")
    setEmail(g.email || "")
    setAddress(g.address || "")
    setPhone(g.phone || "")
    setOccupation(g.occupation || "")
    setNationality(g.nationality || "")
    setPassportImageUrl(g.passportImageUrl || null)
    // 日付は必要に応じて
    setCheckInDate(g.checkInDate ? new Date(g.checkInDate) : null)
    setCheckOutDate(g.checkOutDate ? new Date(g.checkOutDate) : null)
  }, [client, roomId])
  
  // 検証OKのときだけ自分の情報を取得
  useEffect(() => {
    if (sessionValid) loadMyGuest()
  }, [sessionValid, loadMyGuest])

  // 認証していない/検証未完了の分岐
  if (!sessionChecked) {
    return <div style={{ padding: 16 }}>Loading...</div>
  }
  const gid = typeof window !== 'undefined' ? localStorage.getItem('guestId') : null
  const tok = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (!gid || !tok) {
    return (
      <div style={{ padding: 16 }}>
        <AccessForm roomNumber={roomId} />
      </div>
    )
  }

  // ここから先は認証済みUI（既存の登録/アップロード画面など）
  return (
    <>
      <RoomPageView
        roomId={roomId || ""}
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
        handleNext={handleNext}
        handleBack={handleBack}
        handleRegister={handleRegister}
        isInfoComplete={isInfoComplete}
        message={message}
        client={client}
        guestSessions={guestSessions}
        selectedGuest={selectedGuest}
        // 文字列(gid)でも、オブジェクト(GuestSession)でも受けられるようにする
        onSelectGuest={(g) => setSelectedGuestId(typeof g === 'string' ? g : g?.guestId ?? null)}
        onAddGuest={handleAddGuest}
      />
    </>
  )
}