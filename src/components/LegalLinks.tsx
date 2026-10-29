import React from 'react';
import { LEGAL_PAGES, legalPath } from '../services/legal';
import { messages } from '../i18n/locale';

const m = messages(
  { legal: 'Textos legales', newTab: '(se abre en otra pestaña)' },
  { legal: 'Legal information', newTab: '(opens in a new tab)' }
);

// Dentro de la app, los textos legales se abren en otra pestaña para no salir de ella
const tabProps = (newTab: boolean) => (newTab ? { target: '_blank', rel: 'noopener' } : {});

const linkClass = 'font-semibold text-indigo-700 underline hover:text-indigo-900';

// Enlaces a los tres textos legales, para el pie de cada pantalla
export const LegalLinks: React.FC<{ newTab?: boolean; className?: string }> = ({ newTab = false, className = '' }) => (
  <nav aria-label={m.legal} className={className}>
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px]">
      {LEGAL_PAGES.map((page) => (
        <li key={page.id}>
          <a href={page.path} {...tabProps(newTab)} className="text-slate-600 underline hover:text-slate-900">
            {page.title}
            {newTab && <span className="sr-only"> {m.newTab}</span>}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);

// Un texto legal dentro de una frase
export const LegalLink: React.FC<{
  to: Parameters<typeof legalPath>[0];
  newTab?: boolean;
  children: React.ReactNode;
}> = ({ to, newTab = false, children }) => (
  <a href={legalPath(to)} {...tabProps(newTab)} className={linkClass}>
    {children}
    {newTab && <span className="sr-only"> {m.newTab}</span>}
  </a>
);
