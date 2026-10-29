import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BRAND_NAME, BrandMark } from './BrandMark';
import { LegalNotice, PrivacyPolicy, TermsOfUse } from './LegalTexts';
import { LEGAL_PAGES, LEGAL_UPDATED_LABEL, type LegalPageId } from '../services/legal';
import { messages } from '../i18n/locale';

const m = messages(
  {
    nav: 'Textos legales',
    updated: (date: string) => `Última actualización: ${date}`,
    back: (brand: string) => `Volver a ${brand}`
  },
  {
    nav: 'Legal information',
    updated: (date) => `Last updated: ${date}`,
    back: (brand) => `Back to ${brand}`
  }
);

const CONTENT: Record<LegalPageId, React.FC> = { privacy: PrivacyPolicy, terms: TermsOfUse, notice: LegalNotice };

// Página legal pública (/privacidad, /condiciones, /aviso-legal): se ve sin iniciar sesión y sin cargar Firebase
const LegalPage: React.FC<{ page: LegalPageId }> = ({ page }) => {
  const current = LEGAL_PAGES.find((p) => p.id === page)!;
  const Content = CONTENT[page];
  useEffect(() => {
    document.title = `${current.title} · ${BRAND_NAME}`;
  }, [current.title]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 font-bold text-slate-900">
            <BrandMark size={28} />
            <span className="tracking-[0.2em]">{BRAND_NAME}</span>
          </a>
          <nav aria-label={m.nav}>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
              {LEGAL_PAGES.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.path}
                    aria-current={p.id === page ? 'page' : undefined}
                    className={
                      p.id === page
                        ? 'text-slate-900 underline decoration-2 underline-offset-4'
                        : 'text-indigo-700 hover:text-indigo-900'
                    }
                  >
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-8 text-sm leading-relaxed text-slate-700 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">{current.title}</h1>
        <p className="text-xs text-slate-600">{m.updated(LEGAL_UPDATED_LABEL)}</p>
        <Content />
        <p className="pt-8">
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {m.back(BRAND_NAME)}
          </a>
        </p>
      </main>
    </div>
  );
};

export default LegalPage;
