export type ApprovalStatus =
  | 'pending'
  | 'waitingForBasicInfo'
  | 'waitingForPassportImage'
  | 'approved'
  | 'rejected';

export type Guest = {
  roomNumber: string;
  guestId: string;
  guestName: string;
  approvalStatus: ApprovalStatus;
  checkInDate?: string;
  checkOutDate?: string;
  bookingId?: string;
  email?: string;
  phone?: string;
  address?: string;
  occupation?: string;
  nationality?: string;
  passportImageUrl?: string;
  currentLocation?: string;
  sessionTokenExpiresAt?: number;  // Unix epoch (秒単位)
};