/**
 * Geometria de zonas derivada dos ecopontos (cliente).
 *
 * Cada zona é um agrupamento de ecopontos; o seu polígono é o invólucro convexo
 * (convex hull) das coordenadas desses ecopontos. Como é calculado a partir dos
 * ecopontos atuais, atualiza-se automaticamente à medida que são adicionados.
 */

export type LatLng = [number, number]

// Buffer (~80 m) usado quando a zona tem poucos pontos para formar polígono.
const BUFFER_DEG = 0.0007

/** Convex hull (Andrew's monotone chain). Recebe/devolve pontos [lat, lng]. */
export function convexHull(points: LatLng[]): LatLng[] {
  const unique = dedupe(points)
  if (unique.length < 3) return unique

  // x = lng (p[1]), y = lat (p[0])
  const pts = [...unique].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])

  const lower: LatLng[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: LatLng[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/**
 * Polígono apresentável de uma zona. Usa o convex hull; se os pontos não chegam
 * para um polígono (1–2 ecopontos ou colineares), devolve um pequeno retângulo
 * em redor do centróide para a zona continuar visível no mapa.
 */
export function zonaPolygon(points: LatLng[]): LatLng[] {
  const hull = convexHull(points)
  if (hull.length >= 3) return hull
  if (points.length === 0) return []

  const lat = points.reduce((s, p) => s + p[0], 0) / points.length
  const lng = points.reduce((s, p) => s + p[1], 0) / points.length
  return [
    [lat + BUFFER_DEG, lng - BUFFER_DEG],
    [lat + BUFFER_DEG, lng + BUFFER_DEG],
    [lat - BUFFER_DEG, lng + BUFFER_DEG],
    [lat - BUFFER_DEG, lng - BUFFER_DEG],
  ]
}

function dedupe(points: LatLng[]): LatLng[] {
  const seen = new Set<string>()
  const out: LatLng[] = []
  for (const p of points) {
    const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(p)
    }
  }
  return out
}
