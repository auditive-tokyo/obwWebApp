import { useEffect, useMemo, useState, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Guest } from './adminpage/types/types';
import { fetchPassportSignedUrl } from './handlers/fetchPassportSignedUrl';
import { rejectGuest } from './handlers/rejectGuest';
import { approveGuest } from './handlers/approveGuest';
import { confirmApproveDialog, confirmRejectDialog } from './adminpage/components/Dialogs';
import { fetchGuests } from './handlers/fetchGuests';
import { updateGuest } from './handlers/updateGuest';
import { DetailsModal } from './adminpage/components/detailsModal';
import GuestList from './adminpage/components/GuestList';
import FiltersBar from './adminpage/components/FiltersBar';

// AdminはUser Pool固定（ここで明示）
const client = generateClient({ authMode: 'userPool' })

// Props interface を追加
interface AdminPageProps {
  roomId?: string;
}

export default function AdminPage({ roomId }: AdminPageProps) {
  const [all, setAll] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // URL解析でroomIdを取得（propsを優先、フォールバックでURL解析）
  const [roomFilter, setRoomFilter] = useState(() => {
    // 1. Propsで渡された値を優先
    if (roomId) return roomId;
    
    // 2. フォールバック: URL解析（既存ロジック）
    const path = window.location.pathname;
    const match = path.match(/\/admin\/(\d+)$/);
    return match ? match[1] : ''; // 空文字 = フィルターなし
  });
  
  const [statusFilter, setStatusFilter] = useState('pending')
  const [bookingFilter, setBookingFilter] = useState('')
  const [checkInFilter, setCheckInFilter] = useState('')
  const [detail, setDetail] = useState<Guest | null>(null)
  const [signedPassportUrl, setSignedPassportUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // ... filters moved to FiltersBar component

  // clear bookingFilter when roomFilter changes
  useEffect(() => {
    setBookingFilter('');
    setCheckInFilter('');
  }, [roomFilter]);

  // フィルター UI moved into FiltersBar component

  // フィルタリングロジック（空文字 = フィルターなし）
  const filteredGuests = useMemo(() => {
    const sf = (statusFilter || '').toLowerCase()
    const base = all.filter(g => {
      const st = (g.approvalStatus || '').trim().toLowerCase()
      const statusOk = !sf || st === sf
      const roomOk = !roomFilter || g.roomNumber === roomFilter  // 空文字なら全部OK
      return statusOk && roomOk
    })

    // チェックイン日優先ソート（修正箇所）
    const sorted = [...base].sort((a, b) => {
      // チェックイン日を最優先に
      const aDate = a.checkInDate || '';
      const bDate = b.checkInDate || '';
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      
      // 同じチェックイン日なら予約ID → 氏名順
      const aId = a.bookingId || '';
      const bId = b.bookingId || '';
      if (aId !== bId) return aId.localeCompare(bId);
      return (a.guestName || '').localeCompare(b.guestName || '');
    });

    // チェックイン日で絞る（roomFilter が有効な場合のみ意味を持つ）
    let post = sorted;
    if (checkInFilter) {
      post = post.filter(g => (g.checkInDate || '') === checkInFilter);
    }

    // bookingFilter が設定されていればさらに絞る（roomFilter/チェックインフィルターが有効な場合のみ意味を持つ）
    if (bookingFilter) {
      return post.filter(g => (g.bookingId || '') === bookingFilter);
    }

    return post;
  }, [all, roomFilter, statusFilter, checkInFilter, bookingFilter])

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
    await confirmApproveDialog(g, async () => {
      await approveGuest({
        client,
        guest: g,
        detail,
        setAll,
        setDetail,
        setSignedPassportUrl,
        setApprovingId
      })
    })
  }

  // 拒否前の確認ダイアログ
  const confirmReject = async (g: Guest) => {
    await confirmRejectDialog(g, async () => {
      await rejectGuest({
        client,
        guest: g,
        detail,
        setAll,
        setDetail,
        setSignedPassportUrl,
        setRejectingId
      })
    })
  }

  // ゲスト情報更新ハンドラー
  const handleUpdateGuest = async (updatedGuest: Guest) => {
    await updateGuest({
      client,
      guest: updatedGuest,
      onSuccess: () => {
        // ローカル状態を更新
        setAll(prev => prev.map(g => 
          g.roomNumber === updatedGuest.roomNumber && g.guestId === updatedGuest.guestId
            ? updatedGuest
            : g
        ));
        
        // 詳細モーダルの表示も更新
        if (detail && detail.roomNumber === updatedGuest.roomNumber && detail.guestId === updatedGuest.guestId) {
          setDetail(updatedGuest);
        }
        
        alert('更新しました！');
      },
      onError: (error) => {
        console.error('Update failed:', error);
        alert('更新に失敗しました: ' + error.message);
      }
    });
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
        
        <FiltersBar
          all={all}
          roomFilter={roomFilter}
          setRoomFilter={setRoomFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          bookingFilter={bookingFilter}
          setBookingFilter={setBookingFilter}
          checkInFilter={checkInFilter}
          setCheckInFilter={setCheckInFilter}
        />
      </div>

      {/* 現在の状態表示を詳細に */}
      <div style={{ marginBottom: 12, fontSize: '0.9em', color: '#666' }}>
        表示中: {roomFilter ? `部屋${roomFilter}のみ` : '全部屋'} / {statusFilter || 'すべての状態'}
        <br />
        Debug: roomFilter={roomFilter || 'empty'}, statusFilter={statusFilter || 'empty'}, roomId prop={roomId || 'none'}
      </div>

      <GuestList
        guests={filteredGuests}
        loading={loading}
        error={error}
        roomFilter={roomFilter}
        statusFilter={statusFilter}
        roomId={roomId}
        setDetail={setDetail}
        approvingId={approvingId}
        rejectingId={rejectingId}
        confirmApprove={confirmApprove}
        confirmReject={confirmReject}
      />

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
          onUpdate={handleUpdateGuest}
        />
      )}
    </div>
  )
}
