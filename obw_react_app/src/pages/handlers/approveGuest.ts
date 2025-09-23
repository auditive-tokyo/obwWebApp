import type { Guest } from '../adminpage/types/types';

type Deps = {
  client: any;
  guest: Guest;
  detail: Guest | null;
  setAll: React.Dispatch<React.SetStateAction<Guest[]>>;
  setDetail: React.Dispatch<React.SetStateAction<Guest | null>>;
  setSignedPassportUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setApprovingId: React.Dispatch<React.SetStateAction<string | null>>;
};

const mutation = `
  mutation AdminApproveGuest($roomNumber: String!, $guestId: String!) {
    adminApproveGuest(roomNumber: $roomNumber, guestId: $guestId) {
      guestId
      approvalStatus
    }
  }
`;

export async function approveGuest({
  client,
  guest,
  detail,
  setAll,
  setDetail,
  setSignedPassportUrl,
  setApprovingId
}: Deps) {
  if (!guest) return;
  setApprovingId(guest.guestId);
  try {
    await client.graphql({
      query: mutation,
      variables: { roomNumber: guest.roomNumber, guestId: guest.guestId }
    } as any);

    // 楽観更新
    setAll(prev =>
      prev.map(x =>
        x.guestId === guest.guestId ? { ...x, approvalStatus: 'approved' } : x
      )
    );

    if (detail?.guestId === guest.guestId) {
      setDetail(null);
      setSignedPassportUrl(null);
    }

    window.alert(`${guest.guestName} を承認しました。`);
  } catch (e) {
    console.error('[approveGuest] failed:', e);
    alert('承認に失敗しました');
  } finally {
    setApprovingId(null);
  }
}