/**
 * チャットメッセージの型定義
 * - id: メッセージの一意なID
 * - text: メッセージ本文（文字列またはAI応答オブジェクト）
 * - personal: ユーザーのメッセージかどうか
 * - loading: AI応答中かどうか（オプション）
 * - timestamp: メッセージの送信時刻（オプション）
 */
export type Message = {
  id: number;
  text: string | { assistant_response_text: string; reference_files?: string[] };
  personal: boolean;
  loading?: boolean;
  timestamp?: string;
  images?: string[];
};

/**
 * 部屋IDを渡すための共通props型
 * - roomId: 部屋番号（例: "201", "304"）
 */
export type RoomProps = {
  roomId: string;
};