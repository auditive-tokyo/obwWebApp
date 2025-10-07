import { dbg } from '@/utils/debugLogger'
import type { Client } from 'aws-amplify/api'
import type { GuestSession } from '../types'

// Use the actual parameter type expected by Client.graphql to avoid mismatches
type GraphParams = Parameters<Client['graphql']>[0]

// Minimal helper to type GraphQL responses without using `any`.
type GraphqlResponse<T = unknown> = { data?: T }

type Params = {
  client: Client
  roomId: string
  setGuestSessions?: (sessions: GuestSession[]) => void
}

export async function refreshGuestSessions({ client, roomId, setGuestSessions }: Params) {
  if (!roomId) { dbg('refreshGuestSessions: no roomId'); return }
  if (!setGuestSessions) { dbg('refreshGuestSessions: no setGuestSessions'); return }

  const bookingId = typeof window !== 'undefined' ? localStorage.getItem('bookingId') : null
  if (!bookingId) {
    dbg('refreshGuestSessions: no bookingId -> set empty list')
    setGuestSessions([])
    return
  }

  dbg('refreshGuestSessions via bookingId:', { roomId, bookingId })

  try {
    const query = `
      query ListGuestsByBooking($bookingId: String!) {
        listGuestsByBooking(bookingId: $bookingId) {
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
          bookingId
          isFamilyMember
          currentLocation
        }
      }
    `
  const res = await client.graphql({ query, variables: { bookingId }, authMode: 'iam' } as GraphParams)
  const resObj = res as unknown as GraphqlResponse<{ listGuestsByBooking?: unknown }>
    const itemsRaw = resObj.data?.listGuestsByBooking ?? []
    const items = Array.isArray(itemsRaw) ? itemsRaw : []
    const list = items.filter(Boolean).map(i => i as unknown as GuestSession)
    dbg('setGuestSessions via bookingId length =', list.length)
    setGuestSessions(list)
  } catch (e) {
    console.error('load room sessions failed:', e)
    setGuestSessions([])
  }
}

// 以下はそのまま（単体詳細取得）
type GuestDetail = {
  guestName?: string
  email?: string
  address?: string
  phone?: string
  occupation?: string
  nationality?: string
  approvalStatus?: string
  checkInDate?: string
  checkOutDate?: string
  passportImageUrl?: string | null
  isFamilyMember?: boolean
  currentLocation?: string
}

export async function loadMyGuest({ client, roomId }: { client: Client; roomId: string }): Promise<GuestDetail | null> {
  if (!roomId) return null
  const gid = typeof window !== 'undefined' ? localStorage.getItem('guestId') : null
  if (!gid) return null

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
        isFamilyMember
        currentLocation
      }
    }
  `
  try {
    dbg('loadMyGuest ->', { roomNumber: roomId, guestId: gid })
  const res = await client.graphql({ query, variables: { roomNumber: roomId, guestId: gid }, authMode: 'iam' } as GraphParams)
  const resObj = res as unknown as GraphqlResponse<{ getGuest?: unknown }>
    const g = resObj.data?.getGuest as unknown as GuestDetail | null
    dbg('loadMyGuest result ->', g ? { name: g.guestName, status: g.approvalStatus } : null)
    return g || null
  } catch (e) {
    console.error('loadMyGuest failed:', e)
    return null
  }
}

export async function saveGuestLocation({
  client,
  roomId,
  guestId,
  currentLocation
}: {
  client: Client
  roomId: string
  guestId: string
  currentLocation: string
}) {
  const mutation = /* GraphQL */ `
    mutation UpdateGuest($input: UpdateGuestInput!) {
      updateGuest(input: $input) {
        roomNumber
        guestId
        currentLocation
      }
    }
  `
  const input = {
    roomNumber: roomId,
    guestId,
    currentLocation
  }
  return client.graphql({ query: mutation, variables: { input } } as GraphParams)
}

export async function deleteGuestLocation({
  client,
  roomId,
  guestId
}: {
  client: Client
  roomId: string
  guestId: string
}) {
  dbg('[deleteGuestLocation] 開始:', { roomId, guestId })
  
  const mutation = /* GraphQL */ `
    mutation UpdateGuest($input: UpdateGuestInput!) {
      updateGuest(input: $input) {
        roomNumber
        guestId
        currentLocation
      }
    }
  `
  const input = {
    roomNumber: roomId,
    guestId,
    currentLocation: null // 位置情報を削除
  }
  
  dbg('[deleteGuestLocation] 送信データ:', input)
  
  try {
  const result = await client.graphql({ query: mutation, variables: { input } } as GraphParams)
    dbg('[deleteGuestLocation] GraphQL レスポンス:', result)
    return result
  } catch (error) {
    console.error('[deleteGuestLocation] GraphQL エラー:', error)
    throw error
  }
}

// 部屋の全ゲストのチェックイン・チェックアウト日を更新
export async function updateRoomCheckDates({
  client,
  bookingId,
  checkInDate,
  checkOutDate
}: {
  client: Client
  bookingId: string
  checkInDate: string
  checkOutDate: string
}) {
  dbg('[updateRoomCheckDates] 開始:', { bookingId, checkInDate, checkOutDate })
  
  try {
    // 1. まず対象のゲスト一覧を取得
    const query = `
      query ListGuestsByBooking($bookingId: String!) {
        listGuestsByBooking(bookingId: $bookingId) {
          roomNumber
          guestId
          guestName
        }
      }
    `
    
    const guestsResult = await client.graphql({ 
      query, 
      variables: { bookingId },
      authMode: 'iam'
    } as GraphParams)
    const guestsResObj = guestsResult as unknown as GraphqlResponse<{ listGuestsByBooking?: unknown }>
    const guestsRaw = guestsResObj.data?.listGuestsByBooking ?? []
    const guests = Array.isArray(guestsRaw) ? guestsRaw.map(g => g as unknown as GuestSession) : []
    dbg('[updateRoomCheckDates] 対象ゲスト:', guests.length)
    
    if (guests.length === 0) {
      throw new Error('対象のゲストが見つかりません')
    }
    
    // 2. 各ゲストの日付を更新
    const updateMutation = `
      mutation UpdateGuest($input: UpdateGuestInput!) {
        updateGuest(input: $input) {
          roomNumber
          guestId
          checkInDate
          checkOutDate
        }
      }
    `
    
    const updatePromises = guests.map(async (guest: GuestSession) => {
      const input = {
        roomNumber: guest.roomNumber,
        guestId: guest.guestId,
        checkInDate,
        checkOutDate
      }
      
      return client.graphql({
        query: updateMutation,
        variables: { input },
        authMode: 'iam'
      } as GraphParams)
    })
    
    // 3. 全て並行実行
    const results = await Promise.all(updatePromises)
    
    dbg('[updateRoomCheckDates] 更新完了:', results.length)
    
    return {
      success: true,
      message: `${results.length}人のゲストの日付を更新しました`,
      updatedCount: results.length
    }
    
  } catch (error) {
    console.error('[updateRoomCheckDates] エラー:', error)
    throw error
  }
}