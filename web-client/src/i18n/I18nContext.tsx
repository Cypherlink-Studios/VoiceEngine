import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Locale, SUPPORTED_LOCALES, InterpolationParams, I18nContextValue } from './types.js';
import { en, Translations } from './locales/en.js';
import { es } from './locales/es.js';

const STORAGE_KEY = 'voiceengine:language';

const dictionaries: Record<Locale, Translations> = {
  en,
  es,
};

function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';

  try {
    // 1. URL Query Parameter (?lang=es / ?lang=en / ?lang=es_ES)
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang')?.toLowerCase().trim();
    if (urlLang) {
      if (urlLang.startsWith('es')) {
        localStorage.setItem(STORAGE_KEY, 'es');
        return 'es';
      }
      if (urlLang.startsWith('en')) {
        localStorage.setItem(STORAGE_KEY, 'en');
        return 'en';
      }
    }

    // 2. User preference in localStorage
    const saved = localStorage.getItem(STORAGE_KEY)?.toLowerCase().trim();
    if (saved === 'es' || saved === 'en') {
      return saved;
    }

    // 3. Browser language
    const browserLang = (navigator.language || (navigator as { languages?: readonly string[] }).languages?.[0] || '').toLowerCase();
    if (browserLang.startsWith('es')) {
      return 'es';
    }
  } catch {
    // Ignore storage/navigation access errors
  }

  // 4. Default Fallback
  return 'en';
}

function resolveNestedValue(dict: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = dict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: InterpolationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // Ignore local storage quota or privacy mode errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string, params?: InterpolationParams): string => {
      const activeDict = dictionaries[locale] as unknown as Record<string, unknown>;
      let rawText = resolveNestedValue(activeDict, key);

      // Fallback to English if missing or incomplete in active locale
      if (rawText === undefined && locale !== 'en') {
        const enDict = dictionaries.en as unknown as Record<string, unknown>;
        rawText = resolveNestedValue(enDict, key);
      }

      // If key doesn't exist anywhere, return key itself as safety
      if (rawText === undefined) {
        return key;
      }

      return interpolate(rawText, params);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an <I18nProvider>');
  }
  return context;
}
