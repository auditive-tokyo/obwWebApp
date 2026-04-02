import { generateClient } from "aws-amplify/api";
import { useState } from "react";
import { transferRoomGuests } from "../../handlers/transferRoomGuests";

const client = generateClient({ authMode: "userPool" });

function getTransferErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "不明なエラー";
}

interface RoomTransferModalProps {
  roomFilter: string;
  affectedCount: number;
  roomOptions: string[];
  bulkProcessing: boolean;
  setBulkProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  bookingFilter: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RoomTransferModal({
  roomFilter,
  affectedCount,
  roomOptions,
  bulkProcessing,
  setBulkProcessing,
  bookingFilter,
  onClose,
  onSuccess,
}: Readonly<RoomTransferModalProps>) {
  const [transferTargetRoom, setTransferTargetRoom] = useState("");
  const bulkButtonText = bulkProcessing ? "処理中…" : "実行";

  const handleClose = () => {
    setTransferTargetRoom("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-lg p-6 mx-auto shadow-2xl"
        style={{ width: "min(90%,480px)" }}
      >
        <h4 style={{ marginTop: 0 }}>部屋移動</h4>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8, color: "#666" }}>
            現在の部屋: <strong>{roomFilter}</strong>
            <br />
            対象ゲスト数: <strong>{affectedCount}件</strong>
          </div>
          <label
            style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
          >
            <div style={{ marginBottom: 4 }}>移動先の部屋番号:</div>
            <select
              value={transferTargetRoom}
              onChange={(e) => setTransferTargetRoom(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px",
                display: "block",
              }}
            >
              <option value="">選択してください</option>
              {roomOptions
                .filter((r) => r !== roomFilter)
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {transferTargetRoom && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              backgroundColor: "#f0f9ff",
              borderRadius: 4,
              border: "1px solid #bae6fd",
            }}
          >
            <strong>{affectedCount}件</strong>のゲストを
            <br />
            部屋 <strong>{roomFilter}</strong> から 部屋{" "}
            <strong>{transferTargetRoom}</strong> に移動します。
          </div>
        )}
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
        >
          <button onClick={handleClose}>キャンセル</button>
          <button
            onClick={async () => {
              if (!transferTargetRoom) {
                alert("移動先の部屋番号を選択してください");
                return;
              }

              const confirmed = confirm(
                `${affectedCount}件のゲストを\n` +
                  `部屋 ${roomFilter} から 部屋 ${transferTargetRoom} に移動します。\n\n` +
                  `よろしいですか？`,
              );

              if (!confirmed) return;

              setBulkProcessing(true);
              try {
                const bookingIds = bookingFilter
                  ? [bookingFilter]
                  : undefined;

                await transferRoomGuests({
                  client,
                  oldRoomNumber: roomFilter,
                  newRoomNumber: transferTargetRoom,
                  bookingIds,
                  onSuccess: (result) => {
                    handleClose();
                    alert(
                      `✅ 部屋移動完了\n\n` +
                        `${result.transferredCount}件のゲストを移動しました。\n` +
                        `部屋 ${roomFilter} → 部屋 ${transferTargetRoom}`,
                    );
                    onSuccess();
                  },
                  onError: (error) => {
                    alert(`❌ 部屋移動に失敗しました\n\n${error.message}`);
                  },
                });
              } catch (error) {
                console.error("部屋移動エラー:", error);
                alert(
                  `❌ 部屋移動に失敗しました\n\n${getTransferErrorMessage(error)}`,
                );
              } finally {
                setBulkProcessing(false);
              }
            }}
            disabled={!transferTargetRoom || bulkProcessing}
            style={{
              backgroundColor:
                transferTargetRoom && !bulkProcessing ? "#1976d2" : "#ccc",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 4,
              cursor:
                transferTargetRoom && !bulkProcessing
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {bulkButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
