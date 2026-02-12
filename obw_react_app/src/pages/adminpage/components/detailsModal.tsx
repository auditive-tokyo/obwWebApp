import { useState, useEffect, useMemo } from 'react';
import BasicInfoForm from '@/pages/components/BasicInfoForm';
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
  onUpdate: (updatedGuest: Guest) => Promise<void>;
};

export function DetailsModal({
  detail,
  onClose,
  signing,
  signedPassportUrl,
  approvingId,
  rejectingId,
  confirmApprove,
  confirmReject,
  onUpdate
}: Props) {

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // BasicInfoForm用の個別state
  const [editName, setEditName] = useState(detail.guestName);
  const [editEmail, setEditEmail] = useState(detail.email || '');
  const [editAddress, setEditAddress] = useState(detail.address || '');
  const [editPhone, setEditPhone] = useState(detail.phone || '');
  const [editOccupation, setEditOccupation] = useState(detail.occupation || '');
  const [editNationality, setEditNationality] = useState(detail.nationality || '');
  const [editPromoConsent, setEditPromoConsent] = useState(false);
  
  // チェックイン・アウト日は表示のみ（編集不可）
  const [editCheckInDate] = useState<Date | null>(
    detail.checkInDate ? new Date(detail.checkInDate) : null
  );
  const [editCheckOutDate] = useState<Date | null>(
    detail.checkOutDate ? new Date(detail.checkOutDate) : null
  );

  // If detail prop changes (opening modal for different guest), sync all edit states
  useEffect(() => {
    setEditName(detail.guestName);
    setEditEmail(detail.email || '');
    setEditAddress(detail.address || '');
    setEditPhone(detail.phone || '');
    setEditOccupation(detail.occupation || '');
    setEditNationality(detail.nationality || '');
  }, [detail]);

  // 編集中のデータが完全かチェック
  const isEditInfoComplete = useMemo(() => {
    return !!(
      editName.trim() &&
      editEmail.trim() &&
      editAddress.trim() &&
      editPhone.trim() &&
      editOccupation.trim() &&
      editNationality.trim()
    );
  }, [editName, editEmail, editAddress, editPhone, editOccupation, editNationality]);

  const isApproved = (detail.approvalStatus || '').toLowerCase() === 'approved';
  const isRejected = (detail.approvalStatus || '').toLowerCase() === 'rejected';

  const handleSave = async () => {
    setSaving(true);
    try {
      // 編集stateからeditDataを構築
      const updatedGuest: Guest = {
        ...detail,
        guestName: editName,
        email: editEmail,
        address: editAddress,
        phone: editPhone,
        occupation: editOccupation,
        nationality: editNationality,
      };

      await onUpdate(updatedGuest);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // 編集中の値を元に戻す
    setEditName(detail.guestName);
    setEditEmail(detail.email || '');
    setEditAddress(detail.address || '');
    setEditPhone(detail.phone || '');
    setEditOccupation(detail.occupation || '');
    setEditNationality(detail.nationality || '');
    setIsEditing(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 8,
          width: 'min(720px, 90vw)',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>ゲスト詳細 {isEditing && '（編集中）'}</h2>
          <button onClick={onClose}>閉じる</button>
        </div>
        <hr />
        
        {isEditing ? (
          /* 編集モード: BasicInfoFormを使用 */
          <div style={{ marginBottom: 16 }}>
            <BasicInfoForm
              name={editName}
              setName={setEditName}
              email={editEmail}
              setEmail={setEditEmail}
              address={editAddress}
              setAddress={setEditAddress}
              phone={editPhone}
              setPhone={setEditPhone}
              occupation={editOccupation}
              setOccupation={setEditOccupation}
              nationality={editNationality}
              setNationality={setEditNationality}
              checkInDate={editCheckInDate}
              setCheckInDate={() => {}} // 編集不可（読み取り専用）
              checkOutDate={editCheckOutDate}
              setCheckOutDate={() => {}} // 編集不可（読み取り専用）
              promoConsent={editPromoConsent}
              setPromoConsent={setEditPromoConsent}
              isInfoComplete={isEditInfoComplete}
              onNext={handleSave} // 「次へ」ボタンを「保存」として使用
              isRepresentativeFamily={false}
              hasRoomCheckDates={true} // チェックイン・アウト日は表示しない
              isAdmin={true} // Admin編集モード：必須チェックをスキップ
            />
          </div>
        ) : (
          /* 閲覧モード: 従来の表示 */
          <dl style={{ display: 'grid', gridTemplateColumns: '8em 1fr', rowGap: 6, columnGap: 12 }}>
            <dt>Room</dt><dd>{detail.roomNumber}</dd>
            <dt>Guest ID</dt><dd>{detail.guestId}</dd>
            <dt>氏名</dt><dd>{detail.guestName}</dd>
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
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          {isEditing ? (
            /* 編集モード時はキャンセルボタンのみ（保存はBasicInfoFormの「次へ」ボタンが担当） */
            <button
              type="button"
              style={{
                backgroundColor: '#757575',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 4,
                cursor: 'pointer'
              }}
              disabled={saving}
              onClick={handleCancel}
            >
              キャンセル
            </button>
          ) : (
            <>
              <button
                type="button"
                style={{
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                  color: '#1565c0',
                  border: '1px solid #90caf9',
                  padding: '8px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
                onClick={() => setIsEditing(true)}
              >
                編集
              </button>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}