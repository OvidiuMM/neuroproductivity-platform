import type { Firestore } from 'firebase/firestore';
import type { WheelArea } from '../types';
import { existingIds, importRecords, saveWheelAreas } from './repository';
import { IMPORT_MAX_BYTES, IMPORT_ORDER, parseAccountExport, planImport, type ImportPlan } from './importData';

// Prepara la importación de un archivo: lo lee, lo comprueba y mira en el servidor qué hay ya en la cuenta
export const prepareAccountImport = async (db: Firestore, uid: string, file: File, currentAreas: WheelArea[]) => {
  if (file.size > IMPORT_MAX_BYTES)
    throw new Error('El archivo pasa de 5 MB: no parece una descarga de «Descargar mis datos (JSON)».');
  const parsed = parseAccountExport(await file.text());
  let existing;
  try {
    existing = await existingIds(db, uid);
  } catch {
    throw new Error('Para importar hace falta conexión: CLAR comprueba antes qué hay ya en tu cuenta.');
  }
  return planImport(parsed, existing, currentAreas);
};

// Si falla a medias, lo ya escrito se queda: volver a importar el archivo completa el resto sin repetir nada
export class PartialImportError extends Error {
  constructor(
    readonly done: number,
    readonly total: number
  ) {
    super(
      done === 0
        ? 'No se pudo importar. Comprueba tu conexión e inténtalo de nuevo.'
        : `Se importaron ${done} de ${total}. Vuelve a importar el archivo para completar el resto: lo que ya entró no se repite.`
    );
  }
}

export const runAccountImport = async (
  db: Firestore,
  uid: string,
  plan: ImportPlan,
  onProgress: (done: number, total: number) => void
) => {
  let done = 0;
  try {
    // Las áreas primero: así lo importado ya tiene su nombre al llegar
    if (plan.areas) await saveWheelAreas(db, uid, plan.areas);
    await importRecords(db, uid, plan.data, IMPORT_ORDER, (written, total) => {
      done = written;
      onProgress(written, total);
    });
  } catch {
    throw new PartialImportError(done, plan.total);
  }
};
