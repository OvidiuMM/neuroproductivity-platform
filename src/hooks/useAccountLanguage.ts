import { useEffect, useRef } from 'react';
import type { Firestore } from 'firebase/firestore';
import { clearPendingLocale, hasPendingLocale, isLocale, LOCALE, setLocale } from '../i18n/locale';
import { saveLanguage } from '../services/repository';

// El idioma de la cuenta (users/{uid}.language), al abrir la app con el perfil ya confirmado por el servidor, una vez:
// - si en este dispositivo se eligió otro (antes de entrar o sin conexión), ese se guarda en la cuenta;
// - si no, el de la cuenta manda: si es otro, la app se vuelve a cargar en él;
// - una cuenta sin idioma guarda el de este dispositivo (el servidor lo usa para los emails).
// Solo al abrir: un cambio desde otro dispositivo no recarga esta app mientras se usa.
export const useAccountLanguage = (db: Firestore, uid: string, language: unknown, fromServer: boolean) => {
  const checked = useRef(false);
  useEffect(() => {
    if (!fromServer || checked.current) return;
    checked.current = true;
    if (hasPendingLocale() || !isLocale(language)) {
      saveLanguage(db, uid, LOCALE)
        .then(clearPendingLocale)
        .catch((e) => console.warn('Could not save the language:', e));
    } else if (language !== LOCALE) setLocale(language, { pending: false });
  }, [db, uid, language, fromServer]);
};
