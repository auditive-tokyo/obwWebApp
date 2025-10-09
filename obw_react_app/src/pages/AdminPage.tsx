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
import { computeFilteredGuests } from './adminpage/utils/guestFilters';
import BulkChangeButton from './adminpage/components/BulkChangeButton';
import RoomTransferButton from './adminpage/components/RoomTransferButton';

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
  
  const [statusFilter, setStatusFilter] = useState<string[]>(['pending'])
  const [bookingFilter, setBookingFilter] = useState('')
  const [checkInFilter, setCheckInFilter] = useState('')
  const [detail, setDetail] = useState<Guest | null>(null)
  const [signedPassportUrl, setSignedPassportUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // clear bookingFilter when roomFilter changes
  useEffect(() => {
    setBookingFilter('');
    setCheckInFilter('');
  }, [roomFilter]);

  // フィルタリングロジック
  const filteredGuests = useMemo(() => {
    return computeFilteredGuests(all, {
      roomFilter, statusFilter, checkInFilter, bookingFilter
    });
  }, [all, roomFilter, statusFilter, checkInFilter, bookingFilter]);

  // 宿泊日変更ボタンがアクティブになれる条件
  const canBulk = Boolean(roomFilter && (checkInFilter || bookingFilter));

  // データ読み込み関数を作成
  const loadData = useCallback(async () => {
    await fetchGuests({ 
      client, 
      setAll, 
      setLoading, 
      setError,
      roomFilter: roomFilter || undefined,
      statusFilter: statusFilter || undefined
    });
  }, [roomFilter, statusFilter]);

  // 初回読み込みおよびフィルター変更時の自動更新
  useEffect(() => {
    loadData();
  }, [loadData]);

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
  }, [detail])

  // 承認前の確認ダイアログ
  const confirmApprove = async (g: Guest) => {
    await confirmApproveDialog(g, async () => {
      await approveGuest({
        client,
        guest: g,
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
      {/* タイトル/サマリー（中央寄せ） */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontWeight: 600 }}>表示中: {roomFilter ? `部屋${roomFilter}のみ` : '全部屋'} / {statusFilter || 'すべての状態'}</h3>
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 6 }}>Debug: roomFilter={roomFilter || 'empty'}, statusFilter={statusFilter || 'empty'}, roomId prop={roomId || 'none'}</div>
      </div>

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

        {/* 宿泊日変更ボタン：UI を分離したコンポーネントに置換 */}
        <BulkChangeButton
          canBulk={canBulk}
          bulkProcessing={bulkProcessing}
          title={'部屋を選択し、チェックイン日または予約IDを選択してください'}
          onClick={async () => {
            if (!canBulk) return;
            // prompt for new dates
            const newCheckIn = window.prompt('新しいチェックイン日を入力してください (YYYY-MM-DD)', '');
            if (!newCheckIn) return;
            const newCheckOut = window.prompt('新しいチェックアウト日を入力してください (YYYY-MM-DD)', '');
            if (!newCheckOut) return;

            // affected guests are those currently filtered
            const affected = filteredGuests;
            if (!affected || affected.length === 0) {
              alert('該当するゲストがいません。');
              return;
            }

            if (!confirm(`${affected.length} 件のゲストの宿泊日を ${newCheckIn} ～ ${newCheckOut} に変更します。よろしいですか？`)) return;

            setBulkProcessing(true);
            let success = 0;
            let fail = 0;

            for (const g of affected) {
              const updatedGuest: Guest = { ...g, checkInDate: newCheckIn, checkOutDate: newCheckOut };
              try {
                // call low-level updateGuest handler but suppress per-item alerts
                // we await each one to keep rate reasonable and preserve order
                 
                await updateGuest({
                  client,
                  guest: updatedGuest,
                  onSuccess: () => {
                    setAll(prev => prev.map(p => p.roomNumber === updatedGuest.roomNumber && p.guestId === updatedGuest.guestId ? updatedGuest : p));
                    if (detail && detail.roomNumber === updatedGuest.roomNumber && detail.guestId === updatedGuest.guestId) {
                      setDetail(updatedGuest);
                    }
                    success += 1;
                  },
                  onError: (err) => {
                    console.error('bulk update failed for', g, err);
                    fail += 1;
                  }
                });
              } catch (err) {
                console.error('bulk update exception', err);
                fail += 1;
              }
            }

            setBulkProcessing(false);
            alert(`完了: 成功 ${success} 件、失敗 ${fail} 件`);
          }}
        />

        {/* 部屋移動ボタン */}
        <RoomTransferButton
          canBulk={canBulk}
          bulkProcessing={bulkProcessing}
          title={'部屋を選択し、チェックイン日または予約IDを選択してください'}
          onClick={async () => {
            if (!canBulk) return;
            // TODO: 部屋移動の実装
            alert('部屋移動機能は開発中です');
          }}
        />
      </div>

      {/* status display moved above (in centered header) */}

      <GuestList
        guests={filteredGuests}
        loading={loading}
        error={error}
        
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
