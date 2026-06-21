/**
 * Sorteio aleatório de perguntas do banco/pool (RF-19).
 *
 * Usa Fisher-Yates com um RNG injetável (`() => number` no intervalo [0, 1))
 * para ser determinístico em testes. Em runtime usa `Math.random`.
 */
export type Rng = () => number;

/** Embaralha uma cópia do array (não muta o original). Fisher-Yates. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Sorteia até `n` elementos distintos de `pool`. Se o pool for menor que `n`,
 * devolve todos (embaralhados). Nunca devolve duplicados.
 */
export function sample<T>(pool: readonly T[], n: number, rng: Rng = Math.random): T[] {
  if (n <= 0) return [];
  return shuffle(pool, rng).slice(0, Math.min(n, pool.length));
}
