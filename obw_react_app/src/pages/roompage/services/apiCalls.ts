import { dbg } from '@/utils/debugLogger'
import type { Client } from 'aws-amplify/api'
import { getGuestIds, setGuestIds } from '../utils/guestIdsStorage'
import type { GuestSession } from '../types'

type Params = {
  client: Client
  roomId: string
  setGuestSessions: React.Dispatch<React.SetStateAction<GuestSession[]>>
}

export async function refreshGuestSessions({ client, roomId, setGuestSessions }: Params) {
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
          const res = await client.graphql({ query, variables: { roomNumber: roomId, guestId: gid }, authMode: 'iam' } as any)
          const g = 'data' in res ? (res as any).data?.getGuest : null
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
}

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