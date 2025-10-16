import type { Guest } from '../types/types';

type Props = {
  guests: Guest[];
  loading: boolean;
  error: string | null;
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
  setDetail,
  approvingId,
  rejectingId,
  confirmApprove,
  confirmReject
}: Props) {
  return (
    <>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && guests.length === 0 && <p>該当するゲストはありません。</p>}

      <ul>
        {guests.map(g => (
          <li
            key={`${g.roomNumber}:${g.guestId}`}
            className={
              g.approvalStatus === 'approved'
                ? 'bg-green-100'
                : g.approvalStatus === 'rejected'
                ? 'bg-red-100'
                : g.approvalStatus === 'pending'
                ? 'bg-yellow-100'
                : g.approvalStatus === 'waitingForBasicInfo'
                ? 'bg-indigo-100'
                : 'bg-blue-100'
            }
            style={{ 
              marginBottom: 8, 
              display: 'flex', 
              alignItems: 'center', 
              padding: '12px',
              borderRadius: '8px'
            }}
          >
            <div style={{ flex: 1 }}>
              <strong>Room {g.roomNumber}</strong> — {g.guestName}
              {g.bookingId && <> ／ 予約ID: {g.bookingId}</>}
              {g.checkInDate && g.checkOutDate && <> ／ 滞在: {g.checkInDate} ~ {g.checkOutDate}</>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
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
