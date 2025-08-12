import { useState, useEffect, useRef } from "react";
import { setLanguage, saveLang, loadLang } from "../i18n/languageUtils";
import { SupportedLang } from "../i18n/messages";

function Header() {
  const [lang, setLang] = useState<SupportedLang>('en');
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLang = loadLang();
    setLang(savedLang);
    setLanguage(savedLang);
  }, []);

  useEffect(() => {
    if (headerRef.current) {
      document.documentElement.style.setProperty('--header-height', `${headerRef.current.offsetHeight}px`);
    }
  }, []);

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as SupportedLang;
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
          <option value="en">🇺🇸 EN</option>
          <option value="ja">🇯🇵 JA</option>
        </select>
      </div>
    </header>
  );
}

export default Header;
