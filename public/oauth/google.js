// Vuelta de la autorización de Google Calendar (ver src/services/googleCalendar.ts): pasa el código a la ventana de
// CLAR que la pidió y se cierra. Va por BroadcastChannel porque, tras pasar por Google, esta ventana puede haber
// perdido la referencia a la que la abrió; también por postMessage, por si el navegador no tiene BroadcastChannel.
(() => {
  const params = new URLSearchParams(window.location.search);
  const message = {
    type: 'clar-google-oauth',
    state: params.get('state'),
    code: params.get('code'),
    error: params.get('error')
  };
  // El código no se queda en la barra de direcciones ni en el historial
  window.history.replaceState(null, '', window.location.pathname);
  try {
    const channel = new BroadcastChannel('clar-google-oauth');
    channel.postMessage(message);
    channel.close();
  } catch {
    // Sin BroadcastChannel: queda postMessage
  }
  try {
    window.opener?.postMessage(message, window.location.origin);
  } catch {
    // Sin la ventana que la abrió
  }
  window.close();
})();
