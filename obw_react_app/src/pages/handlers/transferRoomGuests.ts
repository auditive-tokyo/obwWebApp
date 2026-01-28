import type { GraphQLResult } from '@aws-amplify/api-graphql';
import type { V6Client } from '@aws-amplify/api-graphql';
import { dbg } from '@/utils/debugLogger';

interface TransferRoomGuestsInput {
  oldRoomNumber: string;
  newRoomNumber: string;
  bookingIds?: string[];  // 複数のbookingIdに対応
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
  bookingIds?: string[];  // 複数のbookingIdに対応
  onSuccess?: (result: TransferRoomResult) => void;
  onError?: (error: Error) => void;
}

/**
 * GraphQLResultからエラーメッセージを抽出
 */
function extractGraphQLErrors(result: GraphQLResult<unknown>): string | null {
  if (!result.errors || result.errors.length === 0) return null;
  return result.errors.map(e => e.message || 'Unknown error').join(', ');
}

/**
 * 不明なエラーオブジェクトからGraphQLエラーを抽出
 */
function extractErrorFromUnknown(error: unknown): Error {
  // GraphQL エラーレスポンスの可能性をチェック
  if (error && typeof error === 'object' && 'errors' in error) {
    const graphqlError = error as { errors?: Array<{ message?: string }> };
    if (graphqlError.errors && graphqlError.errors.length > 0) {
      const errorMessages = graphqlError.errors
        .map(e => e.message || 'Unknown error')
        .join(', ');
      return new Error(errorMessages);
    }
  }
  
  if (error instanceof Error) return error;
  return new Error('不明なエラーが発生しました');
}

/**
 * レスポンスデータを検証してTransferRoomResultを返す
 */
function validateTransferResult(
  data: TransferRoomResult | undefined
): TransferRoomResult {
  if (!data) {
    throw new Error('レスポンスデータが取得できませんでした');
  }
  if (!data.success) {
    throw new Error(data.message || '部屋移動に失敗しました');
  }
  return data;
}

/**
 * エラーハンドリング（onErrorがあれば呼び出し、なければthrow）
 */
function handleError(error: Error, onError?: (error: Error) => void): void {
  console.error('❌ 部屋移動失敗:', error.message);
  if (onError) {
    onError(error);
  } else {
    throw error;
  }
}

export async function transferRoomGuests({
  client,
  oldRoomNumber,
  newRoomNumber,
  bookingIds,
  onSuccess,
  onError
}: TransferRoomGuestsParams): Promise<void> {
  try {
    dbg(`🔄 部屋移動開始: ${oldRoomNumber} → ${newRoomNumber}`, bookingIds ? `bookingIds: ${bookingIds.join(', ')}` : 'all guests');

    const variables: { input: TransferRoomGuestsInput } = {
      input: {
        oldRoomNumber,
        newRoomNumber,
        ...(bookingIds && bookingIds.length > 0 && { bookingIds })
      }
    };

    const result = await client.graphql({
      query: transferRoomGuestsMutation,
      variables
    }) as GraphQLResult<{ transferRoomGuests: TransferRoomResult }>;

    const graphqlErrorMessage = extractGraphQLErrors(result);
    if (graphqlErrorMessage) {
      throw new Error(graphqlErrorMessage);
    }

    const data = validateTransferResult(result.data?.transferRoomGuests);
    dbg(`✅ 部屋移動成功: ${data.transferredCount}件のゲストを移動しました`);
    
    if (onSuccess) {
      onSuccess(data);
    }
  } catch (error) {
    const finalError = extractErrorFromUnknown(error);
    handleError(finalError, onError);
  }
}
