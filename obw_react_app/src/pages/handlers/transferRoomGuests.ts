import type { GraphQLResult } from '@aws-amplify/api-graphql';
import type { V6Client } from '@aws-amplify/api-graphql';
import { dbg } from '@/utils/debugLogger';

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
    dbg(`🔄 部屋移動開始: ${oldRoomNumber} → ${newRoomNumber}`);

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

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map(e => e.message || 'Unknown error').join(', ');
      console.error('❌ 部屋移動失敗 (GraphQL errors):', errorMessage);
      throw new Error(errorMessage);
    }

    const data = result.data?.transferRoomGuests;
    if (!data) {
      throw new Error('レスポンスデータが取得できませんでした');
    }

    if (!data.success) {
      console.error('❌ 部屋移動失敗:', data.message);
      throw new Error(data.message || '部屋移動に失敗しました');
    }

    dbg(`✅ 部屋移動成功: ${data.transferredCount}件のゲストを移動しました`);
    
    if (onSuccess) {
      onSuccess(data);
    }
  } catch (error) {
    // GraphQL エラーレスポンスの可能性をチェック
    if (error && typeof error === 'object' && 'errors' in error) {
      const graphqlError = error as { errors?: Array<{ message?: string }> };
      if (graphqlError.errors && graphqlError.errors.length > 0) {
        const errorMessages = graphqlError.errors
          .map(e => e.message || 'Unknown error')
          .join(', ');
        console.error('❌ 部屋移動失敗 (onError):', errorMessages);
        const finalError = new Error(errorMessages);
        if (onError) {
          onError(finalError);
        } else {
          throw finalError;
        }
        return;
      }
    }
    
    console.error('❌ 部屋移動失敗 (catch):', error instanceof Error ? error.message : String(error));
    
    if (onError) {
      onError(error instanceof Error ? error : new Error('不明なエラーが発生しました'));
    } else {
      throw error;
    }
  }
}
