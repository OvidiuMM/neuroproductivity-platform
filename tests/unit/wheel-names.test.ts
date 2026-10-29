import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAreas, storableAreas } from '../../src/services/wheel.ts';

// En español: un área de partida guardada con su identificador se ve con su nombre en español; cualquier otro nombre
// es de la persona y se respeta, aunque sea el de partida en inglés
test('a renamed starting area keeps its name, even if it is the English starting name', () => {
  assert.deepEqual(
    resolveAreas([
      { id: 'Salud', label: 'Salud' },
      { id: 'Ocio', label: 'Leisure', hidden: true },
      { id: 'Familia', label: 'Mi gente' },
      { id: 'area-a1', label: 'Health' }
    ]),
    [
      { id: 'Salud', label: 'Salud' },
      { id: 'Ocio', label: 'Leisure', hidden: true },
      { id: 'Familia', label: 'Mi gente' },
      { id: 'area-a1', label: 'Health' }
    ]
  );
  const areas = [
    { id: 'Salud', label: 'Salud' },
    { id: 'Ocio', label: 'Leisure' },
    { id: 'Familia', label: 'Mi gente' }
  ];
  assert.deepEqual(storableAreas(areas), areas);
});
