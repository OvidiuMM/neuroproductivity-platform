import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEmail,
  canDecide,
  decideRequest,
  isAdminToken,
  isCurrentAdminMarker,
  normalizeMessage,
  REQUEST_COOLDOWN_MS,
  type AccessRecord
} from '../src/accessLogic';

const record = (overrides: Partial<AccessRecord> = {}): AccessRecord => ({
  status: 'pending',
  email: 'ana@example.com',
  name: 'Ana Prueba',
  photoUrl: '',
  message: '',
  requestedAt: '2026-10-11T10:00:00.000Z',
  ...overrides
});

describe('aprobación de accesos', () => {
  it('reconoce a la administración solo con el email configurado y verificado', () => {
    assert.equal(isAdminToken({ email: 'Admin@Example.com', email_verified: true }, 'admin@example.com'), true);
    assert.equal(isAdminToken({ email: 'admin@example.com', email_verified: false }, 'admin@example.com'), false);
    assert.equal(isAdminToken({ email: 'otra@example.com', email_verified: true }, 'admin@example.com'), false);
    assert.equal(isAdminToken({ email: '', email_verified: true }, ''), false);
  });

  it('solo da por válida la marca de administración de la cuenta configurada', () => {
    assert.equal(isCurrentAdminMarker({ email: 'Admin@example.com' }, 'admin@example.com'), true);
    assert.equal(isCurrentAdminMarker({ email: 'antes@example.com' }, 'admin@example.com'), false);
    assert.equal(isCurrentAdminMarker({}, 'admin@example.com'), false);
    assert.equal(isCurrentAdminMarker(undefined, 'admin@example.com'), false);
    assert.equal(isCurrentAdminMarker({ email: 'admin@example.com' }, ''), false);
  });

  it('recorta el mensaje opcional y descarta lo que no es texto', () => {
    assert.equal(normalizeMessage('  Hola  '), 'Hola');
    assert.equal(normalizeMessage('x'.repeat(600)).length, 500);
    assert.equal(normalizeMessage({ text: 'hola' }), '');
  });

  it('crea la solicitud la primera vez y no duplica las pendientes ni las aprobadas', () => {
    const now = new Date('2026-10-11T12:00:00.000Z');
    assert.deepEqual(decideRequest(undefined, now), { action: 'create' });
    assert.deepEqual(decideRequest(record(), now), { action: 'keep', status: 'pending' });
    assert.deepEqual(decideRequest(record({ status: 'approved' }), now), { action: 'keep', status: 'approved' });
  });

  it('tras un rechazo o una retirada deja volver a pedir acceso pasado un día', () => {
    const decidedAt = '2026-10-11T10:00:00.000Z';
    const rejected = record({ status: 'rejected', decidedAt });
    const soon = new Date(Date.parse(decidedAt) + REQUEST_COOLDOWN_MS - 1);
    const later = new Date(Date.parse(decidedAt) + REQUEST_COOLDOWN_MS);
    assert.deepEqual(decideRequest(rejected, soon), { action: 'wait', retryAt: '2026-10-12T10:00:00.000Z' });
    assert.deepEqual(decideRequest(rejected, later), { action: 'create' });
    assert.deepEqual(decideRequest(record({ status: 'revoked', decidedAt }), later), { action: 'create' });
  });

  it('solo permite los cambios de estado con sentido', () => {
    assert.equal(canDecide('pending', 'approved'), true);
    assert.equal(canDecide('rejected', 'approved'), true);
    assert.equal(canDecide('revoked', 'approved'), true);
    assert.equal(canDecide('approved', 'approved'), false);
    assert.equal(canDecide('pending', 'rejected'), true);
    assert.equal(canDecide('approved', 'rejected'), false);
    assert.equal(canDecide('approved', 'revoked'), true);
    assert.equal(canDecide('pending', 'revoked'), false);
  });

  it('redacta los correos en texto plano con el mensaje y el enlace a la app', () => {
    const request = buildEmail('new-request', record({ message: 'Soy del equipo' }), 'https://app.example.com');
    assert.match(request.text, /Ana Prueba \(ana@example\.com\) quiere acceder/);
    assert.match(request.text, /Mensaje:\nSoy del equipo/);
    assert.match(request.text, /«Accesos»: https:\/\/app\.example\.com/);
    const approved = buildEmail('approved', record(), 'https://app.example.com');
    assert.equal(approved.subject, 'Ya tienes acceso a NeuroProductividad');
    assert.match(approved.text, /^Hola Ana Prueba:/);
  });
});
