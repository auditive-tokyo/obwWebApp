import type { Guest } from '../types/types';

type Props = {
  guests: Guest[];
  loading: boolean;
  error: string | null;
  roomFilter: string;
  statusFilter: string;
  roomId?: string;
  setDetail: (g: Guest) => void;
  approvingId: string | null;
  rejectingId: string | null;
  confirmApprove: (g: Guest) => Promise<void> | void;
  confirmReject: (g: Guest) => Promise<void> | void;
};

export function GuestList({
  guests,
  loading,
  error,
  roomFilter,
  statusFilter,
  roomId,
  setDetail,
  approvingId,
  rejectingId,
  confirmApprove,
  confirmReject
}: Props) {
  return (
    <>
      {/* 現在の状態表示を詳細に */}
      <div style={{ marginBottom: 12, fontSize: '0.9em', color: '#666' }}>
        表示中: {roomFilter ? `部屋${roomFilter}のみ` : '全部屋'} / {statusFilter || 'すべての状態'}
        <br />
        Debug: roomFilter={roomFilter || 'empty'}, statusFilter={statusFilter || 'empty'}, roomId prop={roomId || 'none'}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && guests.length === 0 && <p>該当するゲストはありません。</p>}

      <ul>
        {guests.map(g => (
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
    </>
  );
}

export default GuestList;
