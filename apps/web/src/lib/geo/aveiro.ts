/**
 * Geo helpers do concelho de Aveiro.
 *
 * Centraliza o centro/limites de Aveiro e a pesquisa de moradas via Nominatim
 * restrita ao concelho.
 */

/** Centro de Aveiro usado como centro por defeito dos mapas. */
export const AVEIRO_CENTER = { lat: 40.6443, lng: -8.6455 } as const

/**
 * Caixa envolvente (bounding box) aproximada do concelho de Aveiro.
 */
export const AVEIRO_BBOX = {
  minLat: 40.48,
  maxLat: 40.82,
  minLng: -8.85,
  maxLng: -8.42,
} as const

/** Viewbox no formato do Nominatim (`lon,lat,lon,lat`) — canto NO, canto SE. */
export const AVEIRO_VIEWBOX = `${AVEIRO_BBOX.minLng},${AVEIRO_BBOX.maxLat},${AVEIRO_BBOX.maxLng},${AVEIRO_BBOX.minLat}`

/**
 * Geocoding via Nominatim (OpenStreetMap): grátis, sem chave, CORS aberto.
 */
export const NOMINATIM = 'https://nominatim.openstreetmap.org'

/** Resultado do Nominatim com `addressdetails=1`. */
export interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: {
    municipality?: string
    city?: string
    town?: string
    village?: string
    county?: string
    region?: string
    postcode?: string
  }
}

/**
 * URL de pesquisa do Nominatim restrita ao concelho de Aveiro.
 */
export function buildNominatimSearchUrl(query: string): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    countrycodes: 'pt',
    addressdetails: '1',
    bounded: '1',
    viewbox: AVEIRO_VIEWBOX,
    limit: '5',
    q: query,
  })
  return `${NOMINATIM}/search?${params.toString()}`
}

/**
 * URL de geocoding inverso do Nominatim com detalhes de morada.
 */
export function buildNominatimReverseUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    lat: String(lat),
    lon: String(lng),
  })
  return `${NOMINATIM}/reverse?${params.toString()}`
}

/** Coordenada está dentro da caixa envolvente de Aveiro. */
export function isWithinAveiro(lat: number, lng: number): boolean {
  return (
    lat >= AVEIRO_BBOX.minLat &&
    lat <= AVEIRO_BBOX.maxLat &&
    lng >= AVEIRO_BBOX.minLng &&
    lng <= AVEIRO_BBOX.maxLng
  )
}

/**
 * Resultado do Nominatim pertence a Aveiro.
 */
export function isAveiroNominatimResult(r: NominatimResult): boolean {
  const lat = parseFloat(r.lat)
  const lng = parseFloat(r.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinAveiro(lat, lng)) {
    return false
  }
  const a = r.address
  const municipio = [a?.municipality, a?.city, a?.town, a?.village, a?.county]
    .filter((v): v is string => !!v)
    .map((v) => normalizeText(v))
  if (municipio.length === 0) return true
  return municipio.some((v) => v.includes('aveiro'))
}

/** Minúsculas + sem acentos — pesquisa textual acento-insensível. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
