import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEmail,
  canDecide,
  decideRequest,
  isAdminToken,
  isCurrentAdminMarker,
  normalizeMessage,
  publicAppUrl,
  REQUEST_COOLDOWN_MS,
  decideOnSync,
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
    // Con la aprobación libre, la pendiente se aprueba; las demás siguen igual
    assert.deepEqual(decideRequest(record(), now, false), { action: 'approve' });
    assert.deepEqual(decideRequest(record({ status: 'approved' }), now, false), { action: 'keep', status: 'approved' });
    assert.deepEqual(decideRequest(undefined, now, false), { action: 'create' });
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
    assert.match(request.text, /«Solicitudes»: https:\/\/app\.example\.com/);
    const approved = buildEmail('approved', record(), 'https://app.example.com');
    assert.equal(approved.subject, 'Ya tienes acceso a CLAR');
    assert.match(approved.text, /^Hola Ana Prueba:/);
  });
});

describe('lista negra y aprobación libre', () => {
  it('se puede bloquear desde cualquier estado y desbloquear retirando o aprobando', () => {
    for (const from of ['pending', 'approved', 'rejected', 'revoked'] as const) {
      assert.equal(canDecide(from, 'blocked'), true, from);
    }
    assert.equal(canDecide('blocked', 'blocked'), false);
    assert.equal(canDecide('blocked', 'revoked'), true);
    assert.equal(canDecide('blocked', 'approved'), true);
    assert.equal(canDecide('blocked', 'rejected'), false);
  });

  it('una cuenta bloqueada no puede volver a pedir acceso', () => {
    assert.deepEqual(decideRequest(record({ status: 'blocked', decidedAt: '2020-01-01T00:00:00.000Z' }), new Date()), {
      action: 'keep',
      status: 'blocked'
    });
  });

  it('al entrar: un email en la lista negra bloquea la cuenta, en cualquier modo', () => {
    for (const approvalRequired of [true, false]) {
      assert.equal(
        decideOnSync({ current: undefined, approvalRequired, emailBlocked: true, emailVerified: true }),
        'block'
      );
      assert.equal(
        decideOnSync({ current: 'approved', approvalRequired, emailBlocked: true, emailVerified: true }),
        'block'
      );
      assert.equal(
        decideOnSync({ current: 'blocked', approvalRequired, emailBlocked: true, emailVerified: true }),
        'keep'
      );
    }
  });

  it('con la aprobación libre entran solas las cuentas nuevas o pendientes con el email confirmado', () => {
    const open = { approvalRequired: false, emailBlocked: false, emailVerified: true };
    assert.equal(decideOnSync({ ...open, current: undefined }), 'approve');
    assert.equal(decideOnSync({ ...open, current: 'pending' }), 'approve');
    // Las decisiones de la administración se respetan
    assert.equal(decideOnSync({ ...open, current: 'rejected' }), 'keep');
    assert.equal(decideOnSync({ ...open, current: 'revoked' }), 'keep');
    assert.equal(decideOnSync({ ...open, current: 'blocked' }), 'keep');
    // Sin el email confirmado, no
    assert.equal(decideOnSync({ ...open, current: undefined, emailVerified: false }), 'keep');
  });

  it('con la aprobación obligatoria no se aprueba a nadie al entrar', () => {
    assert.equal(
      decideOnSync({ current: undefined, approvalRequired: true, emailBlocked: false, emailVerified: true }),
      'keep'
    );
    assert.equal(
      decideOnSync({ current: 'pending', approvalRequired: true, emailBlocked: false, emailVerified: true }),
      'keep'
    );
  });
});

describe('publicAppUrl', () => {
  it('uses the configured https address, without a trailing slash', () => {
    assert.equal(publicAppUrl('https://clar.life/', 'my-project'), 'https://clar.life');
    assert.equal(publicAppUrl('  https://clar.life  ', 'my-project'), 'https://clar.life');
  });

  it('falls back to the Firebase Hosting address when unset or not https', () => {
    assert.equal(publicAppUrl('', 'my-project'), 'https://my-project.web.app');
    assert.equal(publicAppUrl('http://clar.life', 'my-project'), 'https://my-project.web.app');
    assert.equal(publicAppUrl('clar.life', 'my-project'), 'https://my-project.web.app');
  });

  it('falls back on malformed or unusual addresses', () => {
    for (const bad of [
      'https://clar.life:invalid',
      'https://clar.life extra',
      'https://user:secret@clar.life',
      'https://clar.life/?ref=email',
      'https://clar.life/#inicio',
      'https://'
    ]) {
      assert.equal(publicAppUrl(bad, 'my-project'), 'https://my-project.web.app', bad);
    }
  });

  it('keeps a valid port or path', () => {
    assert.equal(publicAppUrl('https://clar.life:8443/app/', 'my-project'), 'https://clar.life:8443/app');
  });
});
