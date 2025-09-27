'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ru' | 'uz';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'app-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('ru'); // Default language

  useEffect(() => {
    const getLang = () => {
      window.Telegram.WebApp.CloudStorage.getItem(LANGUAGE_STORAGE_KEY, (err, value) => {
        if (err) {
          console.error('Error getting lang from cloud storage', err);
          return;
        }
        if (value === 'ru' || value === 'uz') {
          setLang(value as Language);
        }
      });
    };
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
      getLang();
    }
  }, []);

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
      window.Telegram.WebApp.CloudStorage.setItem(LANGUAGE_STORAGE_KEY, newLang, (err) => {
        if (err) {
          console.error('Error setting lang in cloud storage', err);
        }
      });
    }
  };

  const value = { lang, setLang: setLanguage };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
