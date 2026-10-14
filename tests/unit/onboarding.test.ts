import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ONBOARDING_VERSION,
  hasSeenLocally,
  hasSeenOnboarding,
  onboardingRecord,
  rememberLocally
} from '../../src/services/onboarding';

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

test('onboarding counts as seen when the profile says so for this version or a later one', () => {
  assert.equal(hasSeenOnboarding(null, false), false);
  assert.equal(hasSeenOnboarding({}, false), false);
  assert.equal(hasSeenOnboarding({ hasSeenOnboarding: true, onboardingVersion: ONBOARDING_VERSION }, false), true);
  assert.equal(hasSeenOnboarding({ hasSeenOnboarding: true, onboardingVersion: ONBOARDING_VERSION + 1 }, false), true);
  // Visto en una versión anterior: se vuelve a mostrar
  assert.equal(hasSeenOnboarding({ hasSeenOnboarding: true, onboardingVersion: ONBOARDING_VERSION - 1 }, false), false);
});

test('the copy on this device is enough, per account', () => {
  const storage = new MemoryStorage() as unknown as Storage;
  assert.equal(hasSeenLocally('ana', storage), false);
  rememberLocally('ana', 'skipped', storage);
  assert.equal(hasSeenLocally('ana', storage), true);
  assert.equal(hasSeenLocally('bruno', storage), false);
  assert.equal(hasSeenOnboarding(null, hasSeenLocally('ana', storage)), true);
});

test('the profile record says how and when it was seen', () => {
  const now = new Date('2026-10-14T09:30:00.000Z');
  assert.deepEqual(onboardingRecord('completed', now), {
    hasSeenOnboarding: true,
    onboardingVersion: ONBOARDING_VERSION,
    onboardingSeenAt: '2026-10-14T09:30:00.000Z',
    onboardingOutcome: 'completed'
  });
});
