// Horas escritas a mano, siempre en 24 h (hh:mm, de 00:00 a 23:59), sea cual sea el idioma del sistema: el selector
// nativo muestra a. m./p. m. en sistemas en 12 h, y un «p. m.» olvidado guardaba 23:00 en lugar de 11:00.

export const TIME_INPUT_PLACEHOLDER = 'hh:mm';

// '' (vacío), 'HH:mm' o null si lo escrito aún no es una hora válida. Acepta 9:30, 09:30, 9.30, 930 y 0930
export const parseTimeInput = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = /^(\d{1,2})[:.h]?(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
};
