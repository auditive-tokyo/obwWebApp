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
  roomFilter?: string;           // 部屋番号フィルター
  statusFilter?: string | string[];  // 承認状態フィルター（単一または複数）
};

/**
 * 複数のステータスを並列でクエリして結果をマージ
 */
async function fetchByStatuses(
  client: Client,
  statuses: string[],
): Promise<Guest[]> {
  const promises = statuses.map(async (status) => {
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
  return results.flat().map((i: unknown) => i as Guest);
}

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

    // statusFilter を配列に正規化
    const statusFilters = Array.isArray(statusFilter) 
      ? statusFilter 
      : statusFilter 
        ? [statusFilter] 
        : [];

    // 効率的なクエリ選択ロジック
    if (roomFilter && statusFilters.length > 0) {
      // 両方指定: 部屋で絞り込み + クライアント側で状態フィルター
      dbg('Using room query with client-side status filter');
      const res = await client.graphql({ 
        query: queryByRoom,
        variables: { roomNumber: roomFilter }
      } as GraphParams);
      const resObj = res as unknown as GraphqlResponse<{ listGuestsByRoom?: unknown[] }>
      const roomItems = (resObj.data?.listGuestsByRoom ?? []) as unknown[]
      items = roomItems.map(i => i as unknown as Guest).filter(g => statusFilters.includes(g.approvalStatus || ''))
      
    } else if (roomFilter && statusFilters.length === 0) {
      // 部屋のみ指定: 部屋クエリのみ
      dbg('Using room query only');
      const res = await client.graphql({ 
        query: queryByRoom,
        variables: { roomNumber: roomFilter }
      } as GraphParams);
      const resObj = res as unknown as GraphqlResponse<{ listGuestsByRoom?: unknown[] }>
      const roomItems = (resObj.data?.listGuestsByRoom ?? []) as unknown[]
      items = roomItems.map(i => i as unknown as Guest)
      
    } else if (!roomFilter && statusFilters.length > 0) {
      // 状態のみ指定: 複数の状態を並列取得
      dbg('Using status query for selected statuses:', statusFilters);
      items = await fetchByStatuses(client, statusFilters);
      
    } else {
      // 両方とも未指定: 全ステータスを並列取得
      dbg('Both filters empty - fetching all statuses');
      
      const statuses = ['pending', 'approved', 'rejected', 'waitingForBasicInfo', 'waitingForPassportImage'];
      items = await fetchByStatuses(client, statuses);

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