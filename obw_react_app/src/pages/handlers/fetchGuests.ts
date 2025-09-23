import { getCurrentUser } from 'aws-amplify/auth';
import type { Guest } from '../adminpage/types/types';
import { dbg } from '@/utils/debugLogger';

type Deps = {
  client: any;
  setAll: React.Dispatch<React.SetStateAction<Guest[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
};

const query = `
  query ListGuests {
    listGuests {
      roomNumber
      guestId
      guestName
      approvalStatus
      checkInDate
      checkOutDate
      bookingId
      email
      phone
      address
      occupation
      nationality
      passportImageUrl
    }
  }
`;

export async function fetchGuests({
  client,
  setAll,
  setLoading,
  setError
}: Deps) {
  dbg('fetchGuests start');
  setLoading(true);
  setError(null);
  try {
    await getCurrentUser()
      .then(u => dbg('current user OK:', u))
      .catch(e => { dbg('getCurrentUser failed:', e); throw e; });

    dbg('calling listGuests (userPool)');
    const res = await client.graphql({ query } as any);
    const payload: any = 'data' in res ? (res as any).data?.listGuests : null;
    const items: any[] = Array.isArray(payload) ? payload : [];
    dbg('listGuests payload:', payload);
    dbg('items length:', items?.length);
    setAll((items || []).filter(Boolean));
  } catch (e: any) {
    console.error('[fetchGuests] failed:', e);
    setError(e?.message || 'Failed to load');
  } finally {
    setLoading(false);
    dbg('fetchGuests end');
  }
}