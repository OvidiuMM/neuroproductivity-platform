import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FEATURE_IDS } from '../../functions/src/featuresLogic';
import { EXTRA_FEATURES, activeFeatures, featureList, featurePrefsOf } from '../../src/services/features.ts';

test('the app and the server know the same extra features', () => {
  assert.deepEqual(
    EXTRA_FEATURES.map((f) => f.id),
    [...FEATURE_IDS]
  );
  for (const feature of EXTRA_FEATURES) {
    assert.ok(feature.label.trim());
    assert.ok(feature.description.trim());
  }
});

test('reads what is stored without trusting it', () => {
  assert.deepEqual(featureList(['otra', 'googleCalendar', 'googleCalendar']), ['googleCalendar']);
  assert.deepEqual(featureList('googleCalendar'), []);
  assert.deepEqual(featureList(undefined), []);
  assert.deepEqual(featurePrefsOf({ googleCalendar: true, otra: true }), { googleCalendar: true });
  assert.deepEqual(featurePrefsOf({ googleCalendar: 'sí' }), {});
  assert.deepEqual(featurePrefsOf(null), {});
});

test('the admin uses the features switched on, which start off; other accounts use the ones granted', () => {
  assert.deepEqual(activeFeatures({ isAdmin: true, granted: [], prefs: {} }), []);
  assert.deepEqual(activeFeatures({ isAdmin: true, granted: [], prefs: { googleCalendar: true } }), ['googleCalendar']);
  assert.deepEqual(
    activeFeatures({ isAdmin: true, granted: ['googleCalendar'], prefs: { googleCalendar: false } }),
    []
  );
  assert.deepEqual(activeFeatures({ isAdmin: false, granted: ['googleCalendar'], prefs: {} }), ['googleCalendar']);
  // Una cuenta que no es administración no puede encenderse nada por su cuenta
  assert.deepEqual(activeFeatures({ isAdmin: false, granted: [], prefs: { googleCalendar: true } }), []);
});
