import { dbg } from '@/utils/debugLogger'
import type { Client } from 'aws-amplify/api'
import type { GuestSession } from '../types'

type Params = {
  client: Client
  roomId: string
  setGuestSessions: React.Dispatch<React.SetStateAction<GuestSession[]>>
}

export async function refreshGuestSessions({ client, roomId, setGuestSessions }: Params) {
  if (!roomId) { dbg('refreshGuestSessions: no roomId'); return }

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
        }
      }
    `
    const res = await client.graphql({ query, variables: { bookingId }, authMode: 'iam' } as any)
    const items = ('data' in res ? (res as any).data?.listGuestsByBooking : null) || []
    const list = (items || []).filter(Boolean) as GuestSession[]
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
      }
    }
  `
  try {
    dbg('loadMyGuest ->', { roomNumber: roomId, guestId: gid })
    const res = await client.graphql({ query, variables: { roomNumber: roomId, guestId: gid }, authMode: 'iam' } as any)
    const g = 'data' in res ? (res as any).data?.getGuest : null
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
  lat,
  lng,
  accuracy,
  ts,
  currentLocation
}: {
  client: any
  roomId: string
  guestId: string
  lat: number
  lng: number
  accuracy?: number
  ts: number
  currentLocation: string
}) {
  const mutation = /* GraphQL */ `
    mutation UpdateGuestLocation($input: UpdateGuestLocationInput!) {
      updateGuestLocation(input: $input) {
        roomNumber
        guestId
        lastLatitude
        lastLongitude
        lastLocationTs
        currentLocation
      }
    }
  `
  const input = {
    roomNumber: roomId,
    guestId,
    lastLatitude: lat,
    lastLongitude: lng,
    lastLocationTs: ts,
    accuracy,
    currentLocation
  }
  return client.graphql({ query: mutation, variables: { input }, authMode: 'userPool' })
}