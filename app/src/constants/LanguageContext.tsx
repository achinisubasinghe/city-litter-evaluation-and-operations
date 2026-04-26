import React, { createContext, useContext, useState } from 'react';
import { getI18n, I18nStrings, Language } from './i18n';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: I18nStrings;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'si',
  setLang: () => {},
  t: getI18n('si'),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('si');
  const t = getI18n(lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
