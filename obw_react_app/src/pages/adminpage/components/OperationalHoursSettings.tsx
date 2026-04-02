import { generateClient } from "aws-amplify/api";
import { useEffect, useState } from "react";

const client = generateClient({ authMode: "userPool" });

type GraphParams = Parameters<typeof client.graphql>[0];
type GraphqlResponse<T = unknown> = { data?: T };

const getQuery = `
  query GetOperationalHours {
    getOperationalHours {
      startHour
      startMinute
      endHour
      endMinute
    }
  }
`;

const updateMutation = `
  mutation UpdateOperationalHours($startHour: Int!, $startMinute: Int!, $endHour: Int!, $endMinute: Int!) {
    updateOperationalHours(startHour: $startHour, startMinute: $startMinute, endHour: $endHour, endMinute: $endMinute) {
      startHour
      startMinute
      endHour
      endMinute
    }
  }
`;

export default function OperationalHoursSettings() {
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(21);
  const [endMinute, setEndMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.graphql({
          query: getQuery,
        } as GraphParams);
        const resObj = res as unknown as GraphqlResponse<{
          getOperationalHours?: {
            startHour: number;
            startMinute: number;
            endHour: number;
            endMinute: number;
          };
        }>;
        const hours = resObj.data?.getOperationalHours;
        if (hours) {
          setStartHour(hours.startHour);
          setStartMinute(hours.startMinute);
          setEndHour(hours.endHour);
          setEndMinute(hours.endMinute);
        }
      } catch (err) {
        console.error("稼働時間の取得に失敗:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatTime = (h: number, m: number) =>
    `${h}:${String(m).padStart(2, "0")}`;

  const handleSave = async () => {
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    if (startTotal >= endTotal) {
      alert("開始時間は終了時間より前にしてください");
      return;
    }
    setSaving(true);
    try {
      await client.graphql({
        query: updateMutation,
        variables: { startHour, startMinute, endHour, endMinute },
      } as GraphParams);
      alert(
        `稼働時間を ${formatTime(startHour, startMinute)}〜${formatTime(endHour, endMinute)} に更新しました`,
      );
    } catch (err) {
      console.error("稼働時間の更新に失敗:", err);
      alert("稼働時間の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const hourOptions = Array.from({ length: 25 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45];

  const selectStyle = {
    padding: "4px",
    borderRadius: 4,
    border: "1px solid #ccc",
  };

  if (loading) {
    return (
      <span style={{ marginLeft: 12, fontSize: "0.85rem", color: "#999" }}>
        稼働時間読込中…
      </span>
    );
  }

  return (
    <span
      style={{
        marginLeft: 12,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: "0.85rem",
      }}
    >
      <span style={{ color: "#666" }}>有人対応:</span>
      <select
        value={startHour}
        onChange={(e) => setStartHour(Number(e.target.value))}
        style={selectStyle}
      >
        {hourOptions.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        value={startMinute}
        onChange={(e) => setStartMinute(Number(e.target.value))}
        style={selectStyle}
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span>〜</span>
      <select
        value={endHour}
        onChange={(e) => setEndHour(Number(e.target.value))}
        style={selectStyle}
      >
        {hourOptions.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        value={endMinute}
        onChange={(e) => setEndMinute(Number(e.target.value))}
        style={selectStyle}
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginLeft: 4,
          backgroundColor: "#4caf50",
          color: "#fff",
          border: "none",
          padding: "4px 10px",
          borderRadius: 4,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.5 : 1,
          fontSize: "0.85rem",
        }}
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </span>
  );
}
