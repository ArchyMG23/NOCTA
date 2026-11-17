import React, { createContext, useContext, useEffect, useState } from 'react';
import { TRANSLATIONS } from './translations';
import type { Language } from '../types/nocta';

interface I18nContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  t: (typeof TRANSLATIONS)['fr'] | (typeof TRANSLATIONS)['en'];
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const LANG_STORAGE_KEY = 'nocta_preferred_lang';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'fr') return saved;
    } catch {
      // ignore storage errors
    }
    return 'fr';
  });

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    document.documentElement.lang = next;
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider
      value={{
        lang,
        setLang,
        t: TRANSLATIONS[lang],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
