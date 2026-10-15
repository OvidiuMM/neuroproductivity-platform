import assert from 'node:assert/strict';
import { test } from 'node:test';

// Cambio al horario de verano en Madrid: el 31 de marzo de 2030 a las 02:00 se pasa a las 03:00 (las 02:30 de ese
// día no existen). La zona se fija antes de cargar el módulo.
process.env.TZ = 'Europe/Madrid';
const { alarmMoment } = await import('../../src/services/alarms');
const { buildCalendarEvent, buildIcs } = await import('../../src/services/calendar');

const local = (date: Date) =>
  `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

test('a daylight-saving change on the due day does not move the alarm of the day before', () => {
  // Solo fecha, el día del cambio: la víspera a las 02:30, que sí existe
  assert.equal(local(alarmMoment({ dueDate: '2030-03-31', alarmTime: '02:30' })!), '3/30 02:30');
  // Hora límite a la 01:00 del día del cambio: la alarma de las 02:30 es la víspera, a las 02:30
  assert.equal(local(alarmMoment({ dueDate: '2030-03-31', dueTime: '01:00', alarmTime: '02:30' })!), '3/30 02:30');
  // El mismo día, antes de la hora límite y fuera del salto: sin cambios
  assert.equal(local(alarmMoment({ dueDate: '2030-03-31', dueTime: '10:00', alarmTime: '09:15' })!), '3/31 09:15');
});

test('an alarm time that does not exist (the daylight-saving gap) rings the same real time before the deadline', () => {
  // Plazo a las 03:00 del día del cambio, alarma a las 02:30 (no existe): suena a la 01:30, 30 minutos reales antes
  const task = { dueDate: '2030-03-31', dueTime: '03:00', alarmTime: '02:30' };
  const at = alarmMoment(task)!;
  assert.equal(local(at), '3/31 01:30');
  assert.equal(new Date(2030, 2, 31, 3, 0).getTime() - at.getTime(), 30 * 60_000);
  // El calendario la cuenta igual, 30 minutos antes del inicio
  const event = buildCalendarEvent(
    {
      id: 't',
      userId: 'u',
      listContext: 'WORK',
      title: 'Coger el tren',
      description: '',
      priority: 'MEDIUM',
      status: 'PENDING',
      isSomeday: false,
      observations: [],
      createdAt: '2030-01-01T00:00:00.000Z',
      updatedAt: '2030-01-01T00:00:00.000Z',
      ...task
    },
    'https://clar.life'
  )!;
  assert.match(buildIcs(event), /TRIGGER:-PT30M/);
});
