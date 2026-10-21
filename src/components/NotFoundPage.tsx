import React from 'react';
import { BRAND_NAME, BrandMark } from './BrandMark';
import { LegalLinks } from './LegalLinks';

// Una dirección que no existe en CLAR (Hosting sirve la app para cualquiera): lo dice y lleva a la app
const NotFoundPage: React.FC = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 antialiased">
    {/* Hosting la sirve con estado 200: que los buscadores no la indexen (React la lleva al <head>) */}
    <meta name="robots" content="noindex" />
    <div className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
      <div className="flex justify-center">
        <BrandMark size={56} />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Esta dirección no existe en {BRAND_NAME}. Puede que el enlace esté mal escrito o sea antiguo.
      </p>
      <a
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800"
      >
        Ir a {BRAND_NAME}
      </a>
      <LegalLinks />
    </div>
  </main>
);

export default NotFoundPage;
