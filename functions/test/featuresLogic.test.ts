import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FEATURE_IDS, isFeatureId, parseFeatureList } from '../src/featuresLogic';

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

  it('knows each id of the catalog and nothing else', () => {
    for (const id of FEATURE_IDS) assert.equal(isFeatureId(id), true);
    assert.equal(isFeatureId('toString'), false);
    assert.equal(isFeatureId(''), false);
  });
});
