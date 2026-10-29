import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { buildEmail, type AccessRecord } from '../src/accessLogic';
import { alarmBody, notificationText, queuedAlarm, testNotificationBody } from '../src/alarmLogic';
import { buildTaskEvent, calendarDescription, eventDescription } from '../src/calendarLogic';
import {
  buildFeedbackDigestEmail,
  buildFeedbackEmail,
  buildReplyEmail,
  type FeedbackTicket
} from '../src/feedbackLogic';
import { googleCalendarApi, setRetryDelaysForTests } from '../src/googleCalendar';
import { isLanguage, languageOf, messages } from '../src/i18n';

// Los textos del servidor en inglés: cada uno se escribe en el idioma de quien lo va a leer (el de su cuenta, su
// dispositivo o su mensaje). Los de la administración, siempre en español
const MADRID = 'Europe/Madrid';
const URL = 'https://clar.example';

describe('server languages', () => {
  it('knows only Spanish and English, and anything else is Spanish', () => {
    assert.equal(isLanguage('en'), true);
    assert.equal(isLanguage('en-GB'), false);
    assert.equal(languageOf('en'), 'en');
    assert.equal(languageOf(undefined), 'es');
    assert.equal(languageOf('fr'), 'es');
    const m = messages({ hi: 'Hola' }, { hi: 'Hi' });
    assert.equal(m.en.hi, 'Hi');
    assert.equal(m.es.hi, 'Hola');
  });
});

describe('push alarms in English', () => {
  const now = Date.parse('2026-10-16T08:00:00.000Z');
  const task = {
    title: 'Call the bank',
    dueDate: '2026-10-17',
    dueTime: '11:00',
    alarmTime: '10:30',
    status: 'PENDING'
  };

  it('writes the title and the deadline in English, with the day before the month and a 24-hour clock', () => {
    const alarm = queuedAlarm('task-1', task, MADRID, now, 'en')!;
    assert.equal(notificationText(alarm, false, 'en'), 'You have a CLAR alarm at 10:30');
    assert.equal(notificationText(alarm, true, 'en'), 'Alarm at 10:30: Call the bank');
    assert.equal(alarm.body, 'Due 17 Oct at 11:00');
    assert.equal(alarmBody(alarm, 'en'), 'Due 17 Oct at 11:00');
    // Lo mismo, en español por defecto
    assert.match(alarmBody(alarm), /^Vence el 17 oct\.? a las 11:00$/);
    assert.equal(notificationText(alarm, true), 'Alarma de las 10:30: Call the bank');
  });

  it('writes a deadline without a time as just the day, in the time zone of the alarm', () => {
    const dateOnly = queuedAlarm('t', { ...task, dueTime: undefined, alarmTime: '22:30' }, 'America/New_York', now)!;
    assert.equal(alarmBody(dateOnly, 'en'), 'Due 17 Oct');
    assert.equal(notificationText(dateOnly, false, 'en'), 'You have a CLAR alarm at 22:30');
  });

  it('has the test notification in both languages', () => {
    assert.equal(testNotificationBody(), 'Así te avisará CLAR de tus alarmas, también con la app cerrada.');
    assert.equal(
      testNotificationBody('en'),
      'This is how CLAR will notify you of your alarms, even when the app is closed.'
    );
  });
});

