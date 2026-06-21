import { createFileRoute } from '@tanstack/react-router'
import { AlertCircle, Clock3, Download, FileText, Loader2, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requireRole, getAccessToken, getUser } from '@/lib/auth'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import type {
  ListReportsResponse,
  ReportRecord,
  ReportStatsResponse,
  ReportStatus,
} from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/dashboard')({
  beforeLoad: requireRole(['operador', 'gestor', 'admin']),
  component: DashboardPage,
})

const estadoBadge: Record<ReportStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  analise: { label: 'Em análise', variant: 'default' },
  resolvido: { label: 'Resolvido', variant: 'secondary' },
  rejeitado: { label: 'Rejeitado', variant: 'destructive' },
}

const EXPORT_LIMIT = 100

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function DashboardPage() {
  const user = getUser()
  // page + status + pesquisa vivem na URL (nuqs).
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { q: parseAsString.withDefault(''), status: parseAsString.withDefault('todos') },
    10,
  )
  const { page, q, status: filtroEstado } = params
  const [busca, setBusca] = useState(q)

  const [stats, setStats] = useState<ReportStatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [reports, setReports] = useState<ReportRecord[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // Empurra a pesquisa para a URL com debounce (setFilters volta à página 1).
  useEffect(() => {
    if (busca === q) return
    const id = window.setTimeout(() => setFilters({ q: busca }), 300)
    return () => window.clearTimeout(id)
  }, [busca, q, setFilters])

  const loadStats = useCallback(async () => {
    if (!getAccessToken()) {
      setStatsError('Sessão inválida. Faça login novamente.')
      setStatsLoading(false)
      return
    }
    setStatsLoading(true)
    setStatsError(null)
    try {
      const data = await fetchJson<ReportStatsResponse>('/v1/reports/stats', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
        params: { scope: 'global', recentLimit: 0 },
      })
      setStats(data)
    } catch (err) {
      setStatsError(getApiErrorMessage(err, 'Não foi possível carregar os indicadores.'))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadReports = useCallback(async () => {
    if (!getAccessToken()) {
      setListError('Sessão inválida. Faça login novamente.')
      setListLoading(false)
      return
    }
    setListLoading(true)
    setListError(null)
    try {
      const reqParams: Record<string, string | number> = {
        page,
        pageSize,
      }
      if (filtroEstado !== 'todos') reqParams.status = filtroEstado
      if (q.trim()) reqParams.q = q.trim()

      const data = await fetchJson<ListReportsResponse>('/v1/reports', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
        params: reqParams,
      })
      setReports(data.reports)
      setTotal(data.total)
    } catch (err) {
      setReports([])
      setTotal(0)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar os reportes recentes.'))
    } finally {
      setListLoading(false)
    }
  }, [page, filtroEstado, q, pageSize])

  useEffect(() => {
    const id = window.setTimeout(() => { void loadStats() }, 0)
    return () => window.clearTimeout(id)
  }, [loadStats])
  useEffect(() => {
    const id = window.setTimeout(() => { void loadReports() }, 0)
    return () => window.clearTimeout(id)
  }, [loadReports])

  const pageCount = Math.ceil(total / pageSize)

  const totals = stats?.byStatus ?? { pendente: 0, analise: 0, resolvido: 0, rejeitado: 0 }
  const totalAll = stats?.total ?? 0
  const taxaResolucao = totalAll > 0 ? Math.round((totals.resolvido / totalAll) * 100) : 0

  const kpiCards = useMemo(() => [
    { title: 'Total de Reportes', value: totalAll, extra: 'registos em base de dados', icon: FileText },
    { title: 'Pendentes', value: totals.pendente, extra: 'a aguardar triagem', icon: Clock3 },
    { title: 'Em Análise', value: totals.analise, extra: 'em processamento', icon: Loader2 },
    { title: 'Resolvidos', value: totals.resolvido, extra: 'fechados com sucesso', icon: FileText },
    { title: 'Rejeitados', value: totals.rejeitado, extra: 'encerrados como inválidos', icon: AlertCircle },
    { title: 'Taxa de Resolução', value: `${taxaResolucao}%`, extra: 'resolvidos / total', icon: FileText },
  ] as const, [totalAll, totals, taxaResolucao])

  // Exporta os reportes que correspondem aos filtros atuais (não só a página
  // visível): pedido dedicado com pageSize alto, independente da paginação.
  const exportCsv = useCallback(async () => {
    try {
      const reqParams: Record<string, string | number> = { page: 1, pageSize: EXPORT_LIMIT }
      if (filtroEstado !== 'todos') reqParams.status = filtroEstado
      if (q.trim()) reqParams.q = q.trim()
      const data = await fetchJson<ListReportsResponse>('/v1/reports', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
        params: reqParams,
      })
      const header = 'ID,Local,Tipo,Estado,Data'
      const rows = data.reports.map(r =>
        [r.id.slice(0, 8), `"${r.local.replace(/"/g, '""')}"`, r.tipo, r.status, r.data].join(','),
      )
      const csv = [header, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reportes-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Não foi possível exportar os reportes.'))
    }
  }, [filtroEstado, q])

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Banner */}
      <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-r from-[var(--card)] to-[var(--primary-light)]">
        <CardContent className="p-6 sm:p-8">
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Bem-vindo, <span className="text-[var(--primary)]">{(user?.name ?? 'Utilizador').split(' ')[0]}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resumo operacional da plataforma ecoBairro — {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {(statsLoading || listLoading) && <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />}
        </CardContent>
      </Card>

      {statsError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {statsError}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title} className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">{kpi.title}</p>
                <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-primary/10">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xl font-bold text-foreground">{statsLoading ? '—' : kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.extra}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Top zonas (locais) */}
      {!statsLoading && stats && stats.zonas.length > 0 && (
        <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Locais com mais reportes</CardTitle>
            <CardDescription>Top {stats.zonas.length} locais distintos</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-wrap gap-2">
            {stats.zonas.map(z => (
              <span key={z.zona} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {z.zona} · {z.total}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabela reportes */}
      <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Reportes Recentes</CardTitle>
              <CardDescription>
                Últimas ocorrências registadas na plataforma {total > 0 && `· ${total} resultado${total !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input type="text" placeholder="Pesquisar..." value={busca} onChange={e => setBusca(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 w-44" />
              </div>
              <select value={filtroEstado} onChange={e => setFilters({ status: e.target.value })}
                className="px-3 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none">
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="analise">Em análise</option>
                <option value="resolvido">Resolvido</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
              <button
                onClick={() => void exportCsv()}
                disabled={total === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listError && (
            <div className="px-4 py-3 text-sm text-destructive border-b border-destructive/30 bg-destructive/10">
              {listError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['ID', 'Local', 'Tipo', 'Estado', 'Há'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin inline-block" />
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhum reporte encontrado</td></tr>
                ) : (
                  reports.map((r, i) => {
                    const badge = estadoBadge[r.status]
                    return (
                      <tr key={r.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="px-4 py-2.5"><code className="text-[11px] text-muted-foreground">{r.id.slice(0, 8)}</code></td>
                        <td className="px-4 py-2.5 text-xs text-foreground truncate max-w-[220px]">{r.local}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.tipo}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(r.data)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {!listLoading && total > 0 && (
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{total} reporte{total !== 1 ? 's' : ''}</span>
                <span>Página {page} de {pageCount}</span>
              </div>
              <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function timeAgo(value: string): string {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  return `${days}d`
}
