import { generateClient } from "aws-amplify/api";
import { useCallback, useEffect, useState } from "react";
import type { Incident } from "../types/incidents";
import { IncidentEditModal } from "./IncidentEditModal";

const client = generateClient({ authMode: "userPool" });

type GraphParams = Parameters<typeof client.graphql>[0];
type GraphqlResponse<T = unknown> = { data?: T };

const listQuery = `
  query ListIncidents($dateFrom: String!, $dateTo: String!) {
    listIncidents(dateFrom: $dateFrom, dateTo: $dateTo) {
      entityType
      dateIncidentId
      date
      incidentId
      roomId
      guestName
      issue
      currentLocation
      progress
      staff
      timeSpent
      resolutionDate
      solution
      createdAt
      updatedAt
    }
  }
`;

const listByProgressQuery = `
  query ListIncidentsByProgress($progress: String!) {
    listIncidentsByProgress(progress: $progress) {
      entityType
      dateIncidentId
      date
      incidentId
      roomId
      guestName
      issue
      currentLocation
      progress
      staff
      timeSpent
      resolutionDate
      solution
      createdAt
      updatedAt
    }
  }
`;

const PROGRESS_LABEL: Record<string, string> = {
  open: '未対応',
  in_progress: '対応中',
  closed: '完了',
};

const PROGRESS_COLOR: Record<string, string> = {
  open: '#dc2626',
  in_progress: '#d97706',
  closed: '#16a34a',
};

function todayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function sevenDaysAgoJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default function IncidentList() {
  const [unresolvedIncidents, setUnresolvedIncidents] = useState<Incident[]>([]);
  const [rangeIncidents, setRangeIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(sevenDaysAgoJST);
  const [dateTo, setDateTo] = useState(todayJST);
  const [editTarget, setEditTarget] = useState<Incident | null>(null);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [openRes, inProgressRes, rangeRes] = await Promise.all([
        client.graphql({
          query: listByProgressQuery,
          variables: { progress: 'open' },
        } as GraphParams),
        client.graphql({
          query: listByProgressQuery,
          variables: { progress: 'in_progress' },
        } as GraphParams),
        client.graphql({
          query: listQuery,
          variables: { dateFrom, dateTo },
        } as GraphParams),
      ]);

      const openData = (openRes as unknown as GraphqlResponse<{ listIncidentsByProgress?: Incident[] }>).data;
      const ipData = (inProgressRes as unknown as GraphqlResponse<{ listIncidentsByProgress?: Incident[] }>).data;
      const rangeData = (rangeRes as unknown as GraphqlResponse<{ listIncidents?: Incident[] }>).data;

      const unresolved = [
        ...(openData?.listIncidentsByProgress ?? []),
        ...(ipData?.listIncidentsByProgress ?? []),
      ];
      setUnresolvedIncidents(unresolved);

      // 日付範囲結果から未解決分を除外（上部に表示済み）
      const unresolvedKeys = new Set(unresolved.map((i) => i.dateIncidentId));
      const rangeOnly = (rangeData?.listIncidents ?? []).filter(
        (i) => !unresolvedKeys.has(i.dateIncidentId)
      );
      setRangeIncidents(rangeOnly);
    } catch (e) {
      console.error('Failed to load incidents:', e);
      setError('取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleSaved = (updated: Incident) => {
    const isStillUnresolved = updated.progress === 'open' || updated.progress === 'in_progress';

    setUnresolvedIncidents((prev) =>
      isStillUnresolved
        ? prev.map((i) => (i.dateIncidentId === updated.dateIncidentId ? updated : i))
        : prev.filter((i) => i.dateIncidentId !== updated.dateIncidentId)
    );

    setRangeIncidents((prev) => {
      const exists = prev.some((i) => i.dateIncidentId === updated.dateIncidentId);
      if (exists) {
        return prev.map((i) => (i.dateIncidentId === updated.dateIncidentId ? updated : i));
      }
      // closed に変更され、日付範囲内なら期間別履歴に追加
      if (!isStillUnresolved) {
        return [updated, ...prev];
      }
      return prev;
    });

    setEditTarget(null);
  };

  return (
    <div>
      {/* 未解決インシデント（全期間） */}
      {unresolvedIncidents.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: '#dc2626' }}>
            未解決 ({unresolvedIncidents.length}件)
          </h3>
          <IncidentTable incidents={unresolvedIncidents} onEdit={setEditTarget} />
        </div>
      )}

      {/* 日付範囲フィルタ */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>期間別履歴</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.9rem' }}>
          From{' '}<input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: '0.9rem' }}>
          To{' '}<input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>
        <button
          onClick={loadIncidents}
          disabled={loading}
          style={{ padding: '4px 12px', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '読込中…' : '検索'}
        </button>
      </div>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && rangeIncidents.length === 0 && (
        <p style={{ color: '#666' }}>該当する緊急対応履歴はありません。</p>
      )}

      {rangeIncidents.length > 0 && (
        <IncidentTable incidents={rangeIncidents} onEdit={setEditTarget} />
      )}

      {editTarget && (
        <IncidentEditModal
          incident={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

type IncidentTableProps = { incidents: Incident[]; onEdit: (i: Incident) => void };
function IncidentTable({ incidents, onEdit }: Readonly<IncidentTableProps>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
            <th style={th}>日付</th>
            <th style={th}>部屋</th>
            <th style={th}>氏名</th>
            <th style={th}>問い合わせ内容</th>
            <th style={th}>対応者</th>
            <th style={th}>ステータス</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <tr key={inc.dateIncidentId} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={td}>{inc.date}</td>
              <td style={td}>{inc.roomId ?? '—'}</td>
              <td style={td}>{inc.guestName ?? '—'}</td>
              <td style={{ ...td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {inc.issue ?? '—'}
              </td>
              <td style={td}>{inc.staff ?? '—'}</td>
              <td style={td}>
                <span style={{
                  color: PROGRESS_COLOR[inc.progress] ?? '#374151',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}>
                  {PROGRESS_LABEL[inc.progress] ?? inc.progress}
                </span>
              </td>
              <td style={td}>
                <button
                  onClick={() => onEdit(inc)}
                  style={{ padding: '2px 10px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  編集
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 12px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'top',
};
