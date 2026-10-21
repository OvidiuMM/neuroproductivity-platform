import { setGlobalOptions } from 'firebase-functions/v2';

// Opciones de todas las funciones. Se importa antes que ninguna (functions/src/index.ts): las funciones toman las
// opciones al definirse. Un tope de instancias por función limita el coste si alguien abusa (con el registro abierto);
// la app, de momento pequeña, no se acerca
setGlobalOptions({ maxInstances: 5 });
