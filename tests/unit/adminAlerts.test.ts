import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminAlerts } from '../../src/services/adminAlerts.ts';

test('the admin is warned of pending requests, unread messages and accounts that got in on their own', () => {
  const seen = '2026-10-16T10:00:00.000Z';
  const requests = [
    { status: 'pending' as const, requestedAt: '2026-10-15T09:00:00.000Z' },
    // Entró sola después de mirar las solicitudes: nueva
    { status: 'approved' as const, requestedAt: '2026-10-16T11:00:00.000Z' },
    // Ya estaba antes
    { status: 'approved' as const, requestedAt: '2026-10-14T09:00:00.000Z' },
    { status: 'rejected' as const, requestedAt: '2026-10-16T12:00:00.000Z' }
  ];
  const tickets = [{ status: 'new' as const }, { status: 'new' as const }, { status: 'read' as const }];
  assert.deepEqual(adminAlerts(requests, tickets, seen), { pending: 1, newAccounts: 1, unread: 2, total: 4 });
  assert.deepEqual(adminAlerts([], [], seen), { pending: 0, newAccounts: 0, unread: 0, total: 0 });
});
