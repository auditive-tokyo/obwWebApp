import type { GraphQLResult } from '@aws-amplify/api-graphql';
import type { V6Client } from '@aws-amplify/api-graphql';

interface TransferRoomGuestsInput {
  oldRoomNumber: string;
  newRoomNumber: string;
}

interface TransferRoomResult {
  success: boolean;
  transferredCount: number;
  message?: string;
}

const transferRoomGuestsMutation = /* GraphQL */ `
  mutation TransferRoomGuests($input: TransferRoomInput!) {
    transferRoomGuests(input: $input) {
      success
      transferredCount
      message
    }
  }
`;

interface TransferRoomGuestsParams {
  client: V6Client<never>;
  oldRoomNumber: string;
  newRoomNumber: string;
  onSuccess?: (result: TransferRoomResult) => void;
  onError?: (error: Error) => void;
}

export async function transferRoomGuests({
  client,
  oldRoomNumber,
  newRoomNumber,
  onSuccess,
  onError
}: TransferRoomGuestsParams): Promise<void> {
  try {
    console.log(`🔄 部屋移動開始: ${oldRoomNumber} → ${newRoomNumber}`);

    const variables: { input: TransferRoomGuestsInput } = {
      input: {
        oldRoomNumber,
        newRoomNumber
      }
    };

    const result = await client.graphql({
      query: transferRoomGuestsMutation,
      variables
    }) as GraphQLResult<{ transferRoomGuests: TransferRoomResult }>;

    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);
      throw new Error(result.errors[0]?.message || '部屋移動に失敗しました');
    }

    const data = result.data?.transferRoomGuests;
    if (!data) {
      throw new Error('レスポンスデータが取得できませんでした');
    }

    if (!data.success) {
      throw new Error(data.message || '部屋移動に失敗しました');
    }

    console.log(`✅ 部屋移動成功: ${data.transferredCount}件のゲストを移動しました`);
    
    if (onSuccess) {
      onSuccess(data);
    }
  } catch (error) {
    console.error('❌ 部屋移動エラー:', error);
    if (onError) {
      onError(error instanceof Error ? error : new Error('不明なエラーが発生しました'));
    } else {
      throw error;
    }
  }
}
