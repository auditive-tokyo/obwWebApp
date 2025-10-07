import type { Dispatch, SetStateAction } from 'react';
import type { Guest } from '../adminpage/types/types';
import type { Client } from 'aws-amplify/api'

type GraphParams = Parameters<Client['graphql']>[0]

type Deps = {
  client: Client;
  guest: Guest;
  detail: Guest | null;
  setAll: Dispatch<SetStateAction<Guest[]>>;
  setDetail: Dispatch<SetStateAction<Guest | null>>;
  setSignedPassportUrl: Dispatch<SetStateAction<string | null>>;
  setRejectingId: Dispatch<SetStateAction<string | null>>;
};

const mutation = `
  mutation UpdateGuest($input: UpdateGuestInput!) {
    updateGuest(input: $input) {
      guestId
      approvalStatus
    }
  }
`;

export async function rejectGuest({
  client,
  guest,
  detail,
  setAll,
  setDetail,
  setSignedPassportUrl,
  setRejectingId
}: Deps) {
  if (!guest) return;
  setRejectingId(guest.guestId);
  try {
    await client.graphql({
      query: mutation,
      variables: {
        input: {
          guestId: guest.guestId,
          roomNumber: guest.roomNumber,
          approvalStatus: 'rejected'
        }
      }
    } as GraphParams);

    // 楽観更新
    setAll(prev =>
      prev.map(g =>
        g.guestId === guest.guestId ? { ...g, approvalStatus: 'rejected' } : g
      )
    );

    // 詳細表示中なら閉じる
    if (detail?.guestId === guest.guestId) {
      setDetail(null);
      setSignedPassportUrl(null);
    }

    window.alert(`${guest.guestName} を拒否しました。`);
  } catch (e: unknown) {
    console.error('[rejectGuest] failed:', e);
    alert('拒否に失敗しました');
  } finally {
    setRejectingId(null);
  }
}