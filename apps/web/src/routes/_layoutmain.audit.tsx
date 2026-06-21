import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldCheck, Search, Download, User, Settings, FileText, Trash2, LogIn, LogOut, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'
import type { AuditLogRecord, ListAuditLogsResponse } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/audit')({
  beforeLoad: requireRole(['gestor', 'admin']),
  component: AuditPage,
})

type TipoAcao = AuditLogRecord['acao']

const acaoConfig: Record<TipoAcao, { label: string; color: string; icon: React.ElementType }> = {
  login:  { label: 'Login',       color: '#60a5fa', icon: LogIn    },
  logout: { label: 'Logout',      color: '#94a3b8', icon: LogOut   },
  create: { label: 'Criação',     color: 'oklch(0.55 0.18 150)', icon: FileText  },
  update: { label: 'Alteração',   color: '#fb923c', icon: Settings },
  delete: { label: 'Eliminação',  color: '#f87171', icon: Trash2   },
  config: { label: 'Configuração',color: '#a78bfa', icon: Settings },
}

const tipoFiltros: { label: string; value: TipoAcao | 'todos' | 'login_logout' }[] = [
  { label: 'Todos',        value: 'todos'       },
  { label: 'Login/Logout', value: 'login_logout'},
  { label: 'Criação',      value: 'create'      },
  { label: 'Alteração',    value: 'update'      },
  { label: 'Eliminação',   value: 'delete'      },
  { label: 'Configuração', value: 'config'      },
]

function AuditPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  // page + acao + pesquisa vivem na URL (nuqs).
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { q: parseAsString.withDefault(''), acao: parseAsString.withDefault('todos') },
    10,
  )
  const { page, q, acao: filtroAcao } = params
  const [busca, setBusca] = useState(q)

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (filtroAcao !== 'todos') sp.set('acao', filtroAcao)
      if (q.trim()) sp.set('q', q.trim())
      const res = await fetchJson<ListAuditLogsResponse>(`/v1/audit-logs?${sp}`, {
        baseUrl: clientEnv.apiBaseUrl,
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      setLogs(res.logs)
      setTotal(res.total)
    } catch (err) {
      setLogs([])
      setTotal(0)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar os logs de auditoria.'))
    } finally {
      setLoading(false)
    }
  }, [page, q, filtroAcao, pageSize])

  // Empurra a pesquisa para a URL com debounce (setFilters volta à página 1).
  useEffect(() => {
    if (busca === q) return
    const t = setTimeout(() => setFilters({ q: busca }), 350)
    return () => clearTimeout(t)
  }, [busca, q, setFilters])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const pageCount = Math.ceil(total / pageSize)

  function csvFrom(rows: AuditLogRecord[]) {
    const header = 'Utilizador,Papel,Ação,Descrição,IP,Data,Hora'
    const body = rows.map(l =>
      [l.utilizador, l.papel, l.acao, `"${l.descricao.replace(/"/g, '""')}"`, l.ip, l.data, l.hora].join(',')
    )
    return [header, ...body].join('\n')
  }

  // Exporta TODOS os registos que correspondem aos filtros (não só a página
  // atual): faz um pedido dedicado com pageSize alto, independente da paginação.
  async function exportCsv() {
    setListError(null)
    try {
      const sp = new URLSearchParams({ page: '1', pageSize: '10000' })
      if (filtroAcao !== 'todos') sp.set('acao', filtroAcao)
      if (q.trim()) sp.set('q', q.trim())
      const res = await fetchJson<ListAuditLogsResponse>(`/v1/audit-logs?${sp}`, {
        baseUrl: clientEnv.apiBaseUrl,
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      const csv = csvFrom(res.logs)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Não foi possível exportar os logs.'))
    }
  }

  const kpis = [
    { label: 'Total de ações',    value: total,                                              color: '#60a5fa' },
    { label: 'Utilizadores ativos',value: new Set(logs.map(l => l.utilizador)).size,          color: 'oklch(0.55 0.18 150)' },
    { label: 'Eliminações',       value: logs.filter(l => l.acao === 'delete').length,        color: '#f87171' },
    { label: 'Configurações',     value: logs.filter(l => l.acao === 'config').length,        color: '#a78bfa' },
  ]

  return (
    <div className="flex flex-col gap-8 pb-12">

      {listError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Tentar novamente</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Auditoria e Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{loading ? '...' : total} registos de auditoria</p>
        </div>
        <button
          onClick={() => void exportCsv()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((s) => (
          <Card key={s.label} className="border border-border/70 shadow-sm rounded-xl">
            <CardContent className="pt-4 pb-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{loading ? '-' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {tipoFiltros.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilters({ acao: f.value })}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                filtroAcao === f.value
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40 hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar utilizador ou ação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
          />
        </div>
      </div>

      <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Utilizador</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ação</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Descrição</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">IP</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> A carregar...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck className="w-8 h-8 opacity-30" />
                      Nenhum registo encontrado
                    </div>
                  </td>
                </tr>
              ) : logs.map((l, i) => {
                const cfg = acaoConfig[l.acao] ?? acaoConfig['create']!
                const Icon = cfg.icon
                return (
                  <tr key={l.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{l.utilizador}</p>
                          <p className="text-[10px] text-muted-foreground">{l.papel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full w-fit text-[10px] font-medium" style={{ color: cfg.color, backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)` }}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-muted-foreground max-w-xs truncate">{l.descricao}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{l.ip}</code>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-foreground">{l.data}</p>
                      <p className="text-[10px] text-muted-foreground">{l.hora}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {!loading && total > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total} registo{total !== 1 ? 's' : ''}</span>
            <span>Página {page} de {pageCount}</span>
          </div>
          <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  )
}
