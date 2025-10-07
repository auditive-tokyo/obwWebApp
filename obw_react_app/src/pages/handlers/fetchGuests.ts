import { getCurrentUser } from 'aws-amplify/auth';
import type { Guest } from '../adminpage/types/types';
import { dbg } from '@/utils/debugLogger';
import type { Client } from 'aws-amplify/api'

type GraphParams = Parameters<Client['graphql']>[0]
type GraphqlResponse<T = unknown> = { data?: T }

const queryByRoom = `
  query ListGuestsByRoom($roomNumber: String!) {
    listGuestsByRoom(roomNumber: $roomNumber) {
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
      currentLocation
    }
  }
`;

const queryByStatus = `
  query ListGuestsByApprovalStatus($approvalStatus: String!) {
    listGuestsByApprovalStatus(approvalStatus: $approvalStatus) {
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
      currentLocation
    }
  }
`;

type FetchParams = {
  client: Client;
  setAll: React.Dispatch<React.SetStateAction<Guest[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  roomFilter?: string;      // 部屋番号フィルター
  statusFilter?: string;    // 承認状態フィルター
};

export async function fetchGuests({
  client,
  setAll,
  setLoading,
  setError,
  roomFilter,
  statusFilter
}: FetchParams) {
  dbg('fetchGuests start:', { roomFilter, statusFilter });
  setLoading(true);
  setError(null);
  
  try {
    await getCurrentUser()
      .then(u => dbg('current user OK:', u))
      .catch(e => { dbg('getCurrentUser failed:', e); throw e; });

    let items: Guest[] = [];

    // 効率的なクエリ選択ロジック
    if (roomFilter && statusFilter) {
      // 両方指定: 部屋で絞り込み + クライアント側で状態フィルター
      dbg('Using room query with client-side status filter');
      const res = await client.graphql({ 
        query: queryByRoom,
        variables: { roomNumber: roomFilter }
      } as GraphParams);
      const resObj = res as unknown as GraphqlResponse<{ listGuestsByRoom?: unknown[] }>
      const roomItems = (resObj.data?.listGuestsByRoom ?? []) as unknown[]
      items = roomItems.map(i => i as unknown as Guest).filter(g => g.approvalStatus === statusFilter)
      
    } else if (roomFilter && !statusFilter) {
      // 部屋のみ指定: 部屋クエリのみ
      dbg('Using room query only');
      const res = await client.graphql({ 
        query: queryByRoom,
        variables: { roomNumber: roomFilter }
      } as GraphParams);
      const resObj = res as unknown as GraphqlResponse<{ listGuestsByRoom?: unknown[] }>
      const roomItems = (resObj.data?.listGuestsByRoom ?? []) as unknown[]
      items = roomItems.map(i => i as unknown as Guest)
      
    } else if (!roomFilter && statusFilter) {
      // 状態のみ指定: 状態クエリのみ
      dbg('Using status query only');
      const res = await client.graphql({ 
        query: queryByStatus,
        variables: { approvalStatus: statusFilter }
      } as GraphParams);
      const resObj = res as unknown as GraphqlResponse<{ listGuestsByApprovalStatus?: unknown[] }>
      const statusItems = (resObj.data?.listGuestsByApprovalStatus ?? []) as unknown[]
      items = statusItems.map(i => i as unknown as Guest)
      
    } else {
      // 両方とも未指定: 全ステータスを並列取得
      dbg('Both filters empty - fetching all statuses');
      
      const statuses = ['pending', 'approved', 'rejected', 'waitingForBasicInfo', 'waitingForPassportImage'];
      
      // 並列実行で高速化 - async/await を使って client.graphql の返り値の形に依存しない
      const promises: Promise<unknown[]>[] = statuses.map(async (status) => {
        try {
          const res = await client.graphql({
            query: queryByStatus,
            variables: { approvalStatus: status }
          } as GraphParams);
          const obj = res as unknown as GraphqlResponse<{ listGuestsByApprovalStatus?: unknown[] }>;
          return (obj.data?.listGuestsByApprovalStatus ?? []) as unknown[];
        } catch (err: unknown) {
          dbg(`Failed to fetch ${status}:`, err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      const flat: unknown[] = results.flat();
      items = flat.map((i: unknown) => i as Guest);

      // TODO: 過去30日分のデータのみに絞り込みを追加
      // 現在: 全期間のデータを取得（古いデータも含む）
      // 予定: チェックイン日が過去30日以内のレコードのみに限定して取得レコード数を削減
      /*
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
      
      items = items.filter(g => g.checkInDate >= dateFilter);
      */
    }

    dbg('Fetched items:', items?.length);
    setAll((items || []).filter(Boolean));
    
  } catch (e: unknown) {
    console.error('[fetchGuests] failed:', e);
    const message = typeof e === 'string' ? e : (e instanceof Error ? e.message : 'Failed to load');
    setError(message);
  } finally {
    setLoading(false);
    dbg('fetchGuests end');
  }
}