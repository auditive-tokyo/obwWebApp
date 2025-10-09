interface Props {
  canBulk: boolean;
  bulkProcessing: boolean;
  onClick: (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void | Promise<void>;
  title?: string;
}

export default function RoomTransferButton({ canBulk, bulkProcessing, onClick, title }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={!canBulk || bulkProcessing}
      title={!canBulk ? title ?? '部屋を選択し、チェックイン日または予約IDを選択してください' : ''}
      style={{
        marginLeft: 12,
        backgroundColor: '#ff6f00',
        color: '#fff',
        border: 'none',
        padding: '6px 12px',
        borderRadius: 4,
        cursor: (!canBulk || bulkProcessing) ? 'not-allowed' : 'pointer',
        opacity: (!canBulk || bulkProcessing) ? 0.5 : 1
      }}
    >
      {bulkProcessing ? '移動中…' : '部屋移動'}
    </button>
  );
}
