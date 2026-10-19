import { CALENDAR_SUMMARY, EVENT_MARK, type CalendarEventBody } from './calendarLogic';

// API DE GOOGLE (OAuth y Calendar), con fetch. Solo se usa el permiso `calendar.app.created`: crear un calendario
// propio («CLAR») y sus eventos; el resto de calendarios de la persona no se ven ni se tocan. functions/test/
// googleCalendar.test.ts la prueba con un fetch simulado; el resto de pruebas usan una versión simulada entera.

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';
const TIMEOUT_MS = 15_000;
// Ante un límite de peticiones o un fallo pasajero de Google, se reintenta con una espera creciente (y algo de azar)
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const RATE_LIMIT_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'];

// Un fallo de Google. `reason`: 'revoked' (el permiso ya no vale: hay que volver a conectar), 'calendarMissing' (no
// existe el calendario «CLAR») o el código de error de Google
export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string
  ) {
    super(`Google API error ${status} (${reason})`);
  }
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface GoogleCalendarApi {
  exchangeCode(
    client: OAuthClient,
    input: { code: string; codeVerifier: string; redirectUri: string }
  ): Promise<{ refreshToken: string | null; accessToken: string; expiresIn: number; scope: string }>;
  refreshAccessToken(client: OAuthClient, refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;
  revoke(token: string): Promise<void>;
  // El calendario «CLAR»: el que ya había si sigue existiendo; si no, uno nuevo
  ensureCalendar(accessToken: string, timeZone: string, previousId?: string): Promise<string>;
  putEvent(accessToken: string, calendarId: string, eventId: string, event: CalendarEventBody): Promise<void>;
  deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>;
  // Los ids de los eventos que creó CLAR en el calendario
  listEventIds(accessToken: string, calendarId: string): Promise<string[]>;
}

const errorReason = async (res: Response) => {
  try {
    const body = (await res.clone().json()) as { error?: string | { errors?: { reason?: string }[]; status?: string } };
    if (typeof body.error === 'string') return body.error;
    return body.error?.errors?.[0]?.reason ?? body.error?.status ?? 'unknown';
  } catch {
    return 'unknown';
  }
};

// Esperas entre reintentos (las pruebas las acortan)
let retryDelays = RETRY_DELAYS_MS;
export const setRetryDelaysForTests = (delays: number[]) => {
  retryDelays = delays;
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryable = async (res: Response) =>
  res.status === 429 ||
  res.status >= 500 ||
  (res.status === 403 && RATE_LIMIT_REASONS.includes(await errorReason(res)));

const call = async (url: string, init: RequestInit & { headers?: Record<string, string> }, accessToken?: string) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (attempt >= retryDelays.length || !(await retryable(res))) return res;
    await sleep(retryDelays[attempt] * (1 + Math.random() / 2));
  }
};

const json = (body: unknown) => ({
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' }
});

const tokenRequest = async (params: Record<string, string>) => {
  const res = await call(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams(params).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!res.ok) {
    const reason = await errorReason(res);
    throw new GoogleApiError(res.status, reason === 'invalid_grant' ? 'revoked' : reason);
  }
  return (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string; scope?: string };
};

const calendarUrl = (calendarId: string) => `${API}/calendars/${encodeURIComponent(calendarId)}`;

// Si el calendario existe. Solo un 404 o 410 de Google sobre el propio calendario dice que no
const calendarExists = async (accessToken: string, calendarId: string) => {
  const res = await call(calendarUrl(calendarId), { method: 'GET' }, accessToken);
  if (res.ok) return true;
  if (res.status === 404 || res.status === 410) return false;
  throw new GoogleApiError(res.status, await errorReason(res));
};

export const googleCalendarApi: GoogleCalendarApi = {
  async exchangeCode(client, { code, codeVerifier, redirectUri }) {
    const tokens = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: client.clientId,
      client_secret: client.clientSecret
    });
    return {
      refreshToken: tokens.refresh_token ?? null,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope ?? ''
    };
  },

  async refreshAccessToken(client, refreshToken) {
    const tokens = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret
    });
    return { accessToken: tokens.access_token, expiresIn: tokens.expires_in };
  },

  async revoke(token) {
    const res = await call(REVOKE_URL, {
      method: 'POST',
      body: new URLSearchParams({ token }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    // Un permiso que ya no existe (400) no es un fallo
    if (!res.ok && res.status !== 400) throw new GoogleApiError(res.status, await errorReason(res));
  },

  async ensureCalendar(accessToken, timeZone, previousId) {
    if (previousId) {
      const res = await call(calendarUrl(previousId), { method: 'GET' }, accessToken);
      if (res.ok) return previousId;
      // Ya no existe, o este permiso no lo ve (p. ej. otra cuenta de Google): se crea otro. Cualquier otro fallo
      // (un límite de peticiones que siguió tras los reintentos) se para, para no duplicar el calendario
      const reason = await errorReason(res);
      const gone =
        res.status === 404 || res.status === 410 || (res.status === 403 && !RATE_LIMIT_REASONS.includes(reason));
      if (!gone) throw new GoogleApiError(res.status, reason);
    }
    const res = await call(
      `${API}/calendars`,
      {
        method: 'POST',
        ...json({ summary: CALENDAR_SUMMARY, description: 'Tareas con fecha de CLAR (se actualizan solas).', timeZone })
      },
      accessToken
    );
    if (!res.ok) throw new GoogleApiError(res.status, await errorReason(res));
    return ((await res.json()) as { id: string }).id;
  },

  // Sustituye el evento entero (también uno borrado antes, que vuelve). Si no existe, se crea con su id. Un 404 solo
  // se toma como calendario borrado si Google lo confirma al pedir el calendario
  async putEvent(accessToken, calendarId, eventId, event) {
    const url = `${calendarUrl(calendarId)}/events/${eventId}`;
    const put = () => call(url, { method: 'PUT', ...json(event) }, accessToken);
    let res = await put();
    if (res.status === 404) {
      res = await call(
        `${calendarUrl(calendarId)}/events`,
        { method: 'POST', ...json({ ...event, id: eventId }) },
        accessToken
      );
      // Otra sincronización lo creó entretanto
      if (res.status === 409) res = await put();
    }
    if (res.status === 404 && !(await calendarExists(accessToken, calendarId)))
      throw new GoogleApiError(404, 'calendarMissing');
    if (!res.ok) throw new GoogleApiError(res.status, await errorReason(res));
  },

  async deleteEvent(accessToken, calendarId, eventId) {
    const res = await call(`${calendarUrl(calendarId)}/events/${eventId}`, { method: 'DELETE' }, accessToken);
    // Ya no estaba (o no estaba el calendario): nada que borrar
    if (!res.ok && res.status !== 404 && res.status !== 410)
      throw new GoogleApiError(res.status, await errorReason(res));
  },

  async listEventIds(accessToken, calendarId) {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        privateExtendedProperty: `${EVENT_MARK}=1`,
        maxResults: '2500',
        fields: 'items(id),nextPageToken',
        ...(pageToken ? { pageToken } : {})
      });
      const res = await call(`${calendarUrl(calendarId)}/events?${params.toString()}`, { method: 'GET' }, accessToken);
      if (!res.ok) throw new GoogleApiError(res.status, await errorReason(res));
      const page = (await res.json()) as { items?: { id: string }[]; nextPageToken?: string };
      ids.push(...(page.items ?? []).map((item) => item.id));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return ids;
  }
};
