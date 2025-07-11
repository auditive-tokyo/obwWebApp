// 現在の言語を取得
export function getCurrentLanguage(): string {
  // htmlタグのlang属性を優先
  const htmlLang = document.documentElement.lang;
  if (htmlLang) return htmlLang;
  // なければブラウザの言語
  return navigator.language || 'en';
}

// 言語を切り替え
export function setLanguage(lang: string): void {
  document.documentElement.lang = lang;
}
