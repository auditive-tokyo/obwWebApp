import { useEffect, useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'

type Guest = {
  roomNumber: string
  guestId: string
  guestName: string
  approvalStatus: string
  checkInDate?: string
  checkOutDate?: string
  bookingId?: string
  email?: string
  phone?: string
}

// AdminはUser Pool固定（ここで明示）
const client = generateClient({ authMode: 'userPool' })

export default function AdminPage() {
  const [all, setAll] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomFilter, setRoomFilter] = useState('')

  const pending = useMemo(
    () => all.filter(g =>
      (g.approvalStatus || '').trim().toLowerCase() === 'pending' &&
      (!roomFilter || g.roomNumber === roomFilter)
    ),
    [all, roomFilter]
  )

  const fetchGuests = async () => {
    console.log('[AdminPage] fetchGuests start')
    setLoading(true); setError(null)
    try {
      await getCurrentUser()
        .then(u => console.log('[AdminPage] current user OK:', u))
        .catch(e => { console.error('[AdminPage] getCurrentUser failed:', e); throw e })

      const query = `
        query ListGuests {
          listGuests {
            roomNumber
            guestId
            guestName
            approvalStatus
            checkInDate
            checkOutDate
            bookingId
            email
            phone
          }
        }
      `
      console.log('[AdminPage] calling listGuests (userPool)')
      // authModeはクライアント側に固定済み
      const res = await client.graphql({ query } as any)
      const payload: any = 'data' in res ? (res as any).data?.listGuests : null
      const items: any[] = Array.isArray(payload) ? payload : []
      console.log('[AdminPage] listGuests payload:', payload)
      console.log('[AdminPage] items length:', items?.length)
      setAll((items || []).filter(Boolean))
    } catch (e: any) {
      console.error('[AdminPage] listGuests failed:', e)
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
      console.log('[AdminPage] fetchGuests end')
    }
  }

  useEffect(() => { fetchGuests() }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>承認待ちリスト</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={fetchGuests} disabled={loading}>
          {loading ? '更新中…' : '更新'}
        </button>
        <input
          style={{ marginLeft: 12 }}
          placeholder="Room番号で絞り込み（任意）"
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value.trim())}
        />
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && pending.length === 0 && <p>承認待ちはありません。</p>}

      <ul>
        {pending.map(g => (
          <li key={`${g.roomNumber}:${g.guestId}`} style={{ marginBottom: 8 }}>
            <strong>Room {g.roomNumber}</strong> — {g.guestName} ({g.guestId})
            {g.checkInDate && g.checkOutDate && <> ／ 滞在: {g.checkInDate} ~ {g.checkOutDate}</>}
          </li>
        ))}
      </ul>
    </div>
  )
}
