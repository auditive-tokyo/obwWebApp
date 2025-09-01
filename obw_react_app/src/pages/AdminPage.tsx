import { useEffect, useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'
import { dbg } from '@/utils/debugLogger'

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
  address?: string
  occupation?: string
  nationality?: string
  passportImageUrl?: string
}

// AdminはUser Pool固定（ここで明示）
const client = generateClient({ authMode: 'userPool' })

export default function AdminPage() {
  const [all, setAll] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomFilter, setRoomFilter] = useState('201')
  const [detail, setDetail] = useState<Guest | null>(null)
  const [signedPassportUrl, setSignedPassportUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // ユニークな部屋番号のプルダウン候補（201がなければ補完）
  const roomOptions = useMemo(() => {
    const set = new Set<string>(all.map(g => g.roomNumber).filter(Boolean))
    if (!set.has('201')) set.add('201')
    return Array.from(set).sort()
  }, [all])

  const pending = useMemo(
    () => all.filter(g =>
      (g.approvalStatus || '').trim().toLowerCase() === 'pending' &&
      (!roomFilter || g.roomNumber === roomFilter)
    ),
    [all, roomFilter]
  )

  const fetchGuests = async () => {
    dbg('fetchGuests start')
    setLoading(true); setError(null)
    try {
      await getCurrentUser()
        .then(u => dbg('current user OK:', u))
        .catch(e => { dbg('getCurrentUser failed:', e); throw e })

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
            address
            occupation
            nationality
            passportImageUrl
          }
        }
      `
      dbg('calling listGuests (userPool)')
      // authModeはクライアント側に固定済み
      const res = await client.graphql({ query } as any)
      const payload: any = 'data' in res ? (res as any).data?.listGuests : null
      const items: any[] = Array.isArray(payload) ? payload : []
      dbg('listGuests payload:', payload)
      dbg('items length:', items?.length)
      setAll((items || []).filter(Boolean))
    } catch (e: any) {
      console.error('[AdminPage] listGuests failed:', e)
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
      dbg('fetchGuests end')
    }
  }

  useEffect(() => { fetchGuests() }, [])

  // ESCで閉じる
  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetail(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  // 詳細を開いたら署名URLを取得
  useEffect(() => {
    if (detail?.passportImageUrl) {
      fetchPassportSignedUrl(detail)
    } else {
      setSignedPassportUrl(null)
    }
  }, [detail])

  // passportImageUrl から S3キーを取り出す（https://{bucket}.s3.amazonaws.com/<key> 想定）
  const extractS3Key = (url: string) => {
    try {
      const u = new URL(url)
      return decodeURIComponent(u.pathname.replace(/^\/+/, '')) // 先頭の/除去
    } catch { return null }
  }

  // 署名URLを取得（既存の get_presigned_url Lambda を AppSync で呼ぶ想定）
  const fetchPassportSignedUrl = async (g: Guest) => {
    if (!g.passportImageUrl) { setSignedPassportUrl(null); return }
    const key = extractS3Key(g.passportImageUrl)
    if (!key) { setSignedPassportUrl(null); return }
    // 例: key = roomId/timestamp/filename
    const [roomId, timestamp, ...rest] = key.split('/')
    const filename = rest.join('/')
    if (!roomId || !timestamp || !filename) { setSignedPassportUrl(null); return }
    setSigning(true)
    try {
      const query = `
        mutation GetPresignedUrl($input: GetPresignedUrlInput!) {
          getPresignedUrl(input: $input) {
            getUrl
          }
        }
      `
      const res = await client.graphql({
        query,
        variables: { input: { roomId, timestamp, filename } }
      } as any)
      const url = (res as any)?.data?.getPresignedUrl?.getUrl || null
      setSignedPassportUrl(url)
    } catch (e) {
      console.warn('[AdminPage] fetchPassportSignedUrl failed', e)
      setSignedPassportUrl(null)
    } finally {
      setSigning(false)
    }
  }

  // 承認処理（approvalStatus を 'approved' に更新）
  const approveGuest = async (g: Guest) => {
    if (!g) return
    setApprovingId(g.guestId)
    try {
      const mutation = `
        mutation UpdateGuest($input: UpdateGuestInput!) {
          updateGuest(input: $input) {
            guestId
            approvalStatus
          }
        }
      `
      await client.graphql({
        query: mutation,
        variables: {
          input: {
            guestId: g.guestId,
            roomNumber: g.roomNumber,
            approvalStatus: 'approved',
          },
        },
      } as any)
      // 楽観更新
      setAll(prev => prev.map(x => x.guestId === g.guestId ? { ...x, approvalStatus: 'approved' } : x))
      if (detail?.guestId === g.guestId) setDetail({ ...detail, approvalStatus: 'approved' })
    } catch (e) {
      console.error('[AdminPage] approveGuest failed:', e)
      alert('承認に失敗しました')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>承認待ちリスト</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={fetchGuests} disabled={loading}>
          {loading ? '更新中…' : '更新'}
        </button>
        <select
          style={{ marginLeft: 12 }}
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
        >
          {roomOptions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && pending.length === 0 && <p>承認待ちはありません。</p>}

      <ul>
        {pending.map(g => (
          <li
            key={`${g.roomNumber}:${g.guestId}`}
            style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}
          >
            <strong>Room {g.roomNumber}</strong> — {g.guestName}
            {g.bookingId && <> ／ 予約ID: {g.bookingId}</>}
            {g.checkInDate && g.checkOutDate && <> ／ 滞在: {g.checkInDate} ~ {g.checkOutDate}</>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                type="button"
                style={{
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
                onClick={() => setDetail(g)}
              >
                詳細
              </button>
              <button
                type="button"
                style={{
                  backgroundColor: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
                disabled={approvingId === g.guestId}
                onClick={() => approveGuest(g)}
              >
                {approvingId === g.guestId ? '承認中…' : '承認'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* 詳細モーダル */}
      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 8,
              width: 'min(720px, 90vw)',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
             onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>ゲスト詳細</h2>
              <button onClick={() => setDetail(null)}>閉じる</button>
            </div>
            <hr />
            <dl style={{ display: 'grid', gridTemplateColumns: '8em 1fr', rowGap: 6, columnGap: 12 }}>
              <dt>Room</dt><dd>{detail.roomNumber}</dd>
              <dt>氏名</dt><dd>{detail.guestName}</dd>
              <dt>Guest ID</dt><dd>{detail.guestId}</dd>
              <dt>予約ID</dt><dd>{detail.bookingId || '-'}</dd>
              <dt>承認</dt><dd>{detail.approvalStatus || '-'}</dd>
              <dt>チェックイン</dt><dd>{detail.checkInDate || '-'}</dd>
              <dt>チェックアウト</dt><dd>{detail.checkOutDate || '-'}</dd>
              <dt>メール</dt><dd>{detail.email || '-'}</dd>
              <dt>電話</dt><dd>{detail.phone || '-'}</dd>
              <dt>住所</dt><dd>{detail.address || '-'}</dd>
              <dt>職業</dt><dd>{detail.occupation || '-'}</dd>
              <dt>国籍</dt><dd>{detail.nationality || '-'}</dd>
              <dt>パスポート</dt>
              <dd>
                {!detail.passportImageUrl && '-' }
                {detail.passportImageUrl && (
                  <>
                    <div style={{ marginBottom: 4 }}>
                      {signing ? '画像URL取得中…' : signedPassportUrl
                        ? <a href={signedPassportUrl} target="_blank" rel="noreferrer">署名付きURLで開く</a>
                        : '画像URLの取得に失敗しました'}
                    </div>
                    {signedPassportUrl && (
                      <div style={{ marginTop: 8 }}>
                        <img
                          src={signedPassportUrl}
                          alt="passport"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            maxHeight: '70vh',
                            objectFit: 'contain',
                            border: '1px solid #ddd',
                            borderRadius: 4
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </dd>
            </dl>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                style={{
                  backgroundColor: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
                disabled={approvingId === detail.guestId || (detail.approvalStatus || '').toLowerCase() === 'approved'}
                onClick={() => approveGuest(detail)}
              >
                {approvingId === detail.guestId ? '承認中…' : '承認'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
