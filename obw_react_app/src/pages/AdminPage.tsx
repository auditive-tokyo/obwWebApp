import { generateClient } from "aws-amplify/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import BulkChangeButton from "./adminpage/components/BulkChangeButton";
import { BulkChangeDateModal } from "./adminpage/components/BulkChangeDateModal";
import { DetailsModal } from "./adminpage/components/detailsModal";
import IncidentList from "./adminpage/components/IncidentList";
import {
  confirmApproveDialog,
  confirmRejectDialog,
} from "./adminpage/components/Dialogs";
import FiltersBar from "./adminpage/components/FiltersBar";
import GuestList from "./adminpage/components/GuestList";
import OperationalHoursSettings from "./adminpage/components/OperationalHoursSettings";
import RoomTransferButton from "./adminpage/components/RoomTransferButton";
import { RoomTransferModal } from "./adminpage/components/RoomTransferModal";
import type { Guest } from "./adminpage/types/types";
import { computeFilteredGuests } from "./adminpage/utils/guestFilters";
import { approveGuest } from "./handlers/approveGuest";
import { fetchGuests } from "./handlers/fetchGuests";
import { fetchPassportSignedUrl } from "./handlers/fetchPassportSignedUrl";
import { rejectGuest } from "./handlers/rejectGuest";
import { updateGuest } from "./handlers/updateGuest";

// AdminはUser Pool固定（ここで明示）
const client = generateClient({ authMode: "userPool" });

// Props interface を追加
interface AdminPageProps {
  roomId?: string;
  bookingFilter?: string | null;
}

/**
 * URL pathからパーツを取得するヘルパー
 */
function getAdminPathParts(): string[] {
  const path = globalThis.location.pathname;
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
    detail?.roomNumber === updatedGuest.roomNumber &&
    detail?.guestId === updatedGuest.guestId;

  if (shouldUpdateDetail) {
    setDetail(updatedGuest);
  }
}

export default function AdminPage({
  roomId,
  bookingFilter: initialBookingFilter,
}: Readonly<AdminPageProps>) {
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
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"guests" | "incidents">("guests");

  // 部屋番号のオプション（FiltersBarと同じロジック）
  const roomOptions = useMemo(() => {
    const set = new Set<string>(all.map((g) => g.roomNumber).filter(Boolean));
    for (let floor = 2; floor <= 8; floor++) {
      for (let room = 1; room <= 4; room++) {
        const roomNumber = `${floor}${String(room).padStart(2, "0")}`;
        set.add(roomNumber);
      }
    }
    return Array.from(set).sort(
      (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
    );
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
  const affectedCount = filteredGuests ? filteredGuests.length : 0;

  // 表示用の事前計算（JSX内の三項演算子を削減）
  const displayRoomLabel = roomFilter ? `部屋${roomFilter}のみ` : "全部屋";
  const displayStatusLabel = statusFilter.length
    ? statusFilter.join("")
    : "すべての状態";
  const debugStatusText = statusFilter.length ? statusFilter.join("") : "empty";
  const loadButtonText = loading ? "更新中…" : "更新";

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
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
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
      {/* タブ切り替え */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        {(["guests", "incidents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px",
              cursor: "pointer",
              border: "none",
              borderBottom:
                activeTab === tab
                  ? "2px solid #2563eb"
                  : "2px solid transparent",
              background: "none",
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? "#2563eb" : "#374151",
              marginBottom: -2,
              fontSize: "0.95rem",
            }}
          >
            {tab === "guests" ? "ゲスト管理" : "緊急対応履歴"}
          </button>
        ))}
      </div>

      {activeTab === "incidents" && <IncidentList />}

      {activeTab === "guests" && (
        <>
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
              title={
                "部屋を選択し、チェックイン日または予約IDを選択してください"
              }
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
              title={
                "部屋を選択し、チェックイン日または予約IDを選択してください"
              }
              onClick={() => {
                if (!canBulk || !roomFilter) return;
                setTransferModalOpen(true);
              }}
            />

            {/* 有人稼働時間設定 */}
            <OperationalHoursSettings />

            {/* Bulk change modal */}
            {bulkModalOpen && (
              <BulkChangeDateModal
                filteredGuests={filteredGuests}
                affectedCount={affectedCount}
                bulkProcessing={bulkProcessing}
                setBulkProcessing={setBulkProcessing}
                detail={detail}
                setDetail={setDetail}
                setAll={setAll}
                onClose={() => setBulkModalOpen(false)}
              />
            )}

            {/* 部屋移動モーダル */}
            {transferModalOpen && (
              <RoomTransferModal
                roomFilter={roomFilter}
                affectedCount={affectedCount}
                roomOptions={roomOptions}
                bulkProcessing={bulkProcessing}
                setBulkProcessing={setBulkProcessing}
                bookingFilter={bookingFilter}
                onClose={() => setTransferModalOpen(false)}
                onSuccess={loadData}
              />
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
        </>
      )}
    </div>
  );
}
