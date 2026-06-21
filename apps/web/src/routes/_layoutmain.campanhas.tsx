import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Megaphone, PlusCircle, Search, Calendar, Eye, Archive, Pencil, X, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'
import type { CampanhaRecord, ListCampanhasResponse, CreateCampanhaRequest } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/campanhas')({
  beforeLoad: requireRole(['gestor', 'admin']),
  component: CampanhasPage,
})

type Estado = CampanhaRecord['estado']

const estadoConfig: Record<Estado, { label: string; color: string; bg: string }> = {
  rascunho:  { label: 'Rascunho',  color: '#94a3b8', bg: 'bg-slate-100 dark:bg-slate-800'  },
  publicada: { label: 'Publicada', color: 'oklch(0.55 0.18 150)', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  expirada:  { label: 'Expirada',  color: '#94a3b8', bg: 'bg-slate-50 dark:bg-slate-900'   },
}

const filtros: { label: string; value: Estado | 'todas' }[] = [
  { label: 'Todas',     value: 'todas'     },
  { label: 'Publicada', value: 'publicada' },
  { label: 'Rascunho',  value: 'rascunho'  },
  { label: 'Expirada',  value: 'expirada'  },
]

const mensagemSchema = z.object({
  titulo: z.string().min(3, 'Título obrigatório (mín. 3 caracteres)'),
  corpo: z.string().min(10, 'Mensagem obrigatória (mín. 10 caracteres)'),
  dataValidade: z.string().min(1, 'Data de validade obrigatória'),
})
type MensagemForm = z.infer<typeof mensagemSchema>

function CampanhasPage() {
  // page + estado + pesquisa vivem na URL (nuqs).
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { q: parseAsString.withDefault(''), estado: parseAsString.withDefault('todas') },
    10,
  )
  const { page, q, estado: filtro } = params
  const [busca, setBusca] = useState(q)
  const [campanhas, setCampanhas] = useState<CampanhaRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<CampanhaRecord | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modalAberto, modalRef, () => setModalAberto(false))

  const headers = useMemo(() => ({ Authorization: `Bearer ${getAccessToken() ?? ''}` }), [])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MensagemForm>({
    resolver: zodResolver(mensagemSchema),
  })

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (filtro !== 'todas') sp.set('estado', filtro)
      if (q.trim()) sp.set('q', q.trim())
      const res = await fetchJson<ListCampanhasResponse>(`/v1/campanhas?${sp}`, {
        baseUrl: clientEnv.apiBaseUrl,
        headers,
      })
      setCampanhas(res.campanhas)
      setTotal(res.total)
    } catch (err) {
      setCampanhas([])
      setTotal(0)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar as campanhas.'))
    } finally {
      setLoading(false)
    }
  }, [page, filtro, headers, q, pageSize])

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

  function abrirNova() {
    setEditando(null)
    reset({ titulo: '', corpo: '', dataValidade: '' })
    setModalAberto(true)
  }

  function abrirEditar(m: CampanhaRecord) {
    setEditando(m)
    reset({ titulo: m.titulo, corpo: m.corpo, dataValidade: '' })
    setModalAberto(true)
  }

  async function onSubmit(data: MensagemForm) {
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (editando) {
        await fetchJson<CampanhaRecord>(`/v1/campanhas/${editando.id}`, {
          baseUrl: clientEnv.apiBaseUrl,
          headers,
          method: 'PATCH',
          body: JSON.stringify({ titulo: data.titulo, corpo: data.corpo, dataValidade: data.dataValidade }),
        })
      } else {
        const body: CreateCampanhaRequest = {
          titulo: data.titulo,
          corpo: data.corpo,
          dataValidade: data.dataValidade,
        }
        await fetchJson<CampanhaRecord>('/v1/campanhas', {
          baseUrl: clientEnv.apiBaseUrl,
          headers,
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      setModalAberto(false)
      await load()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Não foi possível guardar a campanha.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function publicar(id: string) {
    await fetchJson<CampanhaRecord>(`/v1/campanhas/${id}`, {
      baseUrl: clientEnv.apiBaseUrl,
      headers,
      method: 'PATCH',
      body: JSON.stringify({ estado: 'publicada' }),
    })
    await load()
  }

  async function arquivar(id: string) {
    await fetchJson<CampanhaRecord>(`/v1/campanhas/${id}`, {
      baseUrl: clientEnv.apiBaseUrl,
      headers,
      method: 'PATCH',
      body: JSON.stringify({ estado: 'expirada' }),
    })
    await load()
  }

  const contagens = {
    publicada: campanhas.filter(m => m.estado === 'publicada').length,
    rascunho:  campanhas.filter(m => m.estado === 'rascunho').length,
    expirada:  campanhas.filter(m => m.estado === 'expirada').length,
  }

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
          <h1 className="text-xl font-bold text-foreground">Mensagens Institucionais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} mensagens no total</p>
        </div>
        <Button size="sm" className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity self-start sm:self-auto" onClick={abrirNova}>
          <PlusCircle className="w-4 h-4" />
          Nova Mensagem
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Publicadas', value: contagens.publicada, color: 'oklch(0.55 0.18 150)' },
          { label: 'Rascunhos',  value: contagens.rascunho,  color: '#60a5fa' },
          { label: 'Expiradas',  value: contagens.expirada,  color: '#94a3b8' },
        ].map((s) => (
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
          {filtros.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilters({ estado: f.value })}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                filtro === f.value
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40 hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : campanhas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">Sem mensagens</p>
          <p className="text-sm text-muted-foreground">Crie uma nova mensagem institucional.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {campanhas.map((m) => {
            const cfg = estadoConfig[m.estado]
            return (
              <Card key={m.id} className="border border-border/70 shadow-sm rounded-xl hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${cfg.bg}`}>
                      <Megaphone className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground leading-snug">{m.titulo}</p>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ color: cfg.color, backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)` }}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.corpo}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Criada {m.data_criacao}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />Válida até {m.data_validade}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => abrirEditar(m)} className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                        {m.estado === 'rascunho' && (
                          <button onClick={() => publicar(m.id)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
                            <Eye className="w-3 h-3" /> Publicar
                          </button>
                        )}
                        {m.estado === 'publicada' && (
                          <button onClick={() => arquivar(m.id)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:underline">
                            <Archive className="w-3 h-3" /> Arquivar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && total > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total} mensage{total !== 1 ? 'ns' : 'm'}</span>
            <span>Página {page} de {pageCount}</span>
          </div>
          <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalAberto(false)} />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="campanhas-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="campanhas-modal-title" className="text-base font-bold text-foreground">{editando ? 'Editar Mensagem' : 'Nova Mensagem'}</h2>
              <button type="button" aria-label="Fechar modal" onClick={() => setModalAberto(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {submitError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
                <input
                  type="text"
                  {...register('titulo')}
                  placeholder="Título da mensagem..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
                />
                {errors.titulo && <p className="text-xs text-destructive mt-1">{errors.titulo.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem</label>
                <textarea
                  {...register('corpo')}
                  placeholder="Escreva a mensagem para os cidadãos..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 resize-none"
                />
                {errors.corpo && <p className="text-xs text-destructive mt-1">{errors.corpo.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de validade</label>
                <input
                  type="date"
                  {...register('dataValidade')}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50"
                />
                {errors.dataValidade && <p className="text-xs text-destructive mt-1">{errors.dataValidade.message}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalAberto(false)}>Cancelar</Button>
                <Button type="submit" size="sm" className="bg-[var(--primary)] hover:opacity-90 transition-opacity" disabled={submitting}>
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {editando ? 'Guardar' : 'Criar Rascunho'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
