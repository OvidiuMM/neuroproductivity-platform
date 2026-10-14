import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRIMARY_TABS, sectionLabel, sectionsFor } from '../../src/navigation';

const access = sectionsFor(true).find((s) => s.tab === 'access')!;

test('the access section says how many requests are pending, in singular or plural', () => {
  assert.equal(sectionLabel(access, 0), 'Accesos');
  assert.equal(sectionLabel(access, 1), 'Accesos, 1 pendiente');
  assert.equal(sectionLabel(access, 3), 'Accesos, 3 pendientes');
});

test('only the admin gets the access section, before the help', () => {
  assert.equal(
    sectionsFor(false).some((s) => s.tab === 'access'),
    false
  );
  assert.deepEqual(
    sectionsFor(true)
      .slice(-2)
      .map((s) => s.tab),
    ['access', 'help']
  );
});

test('every short name on the phone bar is contained in the full accessible name', () => {
  for (const section of sectionsFor(true).filter((s) => PRIMARY_TABS.includes(s.tab))) {
    assert.ok(section.label.includes(section.short), section.label);
  }
});
