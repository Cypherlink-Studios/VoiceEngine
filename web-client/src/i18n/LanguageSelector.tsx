import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from './I18nContext.js';

export interface LanguageSelectorProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function LanguageSelector({ variant = 'compact', className = '' }: LanguageSelectorProps) {
  const { locale, setLocale, supportedLocales } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (variant === 'full') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
        {supportedLocales.map((loc) => {
          const isSelected = locale === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => setLocale(loc.code)}
              className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                isSelected
                  ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-white'
                  : 'bg-slate-900/60 border-white/10 hover:border-white/20 text-slate-300 hover:text-white'
              }`}
            >
              <span className="text-2xl select-none leading-none">{loc.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center justify-between">
                  <span>{loc.nativeLabel}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </div>
                <div className="text-xs text-slate-400 truncate">{loc.label}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant (header / dock pill with dropdown)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm cursor-pointer"
        title={locale === 'es' ? 'Cambiar idioma / Change language' : 'Change language / Cambiar idioma'}
      >
        <Globe className="w-3.5 h-3.5 text-indigo-400" />
        <span className="uppercase tracking-wider font-mono text-[11px]">{locale}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 py-1 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {supportedLocales.map((loc) => {
            const isSelected = locale === loc.code;
            return (
              <button
                key={loc.code}
                type="button"
                onClick={() => {
                  setLocale(loc.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base select-none leading-none">{loc.flag}</span>
                  <span>{loc.nativeLabel}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
