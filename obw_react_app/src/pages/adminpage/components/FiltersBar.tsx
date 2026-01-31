import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApprovalStatus, Guest } from '../types/types';

interface Props {
  all: Guest[];
  roomFilter: string;
  setRoomFilter: (v: string) => void;
  statusFilter: string[];
  setStatusFilter: (v: string[]) => void;
  bookingFilter: string;
  setBookingFilter: (v: string) => void;
  checkInFilter: string;
  setCheckInFilter: (v: string) => void;
}

export default function FiltersBar({
  all,
  roomFilter,
  setRoomFilter,
  statusFilter,
  setStatusFilter,
  bookingFilter,
  setBookingFilter,
  checkInFilter,
  setCheckInFilter
}: Props) {
  // 部屋番号のオプション
  const roomOptions = useMemo(() => {
    const set = new Set<string>(all.map(g => g.roomNumber).filter(Boolean));
    for (let floor = 2; floor <= 8; floor++) {
      for (let room = 1; room <= 4; room++) {
        const roomNumber = `${floor}${String(room).padStart(2, '0')}`;
        set.add(roomNumber);
      }
    }
    return Array.from(set).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  }, [all]);

  // check-in date options for the selected room
  const checkInOptions = useMemo(() => {
    if (!roomFilter) return [] as string[];
    const s = new Set<string>();
    all.forEach(g => {
      if (g.roomNumber === roomFilter && g.checkInDate) s.add(g.checkInDate);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [all, roomFilter]);

  // bookingId options for the selected room (and optional check-in filter)
  const bookingOptions = useMemo(() => {
    if (!roomFilter) return [] as string[];
    const s = new Set<string>();
    all.forEach(g => {
      if (g.roomNumber === roomFilter && (!checkInFilter || g.checkInDate === checkInFilter) && g.bookingId) s.add(g.bookingId);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [all, roomFilter, checkInFilter]);

  // 前回のroomFilterの値を保持して、本当に変更されたかを比較する
  const prevRoomFilterRef = useRef(roomFilter);
  // 初期bookingFilterの値を保持（URLから来た値は保護する）
  const initialBookingFilterRef = useRef(bookingFilter);

  // clear dependent filters when room changes (値が実際に変更された場合のみ)
  useEffect(() => {
    if (prevRoomFilterRef.current === roomFilter) {
      return;
    }
    prevRoomFilterRef.current = roomFilter;
    setBookingFilter('');
    setCheckInFilter('');
  }, [roomFilter, setBookingFilter, setCheckInFilter]);

  // keep bookingFilter only if it's still present in bookingOptions
  // ただし、初期値（URLから来た値）はデータロード完了まで保護する
  useEffect(() => {
    if (!bookingFilter) return;
    // 初期値と同じ場合で、まだデータが読み込まれていない場合はスキップ
    if (bookingFilter === initialBookingFilterRef.current && bookingOptions.length === 0) {
      return;
    }
    if (!bookingOptions.includes(bookingFilter)) {
      setBookingFilter('');
    }
  }, [bookingOptions, bookingFilter, setBookingFilter]);

  const statusOptions: ApprovalStatus[] = [
    'pending',
    'waitingForBasicInfo',
    'waitingForPassportImage',
    'approved',
    'rejected'
  ];

  // カスタムドロップダウンの開閉状態
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isStatusDropdownOpen]);

  // ステータス選択のトグル
  const toggleStatus = (status: ApprovalStatus) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter(s => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };

  // 表示用テキスト
  const getStatusDisplayText = () => {
    if (statusFilter.length === 0) return 'ステータス: 全て';
    if (statusFilter.length === statusOptions.length) return 'ステータス: 全て';
    if (statusFilter.length === 1) return `ステータス: ${statusFilter[0]}`;
    return `ステータス: ${statusFilter.length}件選択`;
  };

  return (
    <>
      {/* 部屋フィルター */}
      <select
        style={{ marginLeft: 12 }}
        value={roomFilter}
        onChange={(e) => setRoomFilter(e.target.value)}
      >
        <option value="">部屋番号</option>
        {roomOptions.map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* ステータスフィルター（カスタムドロップダウン） */}
      <div
        ref={statusDropdownRef}
        style={{
          position: 'relative',
          display: 'inline-block',
          marginLeft: 12
        }}
      >
        <button
          onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            minWidth: '150px',
            textAlign: 'left'
          }}
        >
          {getStatusDisplayText()} ▾
        </button>

        {isStatusDropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '200px',
              padding: '8px 0'
            }}
          >
            {statusOptions.map(status => (
              <div
                key={status}
                role="button"
                tabIndex={0}
                aria-pressed={statusFilter.includes(status)}
                onClick={() => toggleStatus(status)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleStatus(status);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '14px',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {statusFilter.includes(status) ? (
                    // Blue checkmark only (no circle)
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M20 6L9 17l-5-5" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    // empty placeholder to keep alignment
                    <span style={{ display: 'inline-block', width: 16, height: 16 }} />
                  )}
                </span>
                <span>{status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* チェックイン日フィルター */}
      <select
        style={{
          marginLeft: 12,
          opacity: roomFilter ? 1 : 0.5,
          cursor: roomFilter ? 'pointer' : 'not-allowed'
        }}
        value={checkInFilter}
        onChange={(e) => setCheckInFilter(e.target.value)}
        disabled={!roomFilter}
      >
        <option value="">チェックイン日</option>
        {checkInOptions.map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {/* 予約IDフィルター */}
      <select
        style={{
          marginLeft: 12,
          opacity: roomFilter ? 1 : 0.5,
          cursor: roomFilter ? 'pointer' : 'not-allowed'
        }}
        value={bookingFilter}
        onChange={(e) => setBookingFilter(e.target.value)}
        disabled={!roomFilter}
      >
        <option value="">予約ID</option>
        {bookingOptions.map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </>
  );
}
