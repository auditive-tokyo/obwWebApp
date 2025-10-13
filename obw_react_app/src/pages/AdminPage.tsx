import { generateClient } from 'aws-amplify/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BulkChangeButton from './adminpage/components/BulkChangeButton';
import { DetailsModal } from './adminpage/components/detailsModal';
import { confirmApproveDialog, confirmRejectDialog } from './adminpage/components/Dialogs';
import FiltersBar from './adminpage/components/FiltersBar';
import GuestList from './adminpage/components/GuestList';
import RoomTransferButton from './adminpage/components/RoomTransferButton';
import type { Guest } from './adminpage/types/types';
import { computeFilteredGuests } from './adminpage/utils/guestFilters';
import { BasicCheckInOutDate } from './components/BasicCheckInOutDate';
import { approveGuest } from './handlers/approveGuest';
import { fetchGuests } from './handlers/fetchGuests';
import { fetchPassportSignedUrl } from './handlers/fetchPassportSignedUrl';
import { rejectGuest } from './handlers/rejectGuest';
import { updateGuest } from './handlers/updateGuest';

// AdminはUser Pool固定（ここで明示）
const client = generateClient({ authMode: 'userPool' })

// Props interface を追加
interface AdminPageProps {
  roomId?: string;
  bookingFilter?: string | null;
}

export default function AdminPage({ roomId, bookingFilter: initialBookingFilter }: AdminPageProps) {
  const [all, setAll] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // URL解析でroomIdを取得（propsを優先、フォールバックでURL解析）
  const [roomFilter, setRoomFilter] = useState(() => {
    if (roomId) return roomId;
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'admin') {
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) return parts[1];
    }
    return '';
  });

  const [statusFilter, setStatusFilter] = useState<string[]>(['pending'])
  // bookingFilter は props の初期値を優先して設定。propsが無ければURLから解析。
  const [bookingFilter, setBookingFilter] = useState(() => {
    if (initialBookingFilter) return initialBookingFilter;
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    // /admin/:room/:booking  または  /admin/:booking
    if (parts[0] === 'admin') {
      if (parts.length >= 3 && parts[2]) return parts[2];
      if (parts.length === 2 && !/^\d+$/.test(parts[1])) return parts[1];
    }
    return '';
  })
  const [checkInFilter, setCheckInFilter] = useState('')
  const [detail, setDetail] = useState<Guest | null>(null)
  const [signedPassportUrl, setSignedPassportUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkCheckInDate, setBulkCheckInDate] = useState<Date | null>(null)
  const [bulkCheckOutDate, setBulkCheckOutDate] = useState<Date | null>(null)

  // フィルタリングロジック
  const filteredGuests = useMemo(() => {
    return computeFilteredGuests(all, {
      roomFilter, statusFilter, checkInFilter, bookingFilter
    });
  }, [all, roomFilter, statusFilter, checkInFilter, bookingFilter]);

  // 宿泊日変更ボタンがアクティブになれる条件
  const canBulk = Boolean(roomFilter && (checkInFilter || bookingFilter));
  const previewNewCheckIn = bulkCheckInDate ? bulkCheckInDate.toISOString().slice(0, 10) : ''
  const previewNewCheckOut = bulkCheckOutDate ? bulkCheckOutDate.toISOString().slice(0, 10) : ''
  const affectedCount = filteredGuests ? filteredGuests.length : 0

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
        <h3 style={{ margin: 0, fontWeight: 600 }}>表示中: {roomFilter ? `部屋${roomFilter}のみ` : '全部屋'} / {statusFilter && statusFilter.length ? statusFilter.join('') : 'すべての状態'}</h3>
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 6 }}>{`Debug: roomFilter=${roomFilter || 'empty'}, bookingFilter=${bookingFilter || 'empty'}, statusFilter=${(statusFilter && statusFilter.length) ? statusFilter.join('') : 'empty'}, NumberOfSelectedGuests=${filteredGuests ? filteredGuests.length : 0}`}</div>
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
          onClick={() => {
            if (!canBulk) return;
            // open modal to pick dates
            setBulkModalOpen(true)
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

        {/* Bulk change modal */}
        {bulkModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 mx-auto shadow-2xl" style={{ width: 'min(90%,680px)' }}>
              <h4 style={{ marginTop: 0 }}>宿泊日を一括変更</h4>
              <div style={{ marginBottom: 12 }}>
                <BasicCheckInOutDate
                  checkInDate={bulkCheckInDate}
                  setCheckInDate={setBulkCheckInDate}
                  checkOutDate={bulkCheckOutDate}
                  setCheckOutDate={setBulkCheckOutDate}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                {/* 確認文言をモーダル内に表示して1つのモーダルで完結させる */}
                <div style={{ marginBottom: 8 }}>
                  {affectedCount} 件のゲストの宿泊日を {previewNewCheckIn || '---'} ～ {previewNewCheckOut || '---'} に変更します。よろしいですか？
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => { setBulkModalOpen(false); setBulkCheckInDate(null); setBulkCheckOutDate(null); }}>
                  キャンセル
                </button>
                <button
                  onClick={async () => {
                    if (!bulkCheckInDate || !bulkCheckOutDate) return alert('チェックイン/チェックアウト日を選択してください');
                    const newCheckIn = bulkCheckInDate.toISOString().slice(0, 10)
                    const newCheckOut = bulkCheckOutDate.toISOString().slice(0, 10)
                    const affected = filteredGuests;
                    if (!affected || affected.length === 0) {
                      alert('該当するゲストがいません。');
                      return;
                    }

                    setBulkProcessing(true);
                    let success = 0;
                    let fail = 0;

                    for (const g of affected) {
                      const updatedGuest: Guest = { ...g, checkInDate: newCheckIn, checkOutDate: newCheckOut };
                      try {
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
                    setBulkModalOpen(false);
                    setBulkCheckInDate(null);
                    setBulkCheckOutDate(null);
                    alert(`完了: 成功 ${success} 件、失敗 ${fail} 件`);
                  }}
                  disabled={bulkProcessing}
                  style={{ backgroundColor: '#1976d2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}
                >
                  {bulkProcessing ? '処理中…' : '実行'}
                </button>
              </div>
            </div>
          </div>
        )}
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
