import type { Guest } from '../adminpage/types/types';
import { dbg } from '@/utils/debugLogger';

interface UpdateGuestParams {
  // The Amplify-generated client shape is complex; suppress the explicit-any rule here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  guest: Guest;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export async function updateGuest({
  client,
  guest,
  onSuccess,
  onError
}: UpdateGuestParams): Promise<void> {
  try {
    const mutation = `
      mutation UpdateGuest($input: UpdateGuestInput!) {
        updateGuest(input: $input) {
          roomNumber
          guestId
          bookingId
          guestName
          email
          address
          phone
          occupation
          nationality
          passportImageUrl
          checkInDate
          checkOutDate
          approvalStatus
          promoConsent
          isFamilyMember
          currentLocation
          sessionTokenExpiresAt
          createdAt
          updatedAt
        }
      }
    `;

    const variables = {
      input: {
        roomNumber: guest.roomNumber,
        guestId: guest.guestId,
        bookingId: guest.bookingId || undefined,
        guestName: guest.guestName,
        email: guest.email || undefined,
        address: guest.address || undefined,
        phone: guest.phone || undefined,
        occupation: guest.occupation || undefined,
        nationality: guest.nationality || undefined,
        // passportImageUrl は編集不可（別途アップロード機能で管理）
        checkInDate: guest.checkInDate || undefined,
        checkOutDate: guest.checkOutDate || undefined,
        // approvalStatus は編集不可（別ボタンで制御）
        // promoConsent は Guest型に未定義
        // isFamilyMember は Guest型に未定義
        currentLocation: guest.currentLocation || undefined,
        sessionTokenExpiresAt: guest.sessionTokenExpiresAt || undefined,
      }
    };

    const result = await client.graphql({
      query: mutation,
      variables
    });

    dbg('✅ Guest updated successfully:', result.data.updateGuest);
    
    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('❌ Failed to update guest:', error);
    if (onError) {
      onError(error as Error);
    } else {
      throw error;
    }
  }
}
