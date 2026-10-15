import assert from 'node:assert/strict';
import { test } from 'node:test';

// Cambio al horario de verano en Madrid: el 31 de marzo de 2030 a las 02:00 se pasa a las 03:00 (las 02:30 de ese
// día no existen). La zona se fija antes de cargar el módulo.
process.env.TZ = 'Europe/Madrid';
const { alarmMoment } = await import('../../src/services/alarms');

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
