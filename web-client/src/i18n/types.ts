export type Locale = 'en' | 'es';

export interface LocaleOption {
  code: Locale;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
];

export type InterpolationParams = Record<string, string | number | boolean>;

export type NestedTranslationNode = string | { [key: string]: NestedTranslationNode };
export type TranslationDictionary = Record<string, NestedTranslationNode>;

type Primitive = string | number | boolean | null | undefined;

export type DotNestedKeys<T> = T extends Primitive
  ? ''
  : {
      [K in Extract<keyof T, string>]: T[K] extends Primitive
        ? K
        : `${K}.${DotNestedKeys<T[K]>}`;
    }[Extract<keyof T, string>];

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: InterpolationParams) => string;
  supportedLocales: LocaleOption[];
}
