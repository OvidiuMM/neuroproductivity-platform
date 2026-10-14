import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withAuthDomain } from '../../src/services/authDomain';

const config = { apiKey: 'key', authDomain: 'project.firebaseapp.com', projectId: 'project' };

test('on clar.life, sign-in uses the same domain', () => {
  assert.equal(withAuthDomain(config, 'clar.life').authDomain, 'clar.life');
  assert.equal(withAuthDomain(config, 'www.clar.life').authDomain, 'www.clar.life');
  assert.equal(withAuthDomain(config, 'clar.life').projectId, 'project');
});

test('elsewhere, the Firebase configuration is kept as served', () => {
  assert.equal(withAuthDomain(config, 'project.web.app'), config);
  assert.equal(withAuthDomain(config, 'localhost'), config);
  assert.equal(withAuthDomain(config, 'evilclar.life'), config);
});
