// NOVEDADES DE CADA VERSIÓN, contadas para quien usa la app (los detalles técnicos están en el README). Al publicar una
// versión se añade su entrada al principio, con la misma versión que package.json (tests/unit/releaseNotes.test.ts lo
// comprueba). Al entrar después de una actualización, cada cuenta ve una vez las de su versión; todas están en la Ayuda.
// Las funciones extra no se anuncian aquí: solo las ve quien las tiene, en el menú de su cuenta.

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
    version: '0.9.7',
    month: 'octubre de 2026',
    changes: [
      {
        title: 'Lo de hoy, a la vista',
        text: 'Las tareas que vencen hoy llevan la etiqueta «Hoy» y el título en negrita y, en las listas, un borde violeta. Así ves de un vistazo lo que toca hoy, también en Metas y en la Agenda.'
      },
      {
        title: 'Alarmas a su hora',
        text: 'Una tarea con solo fecha te avisa ese mismo día a la hora de su alarma (antes sonaba la víspera). Con hora límite, la alarma tiene que ser antes. La tarjeta dice cuándo sonará («hoy 17:00»), el formulario te avisa si esa hora ya ha pasado, y las tareas que se repiten pueden llevar alarma sin hora límite.'
      },
      {
        title: 'Sin conexión, también al abrirla',
        text: 'CLAR se abre sin conexión, también la app instalada en Android, una vez abierta con conexión en ese dispositivo. Y mientras carga, el brillo del logo da vueltas dentro del círculo.'
      },
      {
        title: 'Al calendario, con su hora',
        text: '«Añadir al calendario» pone una tarea con solo fecha a la hora de su alarma o, si no tiene, a las 09:00, durante una hora. Con el archivo .ics, el aviso del calendario suena a la vez que el de CLAR.'
      }
    ]
  },
  {
    version: '0.9.6',
    month: 'octubre de 2026',
    changes: [
      {
        title: 'Alarmas con CLAR cerrada',
        text: 'Con «Avisarme también con CLAR cerrada», en el menú de tu cuenta, las alarmas te llegan aunque la app esté cerrada o el móvil bloqueado, en los navegadores que lo permiten (en el iPhone, con CLAR instalada en la pantalla de inicio). Se activa en cada dispositivo, y la notificación solo lleva el nombre de la tarea si lo pides.'
      },
      {
        title: 'Proyectos, cuando te ayuden',
        text: 'La bienvenida, el recorrido guiado y la Ayuda presentan los proyectos como lo que son: una forma opcional de agrupar tareas relacionadas de una meta, o de una parte de ella. Una meta puede no tener ninguno, o tener uno o varios.'
      },
      {
        title: 'Importar sin recortes',
        text: 'Al importar una descarga, un registro con un texto o una lista más largos de lo permitido no entra recortado: cuenta como no válido, y la vista previa te lo dice.'
      },
      {
        title: 'Privacidad al día',
        text: 'La política de privacidad explica las alarmas con CLAR cerrada.'
      },
      {
        title: 'Novedades al entrar',
        text: 'Desde ahora, al entrar después de una actualización, CLAR te cuenta sus novedades una vez. Las de cada versión están en la Ayuda, y las de la actual, también al pulsar el número de versión.'
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

// Si lo guardado dice que ya se vieron las novedades de `current` (o las de una versión posterior)
export const hasSeenRelease = (seen: unknown, current: string) =>
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
}) =>
  Boolean(releaseFor(current)) &&
  onboarded &&
  !hasSeenRelease(seenInProfile, current) &&
  !hasSeenRelease(seenHere, current);

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
