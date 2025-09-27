import type { Guest } from '../types/types';
import { formatAddress } from '../utils/formatAddress';

type Props = {
  detail: Guest;
  onClose: () => void;
  signing: boolean;
  signedPassportUrl: string | null;
  approvingId: string | null;
  rejectingId: string | null;
  confirmApprove: (g: Guest) => void;
  confirmReject: (g: Guest) => void;
};

export function DetailsModal({
  detail,
  onClose,
  signing,
  signedPassportUrl,
  approvingId,
  rejectingId,
  confirmApprove,
  confirmReject
}: Props) {
  if (!detail) return null;

  const isApproved = (detail.approvalStatus || '').toLowerCase() === 'approved';
  const isRejected = (detail.approvalStatus || '').toLowerCase() === 'rejected';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
      onClick={onClose}
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
          <button onClick={onClose}>閉じる</button>
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
          <dt>住所</dt><dd>{formatAddress(detail.address) || '-'}</dd>
          <dt>職業</dt><dd>{detail.occupation || '-'}</dd>
          <dt>国籍</dt><dd>{detail.nationality || '-'}</dd>
          <dt>位置情報</dt><dd>{detail.currentLocation || '-'}</dd>
          <dt>ID画像</dt>
          <dd>
            {!detail.passportImageUrl && '-'}
            {detail.passportImageUrl && (
              <>
                <div style={{ marginBottom: 4 }}>
                  {signing
                    ? '画像URL取得中…'
                    : signedPassportUrl
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
            disabled={approvingId === detail.guestId || isApproved}
            onClick={() => confirmApprove(detail)}
          >
            {approvingId === detail.guestId ? '承認中…' : '承認'}
          </button>
          <button
            type="button"
            style={{
              backgroundColor: '#c62828',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 4,
              cursor: 'pointer'
            }}
            disabled={rejectingId === detail.guestId || isRejected}
            onClick={() => confirmReject(detail)}
          >
            {rejectingId === detail.guestId ? '拒否中…' : '拒否'}
          </button>
        </div>
      </div>
    </div>
  );
}