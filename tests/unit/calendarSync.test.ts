import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTaskEvent, eventDescription } from '../../functions/src/calendarLogic';
import { buildCalendarEvent } from '../../src/services/calendar.ts';
import type { TaskItem } from '../../src/types/index.ts';

// La sincronización con Google Calendar (en el servidor, en la zona de la cuenta) crea el mismo evento que «Añadir al
// calendario» de la app. Se ejecuta también con TZ=Europe/Madrid y TZ=America/New_York (npm run test:unit), que tienen
// cambios de hora en las fechas de estas tareas.
const URL = 'https://clar.example';
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const task = (fields: Partial<TaskItem>): TaskItem => ({
  id: 'task-1',
  userId: 'ana',
  listContext: 'WORK',
  title: 'Revisar el contrato',
  description: '',
  priority: 'MEDIUM',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  observations: [],
  isSomeday: false,
  status: 'PENDING',
  ...fields
});

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MAX_REMINDER = 40_320;

// Con notas, la sincronización manda la descripción en HTML, para que se vean como lista: se compara su texto
const expectSameEvent = (source: TaskItem, { notesAsHtml = false } = {}) => {
  const client = buildCalendarEvent(source, URL, timeZone);
  const server = buildTaskEvent(source, timeZone, URL);
  assert.ok(client && server, `evento de ${JSON.stringify(source)}`);
  assert.equal(server.summary, client.title);
  if (notesAsHtml) assert.equal(eventDescription(source, URL, '').text, client.description);
  else assert.equal(server.description, client.description);
  if (client.allDay) {
    assert.deepEqual(server.start, { date: localDay(client.start) });
    assert.deepEqual(server.end, { date: localDay(client.end) });
  } else {
    assert.deepEqual(server.start, { dateTime: client.start.toISOString(), timeZone });
    assert.deepEqual(server.end, { dateTime: client.end.toISOString(), timeZone });
  }
  assert.deepEqual(server.recurrence, client.rrule ? [client.rrule] : undefined);
  // Google cuenta el recordatorio desde el inicio; el .ics, desde el borde que marca la app
  const fromStart = client.alarm
    ? client.alarm.related === 'START'
      ? client.alarm.minutesBefore
      : client.alarm.minutesBefore - Math.round((client.end.getTime() - client.start.getTime()) / 60_000)
    : null;
  assert.deepEqual(
    server.reminders.overrides,
    fromStart !== null && fromStart >= 0 && fromStart <= MAX_REMINDER ? [{ method: 'popup', minutes: fromStart }] : []
  );
};

test('dates without time: one day or several, all day', () => {
  expectSameEvent(task({ dueDate: '2026-10-16' }));
  expectSameEvent(task({ startDate: '2026-10-14', dueDate: '2026-10-16' }));
  expectSameEvent(task({ dueDate: '2026-10-16', alarmTime: '20:00' }));
});

test('times: a deadline, an interval and a start without deadline time (one hour)', () => {
  expectSameEvent(task({ dueDate: '2026-10-16', dueTime: '12:00' }));
  expectSameEvent(task({ startDate: '2026-10-14', startTime: '09:00', dueDate: '2026-10-16', dueTime: '18:00' }));
  expectSameEvent(task({ startDate: '2026-10-16', startTime: '10:00', dueDate: '2026-10-16' }));
  // El plazo es otro día: se dice en la descripción
  expectSameEvent(task({ startDate: '2026-10-14', startTime: '10:00', dueDate: '2026-10-16' }));
  expectSameEvent(task({ startDate: '2026-10-14', dueDate: '2026-10-16', dueTime: '18:00' }));
});

test('alarms become reminders counted from the start, and are left out when they fall after it', () => {
  expectSameEvent(task({ dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '11:30' }));
  expectSameEvent(task({ dueDate: '2026-10-16', dueTime: '12:00', alarmTime: '13:00' }));
  expectSameEvent(task({ startDate: '2026-10-16', startTime: '10:00', dueDate: '2026-10-16', alarmTime: '09:00' }));
  expectSameEvent(
    task({ startDate: '2026-10-14', startTime: '09:00', dueDate: '2026-10-16', dueTime: '18:00', alarmTime: '17:00' })
  );
});

