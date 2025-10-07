import { dbg } from '@/utils/debugLogger';

// 言語を切り替え
export function setLanguage(lang: string): void {
  document.documentElement.lang = lang;
}

// 言語を保存
// localStorageに保存できない場合はCookieに保存
export const saveLang = (lang: string) => {
  let saved = false;
  try {
    localStorage.setItem("lang", lang);
    saved = true;
  } catch {
    try {
      document.cookie = `lang=${lang}; path=/; max-age=31536000`;
      saved = true;
    } catch {
      alert("Failed to save language preference. LocalStorage or Cookies may be disabled.");
    }
  }
  dbg("Lang saved:", lang, "Status:", saved ? "Success" : "Failed");
};

// 言語を読み込む
// localStorageから取得できない場合はCookieから取得
export const loadLang = (): "ja" | "en" => {
  try {
    const lang = localStorage.getItem("lang");
    if (lang === "ja" || lang === "en") return lang;
  } catch {
    const match = document.cookie.match(/(?:^|; )lang=(ja|en)/);
    if (match) return match[1] as "ja" | "en";
  }
  return "en"; // ← デフォルトを英語に
};