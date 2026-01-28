import { generateClient } from "aws-amplify/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import BulkChangeButton from "./adminpage/components/BulkChangeButton";
import { DetailsModal } from "./adminpage/components/detailsModal";
import {
  confirmApproveDialog,
  confirmRejectDialog,
} from "./adminpage/components/Dialogs";
import FiltersBar from "./adminpage/components/FiltersBar";
import GuestList from "./adminpage/components/GuestList";
import RoomTransferButton from "./adminpage/components/RoomTransferButton";
import type { Guest } from "./adminpage/types/types";
import { computeFilteredGuests } from "./adminpage/utils/guestFilters";
import { BasicCheckInOutDate } from "./components/BasicCheckInOutDate";
import { approveGuest } from "./handlers/approveGuest";
import { fetchGuests } from "./handlers/fetchGuests";
import { fetchPassportSignedUrl } from "./handlers/fetchPassportSignedUrl";
import { rejectGuest } from "./handlers/rejectGuest";
import { transferRoomGuests } from "./handlers/transferRoomGuests";
import { updateGuest } from "./handlers/updateGuest";

// AdminはUser Pool固定（ここで明示）
const client = generateClient({ authMode: "userPool" });

// checkOutDate (YYYY-MM-DD) から sessionTokenExpiresAt (Unix epoch秒) を計算
// チェックアウト日の日本時間正午（12:00 JST = 03:00 UTC）に設定
const calculateSessionExpiry = (checkOutDate: string): number => {
  const checkOut = new Date(checkOutDate);
  // 日本時間の正午 = UTC 03:00
  checkOut.setUTCHours(3, 0, 0, 0);
  // Unix epoch (秒単位)
  return Math.floor(checkOut.getTime() / 1000);
};

// Props interface を追加
interface AdminPageProps {
  roomId?: string;
  bookingFilter?: string | null;
}

/**
 * URL pathからパーツを取得するヘルパー
 */
function getAdminPathParts(): string[] {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "admin") return [];
  return parts;
}

/**
 * URLから部屋番号を解析
 */
function parseRoomFromUrl(): string {
  const parts = getAdminPathParts();
  // /admin/:room (数字のみ)
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    return parts[1];
  }
  return "";
}

/**
 * URLから予約IDを解析
 */
function parseBookingFromUrl(): string {
  const parts = getAdminPathParts();
  // /admin/:room/:booking
  if (parts.length >= 3 && parts[2]) {
    return parts[2];
  }
  // /admin/:booking (数字以外)
  if (parts.length === 2 && !/^\d+$/.test(parts[1])) {
    return parts[1];
  }
  return "";
}

/**
 * 一括更新の結果型
 */
interface BulkUpdateResult {
  success: number;
  fail: number;
}

/**
 * ゲストの宿泊日を一括更新
 */
