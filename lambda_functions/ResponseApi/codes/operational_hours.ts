import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const CACHE_TTL_MS = 60 * 1000;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE_NAME ?? "obw-settings";

export interface OperationalHours {
  start: number;
  end: number;
}

const DEFAULT_HOURS: OperationalHours = { start: 9, end: 21 };

let cachedHours: OperationalHours | null = null;
let cacheExpiresAt = 0;

const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

export async function getOperationalHours(): Promise<OperationalHours> {
  const now = Date.now();
  if (cachedHours !== null && now < cacheExpiresAt) {
    return cachedHours;
  }

  try {
    const result = await dynamodb.send(
      new GetItemCommand({
        TableName: SETTINGS_TABLE,
        Key: { settingKey: { S: "OPERATIONAL_HOURS" } },
      }),
    );

    if (result.Item?.startHour?.N && result.Item?.endHour?.N) {
      cachedHours = {
        start: Number.parseInt(result.Item.startHour.N, 10),
        end: Number.parseInt(result.Item.endHour.N, 10),
      };
    } else {
      cachedHours = DEFAULT_HOURS;
    }
  } catch (err) {
    console.warn("⚠️ 稼働時間の取得に失敗、デフォルト値を使用:", err);
    cachedHours = DEFAULT_HOURS;
  }

  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedHours;
}
