/** Mapas disponibles. Por ahora hay uno solo; para sumar otro: una entrada acá y su clase de mapa (ver `TestMap`). */
export interface MapInfo {
  id: string;
  name: string;
  description: string;
}

export const MAPS: readonly MapInfo[] = [
  {
    id: 'park',
    name: 'PARQUE CENTRAL',
    description: 'Un parque con fuente, caminos, árboles y bancos. Hay cajas y rocas para romper y juntar oro.',
  },
];

export const DEFAULT_MAP_ID = MAPS[0].id;
