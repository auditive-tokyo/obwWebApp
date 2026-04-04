import { generateClient } from "aws-amplify/api";
import { useState } from "react";
import type { Incident, IncidentProgress } from "../types/incidents";

const client = generateClient({ authMode: "userPool" });

type GraphParams = Parameters<typeof client.graphql>[0];
type GraphqlResponse<T = unknown> = { data?: T };

const updateMutation = `
  mutation UpdateIncident($input: UpdateIncidentInput!) {
    updateIncident(input: $input) {
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

interface Props {
  incident: Incident;
  onClose: () => void;
  onSaved: (updated: Incident) => void;
}

const PROGRESS_OPTIONS: { value: IncidentProgress; label: string }[] = [
  { value: 'open', label: '未対応' },
  { value: 'in_progress', label: '対応中' },
  { value: 'closed', label: '完了' },
];

export function IncidentEditModal({ incident, onClose, onSaved }: Readonly<Props>) {
  const [staff, setStaff] = useState(incident.staff ?? '');
  const [timeSpent, setTimeSpent] = useState(incident.timeSpent ?? '');
  const [resolutionDate, setResolutionDate] = useState(incident.resolutionDate ?? '');
  const [solution, setSolution] = useState(incident.solution ?? '');
  const [progress, setProgress] = useState<IncidentProgress>(incident.progress);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await client.graphql({
        query: updateMutation,
        variables: {
          input: {
            dateIncidentId: incident.dateIncidentId,
            staff: staff || undefined,
            timeSpent: timeSpent || undefined,
            resolutionDate: resolutionDate || undefined,
            solution: solution || undefined,
            progress,
          },
        },
      } as GraphParams);
      const data = (res as unknown as GraphqlResponse<{ updateIncident?: Incident }>).data;
      if (data?.updateIncident) {
        onSaved(data.updateIncident);
      }
    } catch (e) {
      console.error('Failed to update incident:', e);
      setError('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        style={overlay}
      />
      <dialog
        open
        aria-modal
        style={modal}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>緊急対応 編集</h3>

        {/* 読み取り専用情報 */}
        <div style={{ background: '#f9fafb', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: '0.88rem', lineHeight: 1.7 }}>
          <div><strong>日付:</strong> {incident.date}</div>
          <div><strong>部屋番号:</strong> {incident.roomId ?? '—'}</div>
          <div><strong>氏名:</strong> {incident.guestName ?? '—'}</div>
          {incident.currentLocation && <div><strong>現在位置:</strong> {incident.currentLocation}</div>}
          <div><strong>問い合わせ内容:</strong></div>
          <div style={{ whiteSpace: 'pre-wrap', marginLeft: 8 }}>{incident.issue ?? '—'}</div>
        </div>

        {/* 編集フィールド */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={labelStyle}>
            ステータス{/**/}<select
              value={progress}
              onChange={(e) => setProgress(e.target.value as IncidentProgress)}
              style={inputStyle}
            >
              {PROGRESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            担当者{/**/}<input
              type="text"
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              placeholder="担当者名"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            対応時間{/**/}<input
              type="text"
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              placeholder="例: 30分"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            解決日{/**/}<input
              type="date"
              value={resolutionDate}
              onChange={(e) => setResolutionDate(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            対応内容・解決策{/**/}<textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="対応内容を記入してください"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
        </div>

        {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} disabled={saving} style={cancelBtn}>
            キャンセル
          </button>
          <button onClick={handleSave} disabled={saving} style={saveBtn}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </dialog>
    </>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  border: 'none',
  cursor: 'default',
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '24px 28px',
  width: '100%',
  maxWidth: 520,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  zIndex: 1001,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.88rem',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.9rem',
  fontWeight: 400,
};

const cancelBtn: React.CSSProperties = {
  padding: '7px 18px',
  cursor: 'pointer',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
};

const saveBtn: React.CSSProperties = {
  padding: '7px 18px',
  cursor: 'pointer',
  borderRadius: 6,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 600,
};
