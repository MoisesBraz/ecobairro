/**
 * Derivação automática de zona por proximidade.
 *
 * A zona deixou de ser um conceito gerido à mão: passa a ser uma etiqueta string
 * derivada da localização do ecoponto. Um ponto novo herda a zona do vizinho mais
 * próximo dentro de {@link ZONA_RAIO_METROS}; se estiver isolado, a zona é nomeada
 * pela sua morada.
 */

/** Raio (em metros) abaixo do qual dois ecopontos pertencem à mesma zona. */
export const ZONA_RAIO_METROS = 50;

/** Raio da Terra em metros (haversine). */
const RAIO_TERRA_METROS = 6_371_000;

export type Coordenada = { lat: number; lng: number };
export type ZonaCandidato = Coordenada & { zona: string | null };

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function haversineMetros(a: Coordenada, b: Coordenada): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * RAIO_TERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Gera o nome de uma zona nova a partir da morada do ponto isolado.
 * Em colisão (morada igual já usada por outra zona) acrescenta sufixo numérico.
 */
function gerarNomeNovaZona(morada: string, existentes: ZonaCandidato[]): string {
  const base = morada.trim() || 'Zona';
  const usados = new Set(
    existentes.map(e => e.zona).filter((z): z is string => !!z),
  );
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

/**
 * Resolve a zona de um ponto: herda a do vizinho mais próximo dentro do raio;
 * senão cria uma zona nomeada pela morada.
 *
 * @param existentes Ecopontos ativos a considerar (exclui o próprio em updates).
 */
export function resolveZona(
  lat: number,
  lng: number,
  morada: string,
  existentes: ZonaCandidato[],
): string {
  let melhor: { zona: string; dist: number } | null = null;
  for (const e of existentes) {
    if (!e.zona) continue;
    const dist = haversineMetros({ lat, lng }, e);
    if (dist <= ZONA_RAIO_METROS && (!melhor || dist < melhor.dist)) {
      melhor = { zona: e.zona, dist };
    }
  }
  if (melhor) return melhor.zona;
  return gerarNomeNovaZona(morada, existentes);
}