describe('emails in English', () => {
  const record: AccessRecord = {
    status: 'approved',
    email: 'ana@example.com',
    name: 'Ana Test',
    photoUrl: '',
    message: '',
    requestedAt: '2026-10-11T10:00:00.000Z'
  };

  it('tells a person in English that their access is approved; the notice to the admin stays in Spanish', () => {
    const approved = buildEmail('approved', record, URL, 'en');
    assert.equal(approved.subject, 'You now have access to CLAR');
    assert.equal(
      approved.text,
      [
        'Hi Ana Test,',
        '',
        'Your request for access to CLAR has been approved. You can now sign in with the same account you used to request it:',
        URL
      ].join('\n')
    );
    assert.match(buildEmail('approved', { ...record, name: '' }, URL, 'en').text, /^Hi,\n/);
    assert.equal(buildEmail('new-request', record, URL, 'en').subject, 'Nueva solicitud de acceso a CLAR');
  });

  const ticket: FeedbackTicket = {
    type: 'bug',
    subject: 'The agenda does not load',
    description: 'It stays blank.\n\nSince yesterday.',
    uid: 'ana',
    email: 'ana@example.com',
    name: 'Ana',
    status: 'new',
    language: 'en',
    createdAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-10-15T09:00:00.000Z'
  };

  it('replies in the language of the person who wrote, quoting their message', () => {
    const email = buildReplyEmail(ticket, 'Thanks, Ana. It is fixed now.', 'https://clar.life');
    assert.equal(email.subject, 'Re: [CLAR] The agenda does not load');
    assert.equal(
      email.text,
      [
        'Hi Ana,',
        '',
        'Thanks, Ana. It is fixed now.',
        '',
        '—',
        'The CLAR team',
        'https://clar.life',
        '',
        'Your message (Bug or problem):',
        '> The agenda does not load',
        '>',
        '> It stays blank.',
        '>',
        '> Since yesterday.'
      ].join('\n')
    );
    assert.match(buildReplyEmail({ ...ticket, name: '' }, 'Hi', 'https://clar.life').text, /^Hi,\n/);
    // Un mensaje de antes de 1.2.0 (sin idioma), en español
    assert.match(
      buildReplyEmail({ ...ticket, language: undefined }, 'Hola', 'https://clar.life').text,
      /^Hola, Ana:\n/
    );
  });

  it('keeps the notices to the admin in Spanish, whatever the language of the message', () => {
    assert.match(buildFeedbackEmail(ticket, URL).subject, /Mensaje nuevo: Error o fallo$/);
    assert.match(buildFeedbackDigestEmail(2, URL).text, /^Hay 2 mensajes nuevos/);
  });
});

describe('Google Calendar in English', () => {
  const observations = [
    { type: 'checklist', text: 'Bring the ID', completed: true },
    { type: 'note', text: 'Branch office', url: 'https://maps.example/branch' }
  ];

  it('writes the labels CLAR adds to the event in English; the title and the notes are left as they are', () => {
    const plain = eventDescription({ description: 'Ask about the fees', observations }, URL, '', 'en').text;
    assert.equal(
      plain,
      [
        'Ask about the fees',
        '',
        'Notes:',
        '- [x] Bring the ID',
        '- Branch office (https://maps.example/branch)',
        '',
        `CLAR task: ${URL}`
      ].join('\n')
    );
    const event = buildTaskEvent(
      { title: 'Call the bank', dueDate: '2026-10-16', alarmTime: '10:00', observations },
      MADRID,
      URL,
      'en'
    )!;
    assert.equal(event.summary, 'Call the bank');
    assert.ok(event.description.startsWith('Notes:<ul><li>☑ Bring the ID</li>'));
    assert.ok(event.description.endsWith(`CLAR task: <a href="${URL}">${URL}</a>`));
    // Sin notas, en texto
    assert.equal(
      buildTaskEvent({ title: 'x', dueDate: '2026-10-16' }, MADRID, URL, 'en')!.description,
      `CLAR task: ${URL}`
    );
  });

  it('writes the deadline of a one-hour event on another day with the English date', () => {
    const task = { title: 'x', startDate: '2026-10-14', startTime: '09:00', dueDate: '2026-10-16' };
    assert.equal(buildTaskEvent(task, MADRID, URL, 'en')!.description, `Due date: 16 Oct 2026\n\nCLAR task: ${URL}`);
    assert.match(buildTaskEvent(task, MADRID, URL)!.description, /^Fecha límite: 16 oct\.? 2026\n\nTarea de CLAR: /);
    // La serie no depende del idioma
    const recurrence = { frequency: 'WEEKLY', weekdays: [1, 3] };
    assert.deepEqual(
      buildTaskEvent({ ...task, recurrence }, MADRID, URL, 'en')!.recurrence,
      buildTaskEvent({ ...task, recurrence }, MADRID, URL)!.recurrence
    );
  });

  it('creates the «CLAR» calendar with its description in the language of the account', async () => {
    assert.equal(calendarDescription(), 'Tareas con fecha de CLAR (se actualizan solas).');
    const realFetch = globalThis.fetch;
    const bodies: unknown[] = [];
    setRetryDelaysForTests([0, 0, 0]);
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return Promise.resolve(new Response(JSON.stringify({ id: 'cal-1' }), { status: 200 }));
    }) as typeof fetch;
    after(() => {
      globalThis.fetch = realFetch;
    });
    assert.equal(await googleCalendarApi.ensureCalendar('t', MADRID, undefined, 'en'), 'cal-1');
    await googleCalendarApi.ensureCalendar('t', MADRID);
    assert.deepEqual(bodies, [
      { summary: 'CLAR', description: 'CLAR tasks with a date (they update automatically).', timeZone: MADRID },
      { summary: 'CLAR', description: 'Tareas con fecha de CLAR (se actualizan solas).', timeZone: MADRID }
    ]);
  });
});
