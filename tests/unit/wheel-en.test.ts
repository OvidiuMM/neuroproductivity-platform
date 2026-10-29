// Las áreas de la Rueda en inglés: las de partida sin renombrar se muestran en el idioma de la app
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WheelArea } from '../../src/types';

const { DEFAULT_AREAS, areaLabel, defaultAreaLabel, resolveAreas, selectableAreas, storableAreas, validateAreas } =
  await import('../../src/services/wheel.ts');

test('the seven starting areas have English names and keep their Spanish ids', () => {
  assert.deepEqual(
    DEFAULT_AREAS.map((a) => [a.id, a.label]),
    [
      ['Salud', 'Health'],
      ['Carrera Profesional', 'Career'],
      ['Finanzas', 'Finances'],
      ['Familia', 'Family'],
      ['Ocio', 'Leisure'],
      ['Relaciones', 'Relationships'],
      ['Espiritualidad', 'Spirituality']
    ]
  );
  assert.equal(defaultAreaLabel('area-abc1'), 'area-abc1');
});

test('a starting area saved with its starting name shows in English; a renamed one keeps its name', () => {
  assert.deepEqual(resolveAreas(undefined), DEFAULT_AREAS);
  assert.deepEqual(
    resolveAreas([
      { id: 'Salud', label: 'Salud' },
      { id: 'Familia', label: 'Family' },
      { id: 'Ocio', label: 'Tiempo libre' },
      { id: 'Finanzas', label: 'Finanzas', hidden: true },
      { id: 'area-a1', label: 'Salud' }
    ]),
    [
      { id: 'Salud', label: 'Health' },
      { id: 'Familia', label: 'Family' },
      { id: 'Ocio', label: 'Tiempo libre' },
      { id: 'Finanzas', label: 'Finances', hidden: true },
      // Un área añadida nunca es de partida, aunque se llame igual
      { id: 'area-a1', label: 'Salud' }
    ]
  );
});

test('starting names are saved as their id, so they follow the language; renamed ones are saved as typed', () => {
  const edited: WheelArea[] = [
    { id: 'Salud', label: 'Health' },
    { id: 'Ocio', label: 'Fun' },
    { id: 'Familia', label: 'Family', hidden: true },
    { id: 'area-a1', label: 'Travel' }
  ];
  assert.deepEqual(storableAreas(edited), [
    { id: 'Salud', label: 'Salud' },
    { id: 'Ocio', label: 'Fun' },
    { id: 'Familia', label: 'Familia', hidden: true },
    { id: 'area-a1', label: 'Travel' }
  ]);
  assert.deepEqual(resolveAreas(storableAreas(edited)), edited);
});

test('an area missing from the list shows its starting name in English', () => {
  assert.equal(areaLabel([], 'Ocio'), 'Leisure');
  assert.equal(areaLabel([], 'area-gone'), 'area-gone');
  assert.deepEqual(selectableAreas([{ id: 'Salud', label: 'Health' }], 'Relaciones').at(-1), {
    id: 'Relaciones',
    label: 'Relationships'
  });
});

test('area validation speaks English', () => {
  const base: WheelArea[] = DEFAULT_AREAS.slice(0, 3);
  assert.equal(validateAreas(base), null);
  assert.equal(validateAreas([...base, { id: 'area-y', label: ' ' }]), 'Each area needs a name.');
  assert.equal(validateAreas([...base, { id: 'area-y', label: 'health' }]), 'Two areas can’t have the same name.');
  assert.equal(
    validateAreas([...base, { id: 'area-y', label: 'x'.repeat(31) }]),
    'Names can’t be longer than 30 characters.'
  );
  assert.equal(validateAreas(base.slice(0, 2)), 'Keep at least 3 areas in view.');
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `area-${i}`, label: `Area ${i}` }));
  assert.equal(validateAreas(many), 'You can have up to 12 areas in view.');
});
