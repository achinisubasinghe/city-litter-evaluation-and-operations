import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getTranslations,
  type DashboardTranslations,
  type Language,
} from "./translations";

const STORAGE_KEY = "cleo_web_lang";

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  t: DashboardTranslations;
}

const DEFAULT_LANG: Language = "en";

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: getTranslations(DEFAULT_LANG),
});

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ta" || stored === "si") {
      return stored;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLanguage);
  const t = getTranslations(lang);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = t.htmlLang;
      document.title = t.documentTitle;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage write errors
    }
  }, [lang, t.documentTitle, t.htmlLang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang: setLangState, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
