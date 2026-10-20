// NOVEDADES DE CADA VERSIÓN, contadas para quien usa la app (los detalles técnicos están en el README). Al publicar una
// versión se añade su entrada al principio, con la misma versión que package.json (tests/unit/releaseNotes.test.ts lo
// comprueba). Al entrar después de una actualización, cada cuenta ve una vez las de su versión; todas están en la Ayuda.

export interface ReleaseChange {
  title: string;
  text: string;
}

export interface ReleaseNote {
  version: string;
  // Cuándo salió, para mostrarlo (p. ej. «octubre de 2026»)
  month: string;
  changes: ReleaseChange[];
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '0.9.6',
    month: 'octubre de 2026',
    changes: [
      {
        title: 'Alarmas con CLAR cerrada',
        text: 'Con «Avisarme también con CLAR cerrada», en el menú de tu cuenta, las alarmas te llegan aunque la app esté cerrada o el móvil bloqueado. Se activa en cada dispositivo, y la notificación solo lleva el nombre de la tarea si lo pides.'
      },
      {
        title: 'Proyectos, cuando te ayuden',
        text: 'La bienvenida, el recorrido guiado y la ayuda presentan los proyectos como lo que son: una forma opcional de agrupar tareas relacionadas de una meta, o de una parte de ella. Una meta puede no tener ninguno, o tener uno o varios.'
      },
      {
        title: 'Funciones extra',
        text: 'La administración puede activar en tu cuenta funciones adicionales. Si tienes alguna, la verás en el menú de tu cuenta, en «Funciones extra».'
      },
      {
        title: 'Tus tareas en Google Calendar',
        text: 'La primera función extra: conecta tu cuenta de Google y tus tareas con fecha aparecen solas en un calendario «CLAR», y se actualizan al cambiarlas. CLAR no ve ni cambia tus otros calendarios.'
      },
      {
        title: 'Importar sin perder nada',
        text: 'Al importar una descarga, un registro con un texto más largo de lo permitido cuenta como no válido en lugar de recortarse: nada se pierde sin avisarte.'
      },
      {
        title: 'Privacidad al día',
        text: 'La política de privacidad explica las alarmas con CLAR cerrada y la sincronización con Google Calendar.'
      },
      {
        title: 'Esta ventana',
        text: 'Desde ahora, cada versión te cuenta sus novedades al entrar. Las tienes todas en la Ayuda, y también al pulsar el número de versión.'
      }
    ]
  }
];

export const releaseFor = (version: string) => RELEASE_NOTES.find((r) => r.version === version) ?? null;

const VERSION = /^\d+(\.\d+)*$/;

// Compara dos versiones numéricas (0.9.10 va después de 0.9.6): negativo, cero o positivo
export const compareVersions = (a: string, b: string) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
};

const hasSeen = (seen: unknown, current: string) =>
  typeof seen === 'string' && VERSION.test(seen) && compareVersions(seen, current) >= 0;

// Si al entrar toca enseñar las novedades de esta versión: tiene entrada, la cuenta ya pasó la bienvenida (las nuevas
// empiezan por ella, que las da por vistas) y no las ha visto, ni según su perfil ni en este dispositivo
export const shouldShowReleaseNotes = ({
  current,
  onboarded,
  seenInProfile,
  seenHere
}: {
  current: string;
  onboarded: boolean;
  seenInProfile: unknown;
  seenHere: unknown;
}) => Boolean(releaseFor(current)) && onboarded && !hasSeen(seenInProfile, current) && !hasSeen(seenHere, current);

// Copia en este dispositivo de la última versión cuyas novedades se vieron: así no se repiten sin conexión ni antes de
// que llegue el perfil
const localKey = (uid: string) => `clar_release_notes:${uid}`;

export const seenReleaseLocally = (uid: string, storage: Storage = localStorage) => {
  try {
    return storage.getItem(localKey(uid));
  } catch {
    return null;
  }
};

export const rememberReleaseLocally = (uid: string, version: string, storage: Storage = localStorage) => {
  try {
    storage.setItem(localKey(uid), version);
  } catch {
    // Sin almacenamiento local basta con el perfil
  }
};
