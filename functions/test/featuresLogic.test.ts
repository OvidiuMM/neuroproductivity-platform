import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FEATURE_IDS, isDocumentId, isFeatureId, parseFeatureList, parseFeatureRequest } from '../src/featuresLogic';

describe('extra features catalog', () => {
  it('accepts only known features, without repeats, in catalog order', () => {
    assert.deepEqual(parseFeatureList([]), []);
    assert.deepEqual(parseFeatureList(['googleCalendar']), ['googleCalendar']);
    assert.equal(parseFeatureList(['googleCalendar', 'googleCalendar']), null);
    assert.equal(parseFeatureList(['adminPowers']), null);
    assert.equal(parseFeatureList(['googleCalendar', 1]), null);
    assert.equal(parseFeatureList('googleCalendar'), null);
    assert.equal(parseFeatureList(undefined), null);
    assert.equal(parseFeatureList({ googleCalendar: true }), null);
  });

  it('takes the account and its features from a request, and refuses ids Firestore cannot use', () => {
    assert.deepEqual(parseFeatureRequest({ uid: 'abc123', features: ['googleCalendar'] }), {
      uid: 'abc123',
      granted: ['googleCalendar']
    });
    assert.deepEqual(parseFeatureRequest({ uid: 'abc123', features: [] }), { uid: 'abc123', granted: [] });
    for (const uid of ['', 'a/b', '.', '..', '__reserved__', 'x'.repeat(129), 7, null, undefined])
      assert.equal(parseFeatureRequest({ uid, features: [] }), null);
    assert.equal(parseFeatureRequest({ uid: 'abc123', features: ['otra'] }), null);
    assert.equal(parseFeatureRequest(null), null);
    assert.equal(isDocumentId('__a'), true);
  });

  it('knows each id of the catalog and nothing else', () => {
    for (const id of FEATURE_IDS) assert.equal(isFeatureId(id), true);
    assert.equal(isFeatureId('toString'), false);
    assert.equal(isFeatureId(''), false);
  });
});
