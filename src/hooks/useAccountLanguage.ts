import { useEffect, useRef } from 'react';
import type { Firestore } from 'firebase/firestore';
import {
  accountLanguageSync,
  clearPendingLocale,
  hasPendingLocale,
  LOCALE,
  setLocale,
  storedLocale
} from '../i18n/locale';
import { saveLanguage } from '../services/repository';

// El idioma de la cuenta (users/{uid}.language), al abrir la app con el perfil ya confirmado por el servidor, una vez
// (ver accountLanguageSync). Un cambio desde otro dispositivo no recarga esta app mientras se usa.
// Cuándo se abrió la app (se carga con ella)
const OPENED_AT = Date.now();

export const useAccountLanguage = (db: Firestore, uid: string, language: unknown, fromServer: boolean) => {
  const checked = useRef(false);
  useEffect(() => {
    if (!fromServer || checked.current) return;
    checked.current = true;
    const sync = accountLanguageSync({
      pending: hasPendingLocale(),
      stored: storedLocale(),
      account: language,
      page: LOCALE,
      sinceOpenMs: Date.now() - OPENED_AT
    });
    if (sync.action === 'save')
      saveLanguage(db, uid, sync.language)
        .then(clearPendingLocale)
        .catch((e) => console.warn('Could not save the language:', e));
    else if (sync.action === 'adopt') setLocale(sync.language, { pending: false, reload: sync.reload });
  }, [db, uid, language, fromServer]);
};
