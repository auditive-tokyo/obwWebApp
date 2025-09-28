import { useParams, useLocation } from 'react-router-dom' // useLocationを追加
import AccessForm from '@/components/AccessForm'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { GuestSession } from './roompage/types'
import { RoomPageView } from './roompage/RoomPageView' 
import { handleNextAction, handleRegisterAction, verifyOnLoad } from './roompage/handlers/roomPageHandlers'
import { refreshGuestSessions as refreshGuestSessionsSvc, loadMyGuest as loadMyGuestSvc, deleteGuestLocation } from './roompage/services/apiCalls'
import { checkFormCompletion } from './roompage/utils/formValidation'
import { syncGeoAndResolveAddress } from './roompage/services/geolocation'
import { dbg } from '@/utils/debugLogger'
import { getMessage } from '@/i18n/messages'
import SmsWelcomeModal from './roompage/components/SmsWelcomeModal'

export default function RoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const location = useLocation()

  // SMS Welcome Modal 用の state
  const [showSmsWelcome, setShowSmsWelcome] = useState(false)

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
  const [isRepresentativeFamily, setIsRepresentativeFamily] = useState(false)
  const [showFamilyQuestion, setShowFamilyQuestion] = useState(false)
  // 「編集に戻る」用の制御フラグ（親で制御）
  const [forceShowForm, setForceShowForm] = useState<boolean | null>(null)
  const [overrideFamilyForEdit, setOverrideFamilyForEdit] = useState<boolean | null>(null)
  const [myCurrentLocation, setMyCurrentLocation] = useState<string | null>(null)
  const selectedGuest = guestSessions.find(g => g.guestId === selectedGuestId) || null
  const bookingId =
    typeof window !== 'undefined' ? localStorage.getItem('bookingId') : null

  const client = useMemo(() => generateClient(), [])

  // SMS検出のuseEffect（最初に配置）
  useEffect(() => {
    console.log('🔍 [PRODUCTION] RoomPage location.state:', location.state)
    console.log('🔍 [PRODUCTION] Current URL:', window.location.href)
    console.log('🔍 [PRODUCTION] location object:', location)
    
    if (location.state?.smsAccess) {
      console.log('✅ [PRODUCTION] SMS Modal should show')
      setShowSmsWelcome(true)
    } else {
      console.log('❌ [PRODUCTION] No smsAccess in state')
    }
  }, [location.state])

  // セッション状態に応じて responseId をクリアする
  useEffect(() => {
    const tok = localStorage.getItem('token')
    if (!tok) {
      localStorage.removeItem('responseId')
      return
    }
    if (sessionChecked && !sessionValid) {
      localStorage.removeItem('responseId')
    }
  }, [sessionChecked, sessionValid])

  // 部屋レベルのチェックイン/アウト日を guestSessions から算出（先頭に見つかった値で可）
  const parseToDate = (d: any): Date | null => {
    if (!d) return null
    if (d instanceof Date) return d
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? null : dt
  }

  const roomCheckInDate = useMemo(() => {
    const found = guestSessions.find(g => g.checkInDate)?.checkInDate ?? null
    return parseToDate(found)
  }, [guestSessions])

  const roomCheckOutDate = useMemo(() => {
    const found = guestSessions.find(g => g.checkOutDate)?.checkOutDate ?? null
    return parseToDate(found)
  }, [guestSessions])

  const hasRoomCheckDates = useMemo(
    () => !!(roomCheckInDate && roomCheckOutDate),
    [roomCheckInDate, roomCheckOutDate]
  )

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
      guestCount: guestSessions.length,
      isRepresentativeFamily,
      hasRoomCheckDates
    }), [name, email, address, phone, occupation, nationality, checkInDate, checkOutDate, guestSessions.length, isRepresentativeFamily, hasRoomCheckDates])

  // 戻る（ID→基本情報フォームへ。家族は名前のみ）
  const handleBack = () => {
    const isFamily = !!(selectedGuest as any)?.isFamilyMember
    setIsRepresentativeFamily(isFamily)
    setForceShowForm(true)
    setOverrideFamilyForEdit(isFamily)
  }

  // 次へ（基本情報送信）
  const handleNext = async () => {
    if (!isInfoComplete) return
    await handleNextAction({
      roomId,
      bookingId,
      name,
      email,
      address,
      phone,
      occupation,
      nationality,
      checkInDate: hasRoomCheckDates ? roomCheckInDate : checkInDate,
      checkOutDate: hasRoomCheckDates ? roomCheckOutDate : checkOutDate,
      promoConsent,
      client,
      setMessage,
      guestId: selectedGuestId,
      selectedGuest: selectedGuest,
      isFamilyMember: isRepresentativeFamily,
    })

    // 編集モードの強制表示を解除し、ID画面へ切り替えられるようにする
    setForceShowForm(null)
    setOverrideFamilyForEdit(null)
    
    await refreshGuestSessions()
  }

  // 登録（ID画像など）
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
      // 家族フラグはサーバ値をそのまま採用
      setIsRepresentativeFamily(!!(selectedGuest as any)?.isFamilyMember)
    } else {
      setName(''); setEmail(''); setAddress(''); setPhone('')
      setOccupation(''); setNationality('')
      setCheckInDate(null); setCheckOutDate(null)
      setPassportImageUrl(null); setPromoConsent(false)
    }
  }, [selectedGuest])

  // 検証OKのときだけ一覧取得（このガードは残す）
  useEffect(() => {
    if (sessionValid) refreshGuestSessions()
  }, [sessionValid, refreshGuestSessions])

  // デバッグ: 選択中ゲストの情報がリスト更新でどう変化したか追跡
  useEffect(() => {
    const g = guestSessions.find(gs => gs.guestId === selectedGuestId)
    if (g) {
      dbg('guestSessions updated for selected guest', {
        guestId: g.guestId,
        approvalStatus: g.approvalStatus,
        isFamilyMember: (g as any)?.isFamilyMember,
        flags: {
          isRepresentativeFamily: (g as any)?.isRepresentativeFamily,
          isFamily: (g as any)?.isFamily,
          role: (g as any)?.role,
        }
      })
    }
  }, [guestSessions, selectedGuestId])

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
    setMyCurrentLocation(g.currentLocation || null)
    // 日付は必要に応じて
    setCheckInDate(g.checkInDate ? new Date(g.checkInDate) : null)
    setCheckOutDate(g.checkOutDate ? new Date(g.checkOutDate) : null)
  }, [client, roomId])

  // 実際の新規ゲスト作成処理
  const handleCreateNewGuest = useCallback((isFamily: boolean) => {
    const newId =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      Math.random().toString(36).slice(0) + Date.now().toString(36)
    
    setIsRepresentativeFamily(isFamily)
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
        lastUpdated: new Date().toISOString(),
        isFamilyMember: isFamily
      }
      dbg('created placeholder guest', placeholder)
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

  // 新規ゲスト追加のクリック処理（家族質問を表示）
  const handleAddGuestClick = useCallback(() => {
    const hasExistingGuests = guestSessions.length > 0
    if (hasExistingGuests) {
      // 既存ゲストがいる場合は家族質問を表示
      setShowFamilyQuestion(true)
    } else {
      // 初回ゲストの場合は直接フォームへ
      handleCreateNewGuest(false)
    }
  }, [guestSessions.length, handleCreateNewGuest])

  // 家族質問への回答処理
  const handleFamilyResponse = useCallback((isFamily: boolean) => {
    setShowFamilyQuestion(false)
    handleCreateNewGuest(isFamily)
  }, [handleCreateNewGuest])
  
  // 検証OKのときだけ自分の情報を取得
  useEffect(() => {
    if (sessionValid) loadMyGuest()
  }, [sessionValid, loadMyGuest])

// 位置情報の同期（ワンショット）
const handleSyncGeo = useCallback(async () => {
  try {
    const gid = localStorage.getItem('guestId')
    if (!gid) return
    const { fix, addressText } = await syncGeoAndResolveAddress({ client, roomId, guestId: gid })
    dbg('[geo] saved', fix, addressText)
    await loadMyGuest()
    alert(getMessage("locationSyncSuccess"))
  } catch (e) {
    console.warn('syncGeo failed', e)
    alert(`${getMessage("locationSyncError")}${getMessage("pleaseRetryLater")}`)
  }
}, [client, roomId, loadMyGuest])

// 位置情報の削除
const handleClearLocation = useCallback(async () => {
  try {
    const gid = localStorage.getItem('guestId')
    if (!gid) return
    await deleteGuestLocation({ client, roomId, guestId: gid })
    dbg('deleted location')
    await loadMyGuest()
    alert(getMessage("locationDeleteSuccess"))
  } catch (e) {
    console.warn('deleteGuestLocation failed', e)
    alert(`${getMessage("locationDeleteError")}${getMessage("pleaseRetryLater")}`)
  }
}, [client, roomId, loadMyGuest])

  // 全てのHooks定義が終わってから条件分岐

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

  // メインレンダリング
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
        hasRoomCheckDates={hasRoomCheckDates}
        roomCheckInDate={roomCheckInDate}
        roomCheckOutDate={roomCheckOutDate}
        isRepresentativeFamily={isRepresentativeFamily}
        forceShowForm={forceShowForm}
        overrideIsRepresentativeFamily={overrideFamilyForEdit}
        showFamilyQuestion={showFamilyQuestion}
        onFamilyResponse={handleFamilyResponse}
        handleNext={handleNext}
        handleBack={handleBack}
        handleRegister={handleRegister}
        isInfoComplete={isInfoComplete}
        message={message}
        client={client}
        guestSessions={guestSessions}
        selectedGuest={selectedGuest}
        // 文字列(gid)でも、オブジェクト(GuestSession)でも受けられるようにする
        onSelectGuest={(g) => {
          const id = typeof g === 'string' ? g : g?.guestId ?? null
          if (id) {
            // ゲスト切替時は強制表示フラグをリセット
            setForceShowForm(null)
            setOverrideFamilyForEdit(null)
          }
          setSelectedGuestId(id)
        }}
        onAddGuest={handleAddGuestClick}
        myCurrentLocation={myCurrentLocation}
        handleSyncGeo={handleSyncGeo}
        handleClearLocation={handleClearLocation}
      />

      {/* SMS Welcome Modal */}
      {showSmsWelcome && (
        <SmsWelcomeModal 
          onClose={() => setShowSmsWelcome(false)}
          originalUrl={location.state?.originalUrl || window.location.href}
        />
      )}
    </>
  )
}