test('series: weekly, monthly on the last days, yearly on 29 February and with an end', () => {
  expectSameEvent(
    task({
      dueDate: '2026-10-19',
      dueTime: '09:30',
      recurrence: { frequency: 'WEEKLY', interval: 1, weekdays: [3, 1] }
    })
  );
  expectSameEvent(
    task({
      dueDate: '2026-10-31',
      recurrence: { frequency: 'MONTHLY', interval: 1, monthlyMode: 'DAY_OF_MONTH', monthDay: 31 }
    })
  );
  expectSameEvent(
    task({
      dueDate: '2026-10-12',
      recurrence: { frequency: 'MONTHLY', interval: 2, monthlyMode: 'NTH_WEEKDAY', nth: 2, weekday: 1 }
    })
  );
  expectSameEvent(task({ dueDate: '2028-02-29', recurrence: { frequency: 'YEARLY', interval: 1, monthDay: 29 } }));
  expectSameEvent(
    task({
      dueDate: '2026-10-20',
      startTime: '08:00',
      dueTime: '09:00',
      alarmTime: '07:45',
      recurrence: { frequency: 'DAILY', interval: 2, until: '2026-12-31' }
    })
  );
  expectSameEvent(
    task({
      dueDate: '2026-10-20',
      recurrence: { frequency: 'WEEKLY', interval: 1, weekdays: [2], until: '2027-01-05' }
    })
  );
});

test('hours around the changes of time of Madrid and New York', () => {
  for (const dueDate of ['2026-03-29', '2026-10-25', '2026-03-08', '2026-11-01']) {
    expectSameEvent(task({ dueDate, dueTime: '02:30' }));
    expectSameEvent(task({ dueDate, dueTime: '03:00', alarmTime: '02:30' }));
    expectSameEvent(task({ startDate: dueDate, startTime: '01:30', dueDate }));
    expectSameEvent(task({ dueDate, alarmTime: '23:00' }));
  }
});

test('the description carries the notes, with their checkboxes and links; synced, as a list', () => {
  const source = task({
    dueDate: '2026-10-16',
    description: 'Cláusula 4',
    observations: [
      { id: 'o1', type: 'note', text: 'Pedir la copia firmada', createdAt: '2026-10-01T09:00:00.000Z' },
      {
        id: 'o2',
        type: 'checklist',
        text: 'Revisar anexos',
        completed: true,
        createdAt: '2026-10-01T09:00:00.000Z'
      },
      {
        id: 'o3',
        type: 'note',
        text: 'Borrador',
        url: 'https://example.com/borrador',
        createdAt: '2026-10-01T09:00:00.000Z'
      }
    ]
  });
  expectSameEvent(source, { notesAsHtml: true });
  assert.equal(
    buildTaskEvent(source, timeZone, URL)!.description,
    'Cláusula 4<br><br>Notas:<ul><li>Pedir la copia firmada</li><li>☑ Revisar anexos</li>' +
      '<li><a href="https://example.com/borrador">Borrador</a></li></ul><br><br>' +
      'Tarea de CLAR: <a href="https://clar.example">https://clar.example</a>'
  );
  // Sin notas, en texto, como siempre
  assert.equal(
    buildTaskEvent(task({ dueDate: '2026-10-16' }), timeZone, URL)!.description,
    'Tarea de CLAR: https://clar.example'
  );
});

test('synced notes escape the text of the task, and only http(s) links can be clicked', () => {
  const source = task({
    dueDate: '2026-10-16',
    description: 'Precio <b>final</b> & "IVA"\nSegunda línea',
    observations: [
      {
        id: 'o1',
        type: 'checklist',
        text: '<script>x</script>',
        completed: false,
        createdAt: '2026-10-01T09:00:00.000Z'
      },
      { id: 'o2', type: 'note', text: 'Raro', url: 'javascript:alert(1)', createdAt: '2026-10-01T09:00:00.000Z' }
    ]
  });
  const html = buildTaskEvent(source, timeZone, URL)!.description;
  assert.ok(
    html.startsWith('Precio &lt;b&gt;final&lt;/b&gt; &amp; &quot;IVA&quot;<br>Segunda línea<br><br>Notas:<ul>')
  );
  assert.match(html, /<li>☐ &lt;script&gt;x&lt;\/script&gt;<\/li>/);
  assert.match(html, /<li>Raro \(javascript:alert\(1\)\)<\/li>/);
  assert.doesNotMatch(html, /href="javascript/);
});
