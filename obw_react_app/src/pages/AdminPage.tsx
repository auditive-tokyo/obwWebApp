import { useEffect, useMemo, useState, useCallback } from 'react';
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
  
  // URL解析でroomIdを取得（フィルターなし = 空文字）
  const [roomFilter, setRoomFilter] = useState(() => {
    const path = window.location.pathname;
    const match = path.match(/\/admin\/(\d+)$/);
    return match ? match[1] : ''; // 空文字 = フィルターなし
  });
  
  const [statusFilter, setStatusFilter] = useState('pending')
  const [detail, setDetail] = useState<Guest | null>(null)
  const [signedPassportUrl, setSignedPassportUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // 部屋番号のプルダウン（シンプルに実際の部屋番号のみ）
  const roomOptions = useMemo(() => {
    const set = new Set<string>(all.map(g => g.roomNumber).filter(Boolean))
    
    // 2階〜8階の全部屋を追加（データがなくても選択可能にする）
    for (let floor = 2; floor <= 8; floor++) {
      for (let room = 1; room <= 4; room++) {
        const roomNumber = `${floor}${String(room).padStart(2, '0')}`;
        set.add(roomNumber);
      }
    }
    
    // 数値として正しくソート
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });
  }, [all])

  const statusOptions: (ApprovalStatus | '')[] = [
    '',  // フィルターなし を追加
    'pending',
    'waitingForBasicInfo', 
    'waitingForPassportImage',
    'approved',
    'rejected'
  ];
  // フィルタリングロジック（空文字 = フィルターなし）
  const filteredGuests = useMemo(() => {
    const sf = (statusFilter || '').toLowerCase()
    const base = all.filter(g => {
      const st = (g.approvalStatus || '').trim().toLowerCase()
      const statusOk = !sf || st === sf
      const roomOk = !roomFilter || g.roomNumber === roomFilter  // 空文字なら全部OK
      return statusOk && roomOk
    })

    // 予約IDでグループ化ソート
    return [...base].sort((a, b) => {
      const aId = a.bookingId || ''
      const bId = b.bookingId || ''
      if (aId === bId) {
        const nameCmp = (a.guestName || '').localeCompare(b.guestName || '')
        if (nameCmp !== 0) return nameCmp
        return (a.guestId || '').localeCompare(b.guestId || '')
      }
      if (aId && !bId) return -1
      if (!aId && bId) return 1
      return aId.localeCompare(bId)
    })
  }, [all, roomFilter, statusFilter])

  // データ読み込み関数を作成
  const loadData = useCallback(async () => {
    await fetchGuests({ 
      client, 
      setAll, 
      setLoading, 
      setError,
      roomFilter: roomFilter || undefined,  // 空文字をundefinedに変換
      statusFilter: statusFilter || undefined
    });
  }, [roomFilter, statusFilter, client]);

  // 初回読み込み
  useEffect(() => {
    loadData();
  }, [loadData]);

  // フィルター変更時にも自動更新
  useEffect(() => {
    loadData();
  }, [roomFilter, statusFilter]); // これを追加

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
          onClick={loadData}
          disabled={loading}
        >
          {loading ? '更新中…' : '更新'}
        </button>
        
        {/* 部屋フィルター */}
        <select
          style={{ marginLeft: 12 }}
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
        >
          <option value="">フィルターなし</option>
          {roomOptions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        
        {/* ステータスフィルター - フィルターなしを追加 */}
        <select
          style={{ marginLeft: 12 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">フィルターなし</option>
          {statusOptions.slice(1).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* 現在の状態表示を詳細に */}
      <div style={{ marginBottom: 12, fontSize: '0.9em', color: '#666' }}>
        表示中: {roomFilter ? `部屋${roomFilter}のみ` : '全部屋'} / {statusFilter || 'すべての状態'}
        <br />
        Debug: roomFilter={roomFilter || 'empty'}, statusFilter={statusFilter || 'empty'}
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
