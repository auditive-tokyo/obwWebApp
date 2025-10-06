interface Props {
  canBulk: boolean;
  bulkProcessing: boolean;
  onClick: (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void | Promise<void>;
  title?: string;
}

export default function BulkChangeButton({ canBulk, bulkProcessing, onClick, title }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={!canBulk || bulkProcessing}
      title={!canBulk ? title ?? '部屋を選択し、チェックイン日または予約IDを選択してください' : ''}
      style={{
        marginLeft: 12,
        backgroundColor: '#ffb300',
        color: '#000',
        border: 'none',
        padding: '6px 12px',
        borderRadius: 4,
        cursor: (!canBulk || bulkProcessing) ? 'not-allowed' : 'pointer',
        opacity: (!canBulk || bulkProcessing) ? 0.5 : 1
      }}
    >
      {bulkProcessing ? '処理中…' : '宿泊日変更'}
    </button>
  );
}
