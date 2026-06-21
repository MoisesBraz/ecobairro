/**
 * Processamento de paginação seguro e uniforme.
 * Remove a repetição de lógica `Math.max` e `Math.min` espalhada pelos módulos.
 *
 * @param page Página atual (começa em 1)
 * @param pageSize Tamanho da página
 * @param defaultSize Tamanho por defeito se omitido
 * @param maxSize Limite máximo para prevenir ataques de overload (default 50)
 * @returns { page: number, pageSize: number }
 */
export function parsePagination(
  page?: string | number | null,
  pageSize?: string | number | null,
  defaultSize = 20,
  maxSize = 50,
): { page: number; pageSize: number } {
  const p = Math.max(1, Math.trunc(Number(page) || 1));
  const s = Math.min(
    maxSize,
    Math.max(1, Math.trunc(Number(pageSize) || defaultSize)),
  );
  return { page: p, pageSize: s };
}
