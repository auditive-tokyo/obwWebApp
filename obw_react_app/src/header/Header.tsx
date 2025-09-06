import { useState, useEffect, useRef } from "react";
import { setLanguage, saveLang, loadLang } from "@/i18n/languageUtils";
import { SupportedLang } from "@/i18n/messages";

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
      <div className="ml-4 relative">
        <select
          value={lang}
          onChange={handleLangChange}
          className="appearance-none px-2 pr-5 py-1 rounded-full bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 shadow-sm"
        >
          <option value="en">🇺🇸 EN</option>
          <option value="ja">🇯🇵 JA</option>
        </select>
        {/* カスタム矢印 */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">▾</span>
      </div>
    </header>
  );
}

export default Header;
