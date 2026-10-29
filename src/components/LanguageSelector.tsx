import React from 'react';
import { Languages } from 'lucide-react';
import { LOCALE, LOCALE_NAMES, LOCALES, setLocale } from '../i18n/locale';

// «Español / English»: cambia el idioma de la app (y la vuelve a cargar). El nombre del grupo va en los dos idiomas,
// para que lo entienda quien no lee el que está puesto
export const LanguageSelector: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div role="group" aria-label="Idioma · Language" className={`inline-flex items-center gap-1 ${className}`}>
    <Languages className="h-4 w-4 text-slate-500" aria-hidden="true" />
    {LOCALES.map((locale) => (
      <button
        key={locale}
        type="button"
        lang={locale}
        aria-pressed={locale === LOCALE}
        onClick={() => setLocale(locale)}
        className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
          locale === LOCALE ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        {LOCALE_NAMES[locale]}
      </button>
    ))}
  </div>
);
