import { useMemo, useEffect } from 'react';
import type { Guest, ApprovalStatus } from '../types/types';

interface Props {
  all: Guest[];
  roomFilter: string;
  setRoomFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
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
    return Array.from(set).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [all]);

  // check-in date options for the selected room
  const checkInOptions = useMemo(() => {
    if (!roomFilter) return [] as string[];
    const s = new Set<string>();
    all.forEach(g => {
      if (g.roomNumber === roomFilter && g.checkInDate) s.add(g.checkInDate);
    });
    return Array.from(s).sort();
  }, [all, roomFilter]);

  // bookingId options for the selected room (and optional check-in filter)
  const bookingOptions = useMemo(() => {
    if (!roomFilter) return [] as string[];
    const s = new Set<string>();
    all.forEach(g => {
      if (g.roomNumber === roomFilter && (!checkInFilter || g.checkInDate === checkInFilter) && g.bookingId) s.add(g.bookingId);
    });
    return Array.from(s).sort();
  }, [all, roomFilter, checkInFilter]);

  // clear dependent filters when room changes
  useEffect(() => {
    setBookingFilter('');
    setCheckInFilter('');
  }, [roomFilter, setBookingFilter, setCheckInFilter]);

  // keep bookingFilter only if it's still present in bookingOptions
  useEffect(() => {
    if (!bookingFilter) return;
    if (!bookingOptions.includes(bookingFilter)) setBookingFilter('');
  }, [bookingOptions, bookingFilter, setBookingFilter]);

  const statusOptions: (ApprovalStatus | '')[] = [
    '',
    'pending',
    'waitingForBasicInfo',
    'waitingForPassportImage',
    'approved',
    'rejected'
  ];

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

      {/* ステータスフィルター */}
      <select
        style={{ marginLeft: 12 }}
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">ステータス</option>
        {statusOptions.slice(1).map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

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