async function executeBulkDateChange(
  affected: Guest[],
  newCheckIn: string,
  newCheckOut: string,
  updateFn: (params: {
    client: typeof client;
    guest: Guest;
    onSuccess: () => void;
    onError: (err: Error) => void;
  }) => Promise<void>,
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
      await updateFn({
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
            detail &&
            detail.roomNumber === updatedGuest.roomNumber &&
            detail.guestId === updatedGuest.guestId
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

/**
 * ゲスト状態を更新するヘルパー（detail更新を含む）
 */
function updateGuestInState(
  updatedGuest: Guest,
  setAll: React.Dispatch<React.SetStateAction<Guest[]>>,
  detail: Guest | null,
  setDetail: React.Dispatch<React.SetStateAction<Guest | null>>,
): void {
  setAll((prev) =>
    prev.map((g) =>
      g.roomNumber === updatedGuest.roomNumber &&
      g.guestId === updatedGuest.guestId
        ? updatedGuest
        : g,
    ),
  );

  const shouldUpdateDetail =
    detail &&
    detail.roomNumber === updatedGuest.roomNumber &&
    detail.guestId === updatedGuest.guestId;

  if (shouldUpdateDetail) {
    setDetail(updatedGuest);
  }
}

/**
 * 部屋移動エラーメッセージを取得
 */
function getTransferErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "不明なエラー";
}

export default function AdminPage({
  roomId,
  bookingFilter: initialBookingFilter,
}: AdminPageProps) {
  const [all, setAll] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL解析でroomIdを取得（propsを優先、フォールバックでURL解析）
  const [roomFilter, setRoomFilter] = useState(
    () => roomId || parseRoomFromUrl(),
  );

  const [statusFilter, setStatusFilter] = useState<string[]>(["pending"]);
  // bookingFilter は props の初期値を優先して設定。propsが無ければURLから解析。
  const [bookingFilter, setBookingFilter] = useState(
    () => initialBookingFilter || parseBookingFromUrl(),
  );
  const [checkInFilter, setCheckInFilter] = useState("");
  const [detail, setDetail] = useState<Guest | null>(null);
  const [signedPassportUrl, setSignedPassportUrl] = useState<string | null>(
    null,
  );
  const [signing, setSigning] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkCheckInDate, setBulkCheckInDate] = useState<Date | null>(null);
  const [bulkCheckOutDate, setBulkCheckOutDate] = useState<Date | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetRoom, setTransferTargetRoom] = useState("");

  // 部屋番号のオプション（FiltersBarと同じロジック）
  const roomOptions = useMemo(() => {
    const set = new Set<string>(all.map((g) => g.roomNumber).filter(Boolean));
    for (let floor = 2; floor <= 8; floor++) {
      for (let room = 1; room <= 4; room++) {
        const roomNumber = `${floor}${String(room).padStart(2, "0")}`;
        set.add(roomNumber);
      }
    }
    return Array.from(set).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [all]);

  // フィルタリングロジック
  const filteredGuests = useMemo(() => {
    return computeFilteredGuests(all, {
      roomFilter,
      statusFilter,
      checkInFilter,
      bookingFilter,
    });
  }, [all, roomFilter, statusFilter, checkInFilter, bookingFilter]);

  // 宿泊日変更ボタンがアクティブになれる条件
  const canBulk = Boolean(roomFilter && (checkInFilter || bookingFilter));
  const previewNewCheckIn = bulkCheckInDate
    ? bulkCheckInDate.toISOString().slice(0, 10)
    : "";
  const previewNewCheckOut = bulkCheckOutDate
    ? bulkCheckOutDate.toISOString().slice(0, 10)
    : "";
  const affectedCount = filteredGuests ? filteredGuests.length : 0;

  // 表示用の事前計算（JSX内の三項演算子を削減）
  const displayRoomLabel = roomFilter ? `部屋${roomFilter}のみ` : "全部屋";
  const displayStatusLabel =
    statusFilter && statusFilter.length
      ? statusFilter.join("")
      : "すべての状態";
  const debugStatusText =
    statusFilter && statusFilter.length ? statusFilter.join("") : "empty";
  const loadButtonText = loading ? "更新中…" : "更新";
  const bulkButtonText = bulkProcessing ? "処理中…" : "実行";

  // データ読み込み関数を作成
  const loadData = useCallback(async () => {
    await fetchGuests({
      client,
      setAll,
      setLoading,
      setError,
      roomFilter: roomFilter || undefined,
      statusFilter: statusFilter || undefined,
    });
  }, [roomFilter, statusFilter]);

  // 初回読み込みおよびフィルター変更時の自動更新
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ESCで閉じる
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  // 詳細を開いたら署名URL取得
  useEffect(() => {
    if (detail?.passportImageUrl) {
      fetchPassportSignedUrl({
        client,
        guest: detail,
        setSignedPassportUrl,
        setSigning,
      });
    } else {
      setSignedPassportUrl(null);
    }
  }, [detail]);

  // 承認前の確認ダイアログ
  const confirmApprove = async (g: Guest) => {
    await confirmApproveDialog(g, async () => {
      await approveGuest({
        client,
        guest: g,
        setAll,
        setDetail,
        setSignedPassportUrl,
        setApprovingId,
      });
    });
  };

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
        setRejectingId,
      });
    });
  };

  // ゲスト情報更新ハンドラー
  const handleUpdateGuest = async (updatedGuest: Guest) => {
    await updateGuest({
      client,
      guest: updatedGuest,
      onSuccess: () => {
        updateGuestInState(updatedGuest, setAll, detail, setDetail);
        alert("更新しました！");
      },
      onError: (error) => {
        console.error("Update failed:", error);
        alert("更新に失敗しました: " + error.message);
      },
    });
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* タイトル/サマリー（中央寄せ） */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontWeight: 600 }}>
          表示中: {displayRoomLabel} / {displayStatusLabel}
        </h3>
        <div
          style={{ fontSize: "0.85rem", color: "#666", marginTop: 6 }}
        >{`Debug: roomFilter=${roomFilter || "empty"}, bookingFilter=${bookingFilter || "empty"}, statusFilter=${debugStatusText}, NumberOfSelectedGuests=${affectedCount}`}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={loadData} disabled={loading}>
          {loadButtonText}
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
          title={"部屋を選択し、チェックイン日または予約IDを選択してください"}
          onClick={() => {
            if (!canBulk) return;
            // open modal to pick dates
            setBulkModalOpen(true);
          }}
        />

        {/* 部屋移動ボタン */}
        <RoomTransferButton
          canBulk={canBulk}
          bulkProcessing={bulkProcessing}
          title={"部屋を選択し、チェックイン日または予約IDを選択してください"}
          onClick={() => {
            if (!canBulk || !roomFilter) return;
            setTransferTargetRoom("");
            setTransferModalOpen(true);
          }}
        />

        {/* Bulk change modal */}
        {bulkModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div
              className="bg-white rounded-lg p-6 mx-auto shadow-2xl"
              style={{ width: "min(90%,680px)" }}
            >
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
                  {affectedCount} 件のゲストの宿泊日を{" "}
                  {previewNewCheckIn || "---"} ～ {previewNewCheckOut || "---"}{" "}
                  に変更します。よろしいですか？
                </div>
              </div>
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <button
                  onClick={() => {
                    setBulkModalOpen(false);
                    setBulkCheckInDate(null);
                    setBulkCheckOutDate(null);
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={async () => {
                    if (!bulkCheckInDate || !bulkCheckOutDate)
                      return alert(
                        "チェックイン/チェックアウト日を選択してください",
                      );
                    const newCheckIn = bulkCheckInDate
                      .toISOString()
                      .slice(0, 10);
                    const newCheckOut = bulkCheckOutDate
                      .toISOString()
                      .slice(0, 10);
                    const affected = filteredGuests;
                    if (!affected || affected.length === 0) {
                      alert("該当するゲストがいません。");
                      return;
                    }

                    setBulkProcessing(true);
                    const { success, fail } = await executeBulkDateChange(
                      affected,
                      newCheckIn,
                      newCheckOut,
                      updateGuest,
                      setAll,
                      detail,
                      setDetail,
                    );

                    setBulkProcessing(false);
                    setBulkModalOpen(false);
                    setBulkCheckInDate(null);
                    setBulkCheckOutDate(null);
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
                  {bulkButtonText}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 部屋移動モーダル */}
        {transferModalOpen && (
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
                  移動先の部屋番号:
                </label>
                <select
                  value={transferTargetRoom}
                  onChange={(e) => setTransferTargetRoom(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    fontSize: "14px",
                  }}
                >
                  <option value="">選択してください</option>
                  {roomOptions
                    .filter((r) => r !== roomFilter) // 現在の部屋を除外
                    .map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                </select>
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
                <button
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferTargetRoom("");
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={async () => {
                    if (!transferTargetRoom) {
                      alert("移動先の部屋番号を選択してください");
                      return;
                    }

                    // 確認ダイアログ
                    const confirmed = confirm(
                      `${affectedCount}件のゲストを\n` +
                        `部屋 ${roomFilter} から 部屋 ${transferTargetRoom} に移動します。\n\n` +
                        `よろしいですか？`,
                    );

                    if (!confirmed) return;

                    // 部屋移動実行
                    setBulkProcessing(true);
                    try {
                      // bookingFilterが指定されている場合はそれを使う（単一）
                      // 指定されていない場合はundefined = 全ゲスト移動
                      const bookingIds = bookingFilter
                        ? [bookingFilter]
                        : undefined;

                      await transferRoomGuests({
                        client,
                        oldRoomNumber: roomFilter,
                        newRoomNumber: transferTargetRoom,
                        bookingIds,
                        onSuccess: (result) => {
                          setTransferModalOpen(false);
                          setTransferTargetRoom("");
                          alert(
                            `✅ 部屋移動完了\n\n` +
                              `${result.transferredCount}件のゲストを移動しました。\n` +
                              `部屋 ${roomFilter} → 部屋 ${transferTargetRoom}`,
                          );
                          // データを再読み込み
                          loadData();
                        },
                        onError: (error) => {
                          alert(
                            `❌ 部屋移動に失敗しました\n\n${error.message}`,
                          );
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
                      transferTargetRoom && !bulkProcessing
                        ? "#1976d2"
                        : "#ccc",
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
  );
}
