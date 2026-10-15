import { createContext, useContext, useMemo } from 'react';
import type { WheelArea, WheelCategory } from '../types';
import { DEFAULT_AREAS, areaLabel, selectableAreas, visibleAreas } from '../services/wheel';

// Áreas de la Rueda de la cuenta (las da App desde el perfil); fuera de App, las de partida
export const AreasContext = createContext<WheelArea[]>(DEFAULT_AREAS);

// Las áreas, las visibles, su nombre y las que se pueden elegir (con la elegida aunque esté oculta)
export const useAreas = () => {
  const areas = useContext(AreasContext);
  return useMemo(
    () => ({
      areas,
      visible: visibleAreas(areas),
      label: (id: WheelCategory | undefined) => areaLabel(areas, id),
      selectable: (current?: WheelCategory) => selectableAreas(areas, current)
    }),
    [areas]
  );
};
