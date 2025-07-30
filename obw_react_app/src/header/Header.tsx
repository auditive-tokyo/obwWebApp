import { useState, useEffect, useRef } from "react";
import { setLanguage, saveLang, loadLang } from "../i18n/languageUtils";

function Header() {
  const [lang, setLang] = useState<'ja' | 'en'>('ja');
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLang = loadLang();
    if (savedLang === 'ja' || savedLang === 'en') {
      setLang(savedLang);
      setLanguage(savedLang);
    }
  }, []);

  useEffect(() => {
    if (headerRef.current) {
      document.documentElement.style.setProperty('--header-height', `${headerRef.current.offsetHeight}px`);
    }
  }, []);

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as 'ja' | 'en';
    setLang(newLang);
    setLanguage(newLang);
    saveLang(newLang);
    window.location.reload();
  };

  return (
    <header ref={headerRef} className="w-full bg-white shadow p-4 mb-4 flex justify-center items-center">
      <h1 className="text-3xl font-bold text-center">Osaka Bay Wheel WebApp</h1>
      <div className="ml-4">
        <select
          value={lang}
          onChange={handleLangChange}
          className="px-3 py-2 rounded bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 shadow-sm"
        >
          <option value="ja">🇯🇵 日本語</option>
          <option value="en">🇺🇸 English</option>
        </select>
      </div>
    </header>
  );
}

export default Header;
