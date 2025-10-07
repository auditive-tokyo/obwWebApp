import { dbg } from '@/utils/debugLogger'

/**
 * 現在時刻（HH:mm形式）を返す
 */
export const getTimestamp = () => {
  const d = new Date()
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
}

/**
 * メッセージ一覧（.messages）を一番下までスクロールする
 */
export const scrollToBottom = () => {
  const messages = document.querySelector('.messages');
  if (messages) {
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }
};

/**
 * レスポンスIDをlocalStorageまたはcookieに保存する
 * 保存できない場合はアラート表示
 */
export const saveResponseId = (responseId: string) => {
  let saved = false;
  try {
    localStorage.setItem("responseId", responseId);
    saved = true;
  } catch {
    try {
      document.cookie = `responseId=${responseId}; path=/; max-age=31536000`;
      saved = true;
    } catch {
      const lang = document.documentElement.lang;
      if (lang === "ja") {
        alert("この機能を利用するには、ブラウザのlocalStorageまたはcookieを有効にしてください。");
      } else {
        alert("To use this feature, please enable localStorage or cookies in your browser.");
      }
    }
  }
  dbg("Response ID saved:", responseId, "Status:", saved ? "Success" : "Failed");
};

/**
 * レスポンスIDをlocalStorageまたはcookieから取得する
 * 取得できない場合はnullを返す
 */
export const loadResponseId = (): string | null => {
  // まずlocalStorageから取得
  try {
    const id = localStorage.getItem("responseId");
    if (id) return id;
  } catch {
    // localStorageが使えない場合はcookieから取得
    const match = document.cookie.match(/(?:^|; )responseId=([^;]*)/);
    if (match) return match[1];
  }
  return null;
};