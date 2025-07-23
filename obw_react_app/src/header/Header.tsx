import { useState, useEffect } from "react";
import { setLanguage, saveLang, loadLang } from "../i18n/languageUtils";

function Header() {
  const [lang, setLang] = useState<'ja' | 'en'>('ja');

  useEffect(() => {
    const savedLang = loadLang();
    if (savedLang === 'ja' || savedLang === 'en') {
      setLang(savedLang);
      setLanguage(savedLang);
    }
  }, []);

  const handleLangChange = (newLang: 'ja' | 'en') => {
    setLang(newLang);
    setLanguage(newLang);
    saveLang(newLang);
    window.location.reload();
  };

  return (
    <header className="w-full bg-white shadow p-4 mb-4 flex justify-center items-center">
      <h1 className="text-3xl font-bold text-center">Osaka Bay Wheel WebApp</h1>
      <div className="ml-4 flex gap-2">
        <button
          onClick={() => handleLangChange('ja')}
          className={`px-2 py-1 rounded ${lang === 'ja' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          日本語
        </button>
        <button
          onClick={() => handleLangChange('en')}
          className={`px-2 py-1 rounded ${lang === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          English
        </button>
      </div>
    </header>
  );
}

export default Header;
