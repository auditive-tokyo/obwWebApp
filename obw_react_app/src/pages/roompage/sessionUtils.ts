import { GuestSession } from "./types"

/**
 * 指定ルームに紐づく全ゲストセッションをlocalStorageから列挙
 */
export function listGuestSessionsByRoom(roomNumber: string): GuestSession[] {
  const list: GuestSession[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key.startsWith(`guest_${roomNumber}_`)) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const sess = JSON.parse(raw) as GuestSession
        list.push(sess)
      } catch {
        // 破損データはスキップ
      }
    }
  }
  return list.sort(
    (a, b) =>
      new Date(b.lastUpdated || '').getTime() - new Date(a.lastUpdated || '').getTime()
  )
}

// LocalStorage優先、fallbackでCookie
export const saveGuestSession = (data: GuestSession): void => {
  const key = `guest_${data.roomNumber}_${data.guestName}`
  const jsonData = JSON.stringify(data)
  
  try {
    // LocalStorage試行
    localStorage.setItem(key, jsonData)
  } catch (error) {
    // LocalStorage失敗時はCookieに保存
    console.warn('LocalStorage failed, using cookies:', error)
    setCookie(key, jsonData, 7) // 7日間有効
  }
}

export const loadGuestSession = (roomNumber: string, guestName: string): GuestSession | null => {
  const key = `guest_${roomNumber}_${guestName}`
  
  try {
    // LocalStorageから試行
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.warn('LocalStorage read failed:', error)
  }
  
  // fallbackでCookieから読み込み
  const cookieData = getCookie(key)
  return cookieData ? JSON.parse(cookieData) : null
}

// 復旧用：電話番号と日付での検索
export const recoverGuestSession = async (
  roomNumber: string, 
  phone: string, 
  date: string,
  client: any
): Promise<GuestSession | null> => {
  try {
    const query = `
      query ListGuestsByRoom($roomNumber: String!) {
        listGuestsByRoom(roomNumber: $roomNumber) {
          guestName
          phone
          approvalStatus
          createdAt
        }
      }
    `
    
    const res = await client.graphql({
      query,
      variables: { roomNumber },
      authMode: 'iam'
    })
    
    const matchedGuest = res.data.listGuestsByRoom.find((guest: any) =>
      guest.phone === phone && guest.createdAt.startsWith(date)
    )
    
    if (matchedGuest) {
      return {
        roomNumber,
        guestId: matchedGuest.id,
        guestName: matchedGuest.guestName,
        phone,
        registrationDate: date,
        approvalStatus: matchedGuest.approvalStatus,
        lastUpdated: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Session recovery failed:', error)
  }
  
  return null
}

// Cookie操作ヘルパー
const setCookie = (name: string, value: string, days: number): void => {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`
}

const getCookie = (name: string): string | null => {
  const nameEQ = name + "="
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length))
  }
  return null
}