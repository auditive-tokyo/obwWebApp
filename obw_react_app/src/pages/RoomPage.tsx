import { useParams } from 'react-router-dom'
import AccessForm from '../components/AccessForm'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { GuestSession } from './roompage/types'
import { RoomPageView } from './roompage/RoomPageView' 
import { handleNext as handleNextAction, handleRegister as handleRegisterAction } from './roompage/roomPageHandlers'

// ログ出力ヘルパー
const dbg = (...args: any[]) => { if (import.meta.env.DEV) console.debug('[RoomPage]', ...args) }

// localStorage guestIds ヘルパー（ログ付き）
const getGuestIds = (): string[] => {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('guestIds') : null
  dbg('getGuestIds raw =', raw)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
    dbg('guestIds value is not an array:', arr)
    return []
  } catch (e) {
    dbg('guestIds JSON parse error:', e)
    return []
  }
}
const setGuestIds = (ids: string[]) => {
  if (typeof window === 'undefined') return
  dbg('setGuestIds ->', ids)
  localStorage.setItem('guestIds', JSON.stringify(ids))
}

// 追加: guestIds に一件追加するヘルパー
const addGuestId = (id: string) => {
  const ids = getGuestIds()
  if (ids.includes(id)) {
    dbg('addGuestId: already included', id)
    return
  }
  const next = [...ids, id]
  dbg('addGuestId ->', next)
  setGuestIds(next)
}

