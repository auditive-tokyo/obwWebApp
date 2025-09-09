import { useEffect, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Guest, ApprovalStatus } from './adminpage/types/types';
import { fetchPassportSignedUrl } from './handlers/fetchPassportSignedUrl';
import { rejectGuest } from './handlers/rejectGuest';
import { approveGuest } from './handlers/approveGuest';
import { fetchGuests } from './handlers/fetchGuests';
import { DetailsModal } from './adminpage/components/detailsModal';

// AdminはUser Pool固定（ここで明示）
const client = generateClient({ authMode: 'userPool' })

export default function AdminPage() {
  const [all, setAll] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomFilter, setRoomFilter] = useState('201')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [detail, setDetail] = useState<Guest | null>(null)
  const [signedPassportUrl, setSignedPassportUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // ユニークな部屋番号のプルダウン候補（201がなければ補完）
  const roomOptions = useMemo(() => {
    const set = new Set<string>(all.map(g => g.roomNumber).filter(Boolean))
    if (!set.has('201')) set.add('201')
    return Array.from(set).sort()
  }, [all])

  const statusOptions: ApprovalStatus[] = [
    'pending',
    'waitingForBasicInfo',
    'waitingForPassportImage',
    'approved',
    'rejected'
  ];
  const filteredGuests = useMemo(() => {
    const sf = (statusFilter || '').toLowerCase()
    const base = all.filter(g => {
      const st = (g.approvalStatus || '').trim().toLowerCase()
      const statusOk = !sf || st === sf
      const roomOk = !roomFilter || g.roomNumber === roomFilter
      return statusOk && roomOk
    })

    // 予約IDでグループ化ソート
    return [...base].sort((a, b) => {
      const aId = a.bookingId || ''
      const bId = b.bookingId || ''
      if (aId === bId) {
        // 同じ予約ID内での並び（氏名 → guestId フォールバック）
        const nameCmp = (a.guestName || '').localeCompare(b.guestName || '')
        if (nameCmp !== 0) return nameCmp
        return (a.guestId || '').localeCompare(b.guestId || '')
      }
      // 予約IDありを先に
      if (aId && !bId) return -1
      if (!aId && bId) return 1
      return aId.localeCompare(bId)
    })
  }, [all, roomFilter, statusFilter])

  useEffect(() => {
    fetchGuests({ client, setAll, setLoading, setError });
  }, [client]);

  // ESCで閉じる
  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetail(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  // 詳細を開いたら署名URL取得
  useEffect(() => {
    if (detail?.passportImageUrl) {
      fetchPassportSignedUrl({
        client,
        guest: detail,
        setSignedPassportUrl,
        setSigning
      });
    } else {
      setSignedPassportUrl(null);
    }
  }, [detail, client])

  // 承認前の確認ダイアログ
  const confirmApprove = async (g: Guest) => {
    if (!g) return
    const ok = window.confirm(`${g.guestName} を承認します。よろしいですか？`)
    if (!ok) return
    await approveGuest({
      client,
      guest: g,
      detail,
      setAll,
      setDetail,
      setSignedPassportUrl,
      setApprovingId
    })
  }

  // 拒否前の確認ダイアログ
  const confirmReject = async (g: Guest) => {
    if (!g) return
    const ok = window.confirm(`${g.guestName} を拒否します。よろしいですか？`)
    if (!ok) return
    await rejectGuest({
      client,
      guest: g,
      detail,
      setAll,
      setDetail,
      setSignedPassportUrl,
      setRejectingId
    })
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>承認待ちリスト</h1>

      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => fetchGuests({ client, setAll, setLoading, setError })}
          disabled={loading}
        >
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
        <select
          style={{ marginLeft: 12 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {statusOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && filteredGuests.length === 0 && <p>該当するゲストはありません。</p>}

      <ul>
        {filteredGuests.map(g => (
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
                disabled={approvingId === g.guestId || rejectingId === g.guestId}
                onClick={() => confirmApprove(g)}
              >
                {approvingId === g.guestId ? '承認中…' : '承認'}
              </button>
             <button
               type="button"
               style={{
                 backgroundColor: '#c62828',
                 color: '#fff',
                 border: 'none',
                 padding: '6px 12px',
                 borderRadius: 4,
                 cursor: 'pointer'
               }}
               disabled={rejectingId === g.guestId || approvingId === g.guestId}
               onClick={() => confirmReject(g)}
             >
               {rejectingId === g.guestId ? '拒否中…' : '拒否'}
             </button>
            </div>
          </li>
        ))}
      </ul>

      {/* 詳細モーダル */}
      {detail && (
        <DetailsModal
          detail={detail}
            onClose={() => setDetail(null)}
            signing={signing}
            signedPassportUrl={signedPassportUrl}
            approvingId={approvingId}
            rejectingId={rejectingId}
            confirmApprove={confirmApprove}
            confirmReject={confirmReject}
        />
      )}
    </div>
  )
}
