// Descarga un archivo generado en el navegador (sin pasar por ningún servidor)
export const downloadFile = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revocar en el mismo instante cancela la descarga en algunos navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const downloadJson = (filename: string, data: unknown) =>
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');

// Parte del nombre de un archivo a partir de un título: letras y números, el resto como guiones
export const fileSlug = (title: string, fallback: string) =>
  title
    .slice(0, 40)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || fallback;
