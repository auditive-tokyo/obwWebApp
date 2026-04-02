import { generateClient } from "aws-amplify/api";
import { useState } from "react";
import { BasicCheckInOutDate } from "../../components/BasicCheckInOutDate";
import { updateGuest } from "../../handlers/updateGuest";
import type { Guest } from "../types/types";

const client = generateClient({ authMode: "userPool" });

// checkOutDate (YYYY-MM-DD) から sessionTokenExpiresAt (Unix epoch秒) を計算
// チェックアウト日の日本時間正午（12:00 JST = 03:00 UTC）に設定
const calculateSessionExpiry = (checkOutDate: string): number => {
  const checkOut = new Date(checkOutDate);
  checkOut.setUTCHours(3, 0, 0, 0);
  return Math.floor(checkOut.getTime() / 1000);
};

interface BulkUpdateResult {
  success: number;
  fail: number;
}

async function executeBulkDateChange(
  affected: Guest[],
  newCheckIn: string,
  newCheckOut: string,
  setAll: React.Dispatch<React.SetStateAction<Guest[]>>,
  detail: Guest | null,
  setDetail: React.Dispatch<React.SetStateAction<Guest | null>>,
): Promise<BulkUpdateResult> {
  let success = 0;
  let fail = 0;

  for (const g of affected) {
    const sessionTokenExpiresAt = calculateSessionExpiry(newCheckOut);
    const updatedGuest: Guest = {
      ...g,
      checkInDate: newCheckIn,
      checkOutDate: newCheckOut,
      sessionTokenExpiresAt,
    };
    try {
      await updateGuest({
        client,
        guest: updatedGuest,
        onSuccess: () => {
          setAll((prev) =>
            prev.map((p) =>
              p.roomNumber === updatedGuest.roomNumber &&
              p.guestId === updatedGuest.guestId
                ? updatedGuest
                : p,
            ),
          );
          if (
            detail?.roomNumber === updatedGuest.roomNumber &&
            detail?.guestId === updatedGuest.guestId
          ) {
            setDetail(updatedGuest);
          }
          success += 1;
        },
        onError: (err) => {
          console.error("bulk update failed for", g, err);
          fail += 1;
        },
      });
    } catch (err) {
      console.error("bulk update exception", err);
      fail += 1;
    }
  }

  return { success, fail };
}

interface BulkChangeDateModalProps {
  filteredGuests: Guest[];
  affectedCount: number;
  bulkProcessing: boolean;
  setBulkProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  detail: Guest | null;
  setDetail: React.Dispatch<React.SetStateAction<Guest | null>>;
  setAll: React.Dispatch<React.SetStateAction<Guest[]>>;
  onClose: () => void;
}

export function BulkChangeDateModal({
  filteredGuests,
  affectedCount,
  bulkProcessing,
  setBulkProcessing,
  detail,
  setDetail,
  setAll,
  onClose,
}: Readonly<BulkChangeDateModalProps>) {
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);

  const previewNewCheckIn = checkInDate
    ? checkInDate.toISOString().slice(0, 10)
    : "";
  const previewNewCheckOut = checkOutDate
    ? checkOutDate.toISOString().slice(0, 10)
    : "";
  const buttonText = bulkProcessing ? "処理中…" : "実行";

  const handleClose = () => {
    setCheckInDate(null);
    setCheckOutDate(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-lg p-6 mx-auto shadow-2xl"
        style={{ width: "min(90%,680px)" }}
      >
        <h4 style={{ marginTop: 0 }}>宿泊日を一括変更</h4>
        <div style={{ marginBottom: 12 }}>
          <BasicCheckInOutDate
            checkInDate={checkInDate}
            setCheckInDate={setCheckInDate}
            checkOutDate={checkOutDate}
            setCheckOutDate={setCheckOutDate}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}>
            {affectedCount} 件のゲストの宿泊日を {previewNewCheckIn || "---"} ～{" "}
            {previewNewCheckOut || "---"} に変更します。よろしいですか？
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={handleClose}>キャンセル</button>
          <button
            onClick={async () => {
              if (!checkInDate || !checkOutDate)
                return alert("チェックイン/チェックアウト日を選択してください");
              const newCheckIn = checkInDate.toISOString().slice(0, 10);
              const newCheckOut = checkOutDate.toISOString().slice(0, 10);
              if (!filteredGuests || filteredGuests.length === 0) {
                alert("該当するゲストがいません。");
                return;
              }

              setBulkProcessing(true);
              const { success, fail } = await executeBulkDateChange(
                filteredGuests,
                newCheckIn,
                newCheckOut,
                setAll,
                detail,
                setDetail,
              );
              setBulkProcessing(false);
              handleClose();
              alert(`完了: 成功 ${success} 件、失敗 ${fail} 件`);
            }}
            disabled={bulkProcessing}
            style={{
              backgroundColor: "#1976d2",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 4,
            }}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
