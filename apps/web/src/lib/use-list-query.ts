/**
 * Estado de listagem paginada guardado na URL (via nuqs).
 *
 * Centraliza o padrão usado por todas as páginas de lista: `page` (1-based) +
 * filtros/pesquisa, todos refletidos na query string. Vantagens: URLs
 * partilháveis, back/forward do browser e recarga preservam o estado — e a BD
 * só busca a página pedida (ver endpoints paginados na API).
 *
 * Uso:
 *   const { params, setPage, setFilters, pageSize } = useListQuery(
 *     { q: parseAsString.withDefault(''), role: parseAsString.withDefault('todos') },
 *     10,
 *   )
 *   // params.page, params.q, params.role
 *   // setPage(2)                 — muda de página
 *   // setFilters({ q: 'ana' })   — altera filtros E volta à página 1
 */
import { useCallback } from 'react'
import { useQueryStates, parseAsInteger, parseAsString } from 'nuqs'

// Re-exportados para as páginas declararem os parsers dos seus filtros sem
// importarem o nuqs diretamente.
export { parseAsString, parseAsInteger }

type Filters = Parameters<typeof useQueryStates>[0]

export function useListQuery<F extends Filters>(filters: F, pageSize = 10) {
  const [params, setParams] = useQueryStates(
    { page: parseAsInteger.withDefault(1), ...filters },
    // history 'replace' (default do nuqs) evita poluir o histórico ao escrever
    // a pesquisa; clearOnDefault mantém a URL limpa nos valores por omissão.
    { clearOnDefault: true },
  )

  const setPage = useCallback(
    (page: number) => {
      void setParams({ page } as any)
    },
    [setParams],
  )

  /** Aplica alterações de filtros/pesquisa e volta sempre à página 1. */
  const setFilters = useCallback(
    (values: Partial<typeof params>) => {
      void setParams({ ...values, page: 1 })
    },
    [setParams],
  )

  return { params, setParams, setPage, setFilters, pageSize }
}
