import type { Guest } from '../types/types';

export type GuestFilters = {
  roomFilter?: string;
  statusFilter?: string;
  checkInFilter?: string;
  bookingFilter?: string;
};

export function computeFilteredGuests(all: Guest[], f: GuestFilters): Guest[] {
  const sf = (f.statusFilter || '').toLowerCase();
  const base = all.filter(g => {
    const st = (g.approvalStatus || '').trim().toLowerCase();
    const statusOk = !sf || st === sf;
    const roomOk = !f.roomFilter || g.roomNumber === f.roomFilter;
    return statusOk && roomOk;
  });

  const sorted = [...base].sort((a, b) => {
    const aDate = a.checkInDate || '';
    const bDate = b.checkInDate || '';
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aId = a.bookingId || '';
    const bId = b.bookingId || '';
    if (aId !== bId) return aId.localeCompare(bId);
    return (a.guestName || '').localeCompare(b.guestName || '');
  });

  let post = sorted;
  if (f.checkInFilter) post = post.filter(g => (g.checkInDate || '') === f.checkInFilter);
  if (f.bookingFilter) post = post.filter(g => (g.bookingId || '') === f.bookingFilter);

  return post;
}