const ensureGuestIdsContains = (id: string | null) => {
  if (!id) return
  const ids = getGuestIds()
  if (!ids.includes(id)) {
    const next = [...ids, id]
    dbg('ensureGuestIdsContains: add', id, '->', next)
    setGuestIds(next)
  } else {
    dbg('ensureGuestIdsContains: already included', id)
  }
}

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

  // 入力完了判定（必要なら条件を調整）
  const isInfoComplete = useMemo(() => {
    return (
      name.trim().length > 0 &&
      (email.trim().length > 0 || phone.trim().length > 0) &&
      Boolean(checkInDate) &&
      Boolean(checkOutDate)
    )
  }, [name, email, phone, checkInDate, checkOutDate])

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
    await refreshGuestSessions()
  }

  // 登録（パスポート画像など）
  const handleRegister = async (rid: string, gname: string) => {
    await handleRegisterAction({
      roomId: rid,
      name: gname,
      email,
      passportImageUrl,
      client,
      setMessage,
    } as any) // 型が合わない場合はハンドラ側の引数を任意化するか、このcastを維持
    await refreshGuestSessions()
  }

  // 認証チェック（ページロード/リロード時）
  useEffect(() => {
    async function verifyOnLoad() {
      dbg('verifyOnLoad start: roomId=', roomId)
      if (!roomId) { setSessionChecked(true); setSessionValid(false); dbg('no roomId'); return }
      const gid = typeof window !== 'undefined' ? localStorage.getItem('guestId') : null
      const tok = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      dbg('verifyOnLoad localStorage -> guestId=', gid, 'token exists =', !!tok)
      if (!gid || !tok) { setSessionChecked(true); setSessionValid(false); dbg('missing gid or token'); return }
      try {
        const query = `
          mutation VerifyAccessToken($roomNumber: String!, $guestId: String!, $token: String!) {
            verifyAccessToken(roomNumber: $roomNumber, guestId: $guestId, token: $token) { success }
          }
        `
        const res = await client.graphql({ query, variables: { roomNumber: roomId, guestId: gid, token: tok }, authMode: 'iam' })
        const ok = 'data' in res && res.data?.verifyAccessToken?.success
        dbg('verifyOnLoad result ok =', ok)
        if (!ok) {
          localStorage.removeItem('guestId')
          localStorage.removeItem('token')
          setSessionValid(false)
        } else {
          // ここで単体 guestId を配列 guestIds に移行
          ensureGuestIdsContains(gid)
          setSessionValid(true)
        }
      } catch (e) {
        localStorage.removeItem('guestId')
        localStorage.removeItem('token')
        console.error('verify on load failed:', e)
        setSessionValid(false)
      } finally {
        setSessionChecked(true)
        dbg('verifyOnLoad finished')
      }
    }
    verifyOnLoad()
  }, [roomId, client])

  const refreshGuestSessions = useCallback(async () => {
    if (!roomId) { dbg('refreshGuestSessions: no roomId'); return }
    let ids = getGuestIds()
    // 互換: guestIds が無ければ単体 guestId を取り込む
    if ((!ids || !ids.length) && typeof window !== 'undefined') {
      const single = localStorage.getItem('guestId')
      if (single) {
        dbg('migrating single guestId -> guestIds:', single)
        ids = [single]
        setGuestIds(ids)
      }
    }
    dbg('refreshGuestSessions start: roomId=', roomId, 'guestIds=', ids)
    if (!ids.length) {
      dbg('no guestIds -> set empty list')
      setGuestSessions([])
      return
    }
    try {
      const results = await Promise.all(
        ids.map(async (gid: string) => {
          const query = `
            query GetGuest($roomNumber: String!, $guestId: String!) {
              getGuest(roomNumber: $roomNumber, guestId: $guestId) {
                guestId
                guestName
                approvalStatus
                email
                address
                phone
                occupation
                nationality
                checkInDate
                checkOutDate
                passportImageUrl
              }
            }
          `
          dbg('getGuest call ->', { roomNumber: roomId, guestId: gid })
          try {
            const res = await client.graphql({ query, variables: { roomNumber: roomId, guestId: gid }, authMode: 'iam' })
            const g = 'data' in res ? res.data?.getGuest : null
            dbg('getGuest result for', gid, '->', g ? { guestId: g.guestId, name: g.guestName, status: g.approvalStatus } : null)
            return g
          } catch (err) {
            console.error('getGuest failed for', gid, err)
            return null
          }
        })
      )
      const list = results.filter(Boolean) as GuestSession[]
      dbg('setGuestSessions length =', list.length, 'items =', list.map(g => ({ id: g.guestId, name: g.guestName, status: g.approvalStatus })))
      setGuestSessions(list)
    } catch (e) {
      console.error('load room sessions failed:', e)
      setGuestSessions([])
    }
  }, [client, roomId])

  // 新規ゲスト追加（guestIdを生成 → localStorageに追加 → 選択 → フォームへ）
  const handleAddGuest = useCallback(() => {
    const newId =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      Math.random().toString(36).slice(2) + Date.now().toString(36)
    addGuestId(newId)
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
    // 入力フォームに遷移するためステップをinfoに
    // setCurrentStep('info')
    // 入力欄をクリア（必要に応じて）
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

  // 自分のゲスト情報をDynamoDBから読み込む（localStorageは使わない）
  const loadMyGuest = useCallback(async () => {
    if (!roomId) return
    const gid = typeof window !== 'undefined' ? localStorage.getItem('guestId') : null
    if (!gid) return
    try {
      const query = `
        query GetGuest($roomNumber: String!, $guestId: String!) {
          getGuest(roomNumber: $roomNumber, guestId: $guestId) {
            guestName
            email
            address
            phone
            occupation
            nationality
            approvalStatus
            checkInDate
            checkOutDate
            passportImageUrl
          }
        }
      `
      const res = await client.graphql({ query, variables: { roomNumber: roomId, guestId: gid }, authMode: 'iam' })
      const g = 'data' in res ? (res as any).data?.getGuest : null
      if (!g) return
      setName(g.guestName || "")
      setEmail(g.email || "")         // ← 追加
      setAddress(g.address || "")     // ← 追加
      setPhone(g.phone || "")
      setOccupation(g.occupation || "") // ← 追加
      setNationality(g.nationality || "") // ← 追加
      setPassportImageUrl(g.passportImageUrl || null)
      // setCheckInDate(g.checkInDate ? new Date(g.checkInDate) : null)
      // setCheckOutDate(g.checkOutDate ? new Date(g.checkOutDate) : null)
      if (g.approvalStatus && g.approvalStatus !== 'waitingForPassportImage') {
        // setCurrentStep('upload')
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('loadMyGuest failed:', e)
    }
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
        passportImageUrl={passportImageUrl}
        setPassportImageUrl={setPassportImageUrl}
        handleNext={handleNext}
        handleBack={handleBack}
        handleRegister={handleRegister}
        isInfoComplete={isInfoComplete}
        message={message}
        client={client}
        guestSessions={guestSessions}
        selectedGuest={selectedGuest}
        onSelectGuest={setSelectedGuestId}
        onAddGuest={handleAddGuest}
      />
    </>
  )
}