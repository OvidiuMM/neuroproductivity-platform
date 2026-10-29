import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { BRAND_NAME, BRAND_TAGLINE } from './BrandMark';
import { messages } from '../i18n/locale';

const m = messages(
  {
    share: 'Compartir CLAR',
    copied: 'Enlace copiado: pégalo donde quieras compartirlo.',
    failed: (url: string) => `No se pudo compartir. El enlace es ${url}`
  },
  {
    share: 'Share CLAR',
    copied: 'Link copied: paste it wherever you want to share it.',
    failed: (url) => `Couldn't share. The link is ${url}`
  }
);

// COMPARTIR CLAR: el menú de compartir del dispositivo (navigator.share) o, donde no lo hay, copiar el enlace. Comparte
// la dirección de la app (en producción, https://clar.life)
export const ShareAppButton: React.FC<{ className: string }> = ({ className }) => {
  const [status, setStatus] = useState<string | null>(null);
  const share = async () => {
    const url = window.location.origin;
    setStatus(null);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: BRAND_NAME, text: `${BRAND_NAME}: ${BRAND_TAGLINE}.`, url });
        return;
      }
    } catch (error) {
      // Cerrar el menú de compartir no es un error; si falla por otra cosa, se copia el enlace
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus(m.copied);
    } catch {
      setStatus(m.failed(url));
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => {
          share().catch(() => undefined);
        }}
        className={className}
      >
        <Share2 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        {m.share}
      </button>
      {/* Siempre en la página, también vacío: así los lectores de pantalla anuncian el mensaje al aparecer */}
      <p role="status" className="text-[11px] text-slate-600">
        {status}
      </p>
    </>
  );
};
