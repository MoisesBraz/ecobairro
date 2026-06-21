/**
 * Geo helpers do concelho de Aveiro (fonte única no backend).
 *
 * Mantido em sincronia com o frontend (`apps/web/src/lib/geo/aveiro.ts`).
 *
 * Nota: a caixa envolvente é uma aproximação retangular — pode incluir margens de
 * concelhos vizinhos (Ílhavo/Murtosa/...). É usada como defesa em profundidade nos
 * writes (POST/PATCH); a confirmação fina do município (Nominatim) vive no frontend.
 */

/** Caixa envolvente aproximada do concelho de Aveiro. */
export const AVEIRO_BBOX = {
  minLat: 40.54,
  maxLat: 40.75,
  minLng: -8.76,
  maxLng: -8.48,
} as const;

/** Coordenada está dentro da caixa envolvente (aproximada) do concelho de Aveiro. */
export function isWithinAveiro(lat: number, lng: number): boolean {
  return (
    lat >= AVEIRO_BBOX.minLat &&
    lat <= AVEIRO_BBOX.maxLat &&
    lng >= AVEIRO_BBOX.minLng &&
    lng <= AVEIRO_BBOX.maxLng
  );
}
