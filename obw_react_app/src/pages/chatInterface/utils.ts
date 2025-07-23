export const getTimestamp = () => {
  const d = new Date()
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
}

export const scrollToBottom = () => {
  const messages = document.querySelector('.messages');
  if (messages) {
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }
};

export const saveResponseId = (responseId: string) => {
  let saved = false;
  try {
    localStorage.setItem("responseId", responseId);
    saved = true;
  } catch (e) {
    try {
      document.cookie = `responseId=${responseId}; path=/; max-age=31536000`;
      saved = true;
    } catch (err) {
      const lang = document.documentElement.lang;
      if (lang === "ja") {
        alert("この機能を利用するには、ブラウザのlocalStorageまたはcookieを有効にしてください。");
      } else {
        alert("To use this feature, please enable localStorage or cookies in your browser.");
      }
    }
  }
  console.debug("Response ID saved:", responseId, "Status:", saved ? "Success" : "Failed");
};

export const loadResponseId = (): string | null => {
  // まずlocalStorageから取得
  try {
    const id = localStorage.getItem("responseId");
    if (id) return id;
  } catch (e) {
    // localStorageが使えない場合はcookieから取得
    const match = document.cookie.match(/(?:^|; )responseId=([^;]*)/);
    if (match) return match[1];
  }
  return null;
};

export const setWindowHeightCSSVar = () => {
  const vh = window.innerHeight;
  document.documentElement.style.setProperty('--window-height', `${vh}px`);
};