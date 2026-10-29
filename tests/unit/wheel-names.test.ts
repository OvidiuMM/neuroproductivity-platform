import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAreas, storableAreas } from '../../src/services/wheel.ts';

// En español, una de partida guardada con su nombre inglés de partida (p. ej. desde una descarga hecha en inglés) se
// muestra con el español; lo que se guarda en español no cambia
test('a starting area saved with its English starting name shows in Spanish', () => {
  assert.deepEqual(
    resolveAreas([
      { id: 'Salud', label: 'Health' },
      { id: 'Ocio', label: 'Leisure', hidden: true },
      { id: 'Familia', label: 'Mi gente' },
      { id: 'area-a1', label: 'Health' }
    ]),
    [
      { id: 'Salud', label: 'Salud' },
      { id: 'Ocio', label: 'Ocio', hidden: true },
      { id: 'Familia', label: 'Mi gente' },
      { id: 'area-a1', label: 'Health' }
    ]
  );
  const areas = [
    { id: 'Salud', label: 'Salud' },
    { id: 'Familia', label: 'Mi gente' }
  ];
  assert.deepEqual(storableAreas(areas), areas);
});
