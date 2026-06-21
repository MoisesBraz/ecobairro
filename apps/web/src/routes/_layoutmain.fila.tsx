import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import { getAccessToken } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Calendar, ChevronUp, ChevronDown, User, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import type { TarefaRecord, ListFilaResponse } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/fila')({
  beforeLoad: requireRole(['gestor', 'admin']),
  component: FilaPage,
})

type Prioridade = TarefaRecord['prioridade']
type EstadoTarefa = TarefaRecord['estado']

const prioridadeConfig: Record<Prioridade, { label: string; color: string; order: number }> = {
  critica: { label: 'Crítica', color: '#f87171', order: 0 },
  alta:    { label: 'Alta',    color: '#fb923c', order: 1 },
  normal:  { label: 'Normal',  color: '#60a5fa', order: 2 },
  baixa:   { label: 'Baixa',   color: '#94a3b8', order: 3 },
}

const estadoConfig: Record<EstadoTarefa, { label: string; color: string; icon: React.ElementType }> = {
  pendente:  { label: 'Pendente',  color: '#fb923c',              icon: Clock         },
  em_curso:  { label: 'Em curso',  color: '#60a5fa',              icon: AlertTriangle },
  resolvido: { label: 'Resolvido', color: 'oklch(0.55 0.18 150)', icon: CheckCircle   },
}

const ordens: Prioridade[] = ['critica', 'alta', 'normal', 'baixa']
const operadores = ['Pedro Mendes', 'Sofia Lopes', 'Carlos Lima']

function FilaPage() {
  const [tarefas, setTarefas] = useState<TarefaRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  // page + estado vivem na URL (nuqs). A ordenação por prioridade é feita na BD.
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { estado: parseAsString.withDefault('todos') },
    10,
  )
  const { page, estado: filtroEstado } = params

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const reqParams: Record<string, string | number> = { page, pageSize }
      if (filtroEstado !== 'todos') reqParams.estado = filtroEstado
      const res = await fetchJson<ListFilaResponse>('/v1/fila', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        params: reqParams,
      })
      setTarefas(res.tarefas)
      setTotal(res.total)
    } catch (err) {
      setTarefas([])
      setTotal(0)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar a fila de tarefas.'))
    } finally {
      setLoading(false)
    }
  }, [page, filtroEstado, pageSize])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const pageCount = Math.ceil(total / pageSize)

  async function patchTarefa(id: string, data: Record<string, unknown>) {
    const updated = await fetchJson<TarefaRecord>(`/v1/fila/${id}`, {
      baseUrl: clientEnv.apiBaseUrl,
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    setTarefas(prev => prev.map(t => t.id === id ? updated : t))
  }

  async function moverPrioridade(id: string, dir: 'up' | 'down') {
    const tarefa = tarefas.find(t => t.id === id)
    if (!tarefa) return
    const idx = ordens.indexOf(tarefa.prioridade)
    const novoIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(ordens.length - 1, idx + 1)
    if (novoIdx === idx) return
    await patchTarefa(id, { prioridade: ordens[novoIdx] })
  }

  async function atribuir(id: string, op: string) {
    await patchTarefa(id, { atribuido: op, estado: 'em_curso' })
  }

  async function resolver(id: string) {
    await patchTarefa(id, { estado: 'resolvido' })
  }

  const lista = tarefas
    .filter(t => filtroEstado === 'todos' || t.estado === filtroEstado)
    .sort((a, b) => prioridadeConfig[a.prioridade].order - prioridadeConfig[b.prioridade].order)

  const counts = {
    pendente:  tarefas.filter(t => t.estado === 'pendente').length,
    em_curso:  tarefas.filter(t => t.estado === 'em_curso').length,
    resolvido: tarefas.filter(t => t.estado === 'resolvido').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-12">

      {listError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Tentar novamente</button>
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-foreground">Fila de Prioridades</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{tarefas.filter(t => t.estado !== 'resolvido').length} tarefas em aberto</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendentes', value: counts.pendente,  color: '#fb923c' },
          { label: 'Em curso',  value: counts.em_curso,  color: '#60a5fa' },
          { label: 'Resolvidas',value: counts.resolvido, color: 'oklch(0.55 0.18 150)' },
        ].map(s => (
          <Card key={s.label} className="border border-border/70 shadow-sm rounded-xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {([
          { label: 'Todas',    value: 'todos'     },
          { label: 'Pendente', value: 'pendente'  },
          { label: 'Em curso', value: 'em_curso'  },
          { label: 'Resolvida',value: 'resolvido' },
        ] as const).map(f => (
          <button key={f.value} onClick={() => setFilters({ estado: f.value })}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${filtroEstado === f.value ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {lista.map((t) => {
          const prioCfg = prioridadeConfig[t.prioridade]
          const estCfg = estadoConfig[t.estado]
          const EstIcon = estCfg.icon
          return (
            <Card key={t.id} className="border border-border/70 shadow-sm rounded-xl hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                    <button onClick={() => moverPrioridade(t.id, 'up')} className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: prioCfg.color }} />
                    <button onClick={() => moverPrioridade(t.id, 'down')} className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground leading-snug">{t.titulo}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ color: prioCfg.color, backgroundColor: `color-mix(in srgb, ${prioCfg.color} 12%, transparent)` }}>
                          {prioCfg.label}
                        </span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ color: estCfg.color, backgroundColor: `color-mix(in srgb, ${estCfg.color} 12%, transparent)` }}>
                          <EstIcon className="w-3 h-3" />
                          {estCfg.label}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{t.local}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(t.criado_em).toLocaleDateString('pt-PT')}</span>
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{t.tipo}</span>
                    </div>
                    {t.estado !== 'resolvido' && (
                      <div className="flex items-center gap-3 mt-2.5">
                        {t.atribuido ? (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="w-3 h-3" /> {t.atribuido}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <select
                              onChange={(e) => e.target.value && atribuir(t.id, e.target.value)}
                              defaultValue=""
                              className="text-xs border border-border rounded-lg px-2 py-0.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50"
                            >
                              <option value="">Atribuir a...</option>
                              {operadores.map(op => <option key={op} value={op}>{op}</option>)}
                            </select>
                          </div>
                        )}
                        {t.estado === 'em_curso' && (
                          <button onClick={() => resolver(t.id)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
                            <CheckCircle className="w-3 h-3" /> Marcar resolvida
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {total > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total} tarefa{total !== 1 ? 's' : ''}</span>
            <span>Página {page} de {pageCount}</span>
          </div>
          <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  )
}
