import { createFileRoute, useSearch } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MapPin, Calendar, ChevronRight, PlusCircle, Search,
  Clock, CheckCircle, XCircle, AlertCircle, Loader, Package,
  Upload, X, ImageIcon
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken, requireRole } from '@/lib/auth'
import { fileToDataUrl } from '@/lib/image-upload'
import { LocationPicker, type Coords } from '@/components/reportes/location-picker'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { focusFirstInvalidField } from '@/lib/focus-first-invalid-field'
import type {
  CreateReportRequest,
  ListReportsResponse,
  ReportRecord,
  ReportStatsResponse,
  ReportsDuplicadosResponse,
  CancelReportResponse,
  EcopontoRecord,
  ContentorRecord,
  ReportStatus,
} from '@ecobairro/contracts'

interface ReportesSearch {
  novo?: '1'
  local?: string
  tipo?: (typeof tiposReporte)[number]
  // Geridos pelo nuqs (paginação/filtros). Declarados aqui só para o TanStack
  // Router NÃO os remover da URL ao validar — passthrough.
  page?: number
  q?: string
  status?: string
}

export const Route = createFileRoute('/_layoutmain/reportes')({
  beforeLoad: requireRole(['cidadao', 'gestor', 'admin']),
  validateSearch: (raw: Record<string, unknown>): ReportesSearch => {
    const out: ReportesSearch = {}
    if (raw.novo === '1') out.novo = '1'
    if (typeof raw.local === 'string' && raw.local.trim().length > 0) {
      out.local = raw.local
    }
    if (
      typeof raw.tipo === 'string' &&
      (tiposReporte as readonly string[]).includes(raw.tipo)
    ) {
      out.tipo = raw.tipo as ReportesSearch['tipo']
    }
    // Passthrough das chaves do nuqs (não interpretadas aqui).
    if (raw.page !== undefined && Number.isFinite(Number(raw.page))) {
      out.page = Number(raw.page)
    }
    if (typeof raw.q === 'string' && raw.q.length > 0) out.q = raw.q
    if (typeof raw.status === 'string' && raw.status.length > 0) {
      out.status = raw.status
    }
    return out
  },
  component: ReportesPage,
})

/* ─── Config de status ─── */
type Status = ReportStatus

const statusConfig: Record<Status, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pendente:  { label: 'Pendente',   color: '#fbbf24',              bg: 'bg-amber-50 dark:bg-amber-950/30',    icon: Clock       },
  analise:   { label: 'Em Análise', color: '#60a5fa',              bg: 'bg-blue-50 dark:bg-blue-950/30',      icon: Loader      },
  resolvido: { label: 'Resolvido',  color: 'oklch(0.55 0.18 150)', bg: 'bg-emerald-50 dark:bg-emerald-950/30',icon: CheckCircle },
  rejeitado: { label: 'Rejeitado',  color: '#f87171',              bg: 'bg-red-50 dark:bg-red-950/30',        icon: XCircle     },
  cancelado: { label: 'Cancelado',  color: '#f87171',              bg: 'bg-red-50 dark:bg-red-950/30',        icon: XCircle     },
}

const filtrosDef: { label: string; value: Status | 'todos' }[] = [
  { label: 'Todos',      value: 'todos'    },
  { label: 'Pendente',   value: 'pendente' },
  { label: 'Em Análise', value: 'analise'  },
  { label: 'Resolvido',  value: 'resolvido'},
  { label: 'Rejeitado',  value: 'rejeitado'},
  { label: 'Cancelado',  value: 'cancelado'},
]

const tiposReporte = ['Ecoponto Cheio', 'Deposição Ilegal', 'Dano em Equipamento', 'Odores', 'Vandalismo'] as const
const contentorRequiredTypes = ['Ecoponto Cheio', 'Dano em Equipamento'] as const

function isContentorRequiredType(tipo: (typeof tiposReporte)[number]): tipo is (typeof contentorRequiredTypes)[number] {
  return (contentorRequiredTypes as readonly string[]).includes(tipo)
}

const novoReporteSchema = z.object({
  titulo:    z.string().min(3, 'Título obrigatório (mín. 3 caracteres)'),
  tipo:      z.enum(tiposReporte, { message: 'Selecione um tipo' }),
  descricao: z.string().min(10, 'Descrição obrigatória (mín. 10 caracteres)'),
  local:     z.string().min(3, 'Local obrigatório'),
  imagem:    z.custom<FileList>()
    .refine(fl => !fl || fl.length === 0 || fl[0].size <= 5 * 1024 * 1024, 'Tamanho máximo: 5 MB')
    .refine(fl => !fl || fl.length === 0 || ['image/jpeg', 'image/png', 'image/webp'].includes(fl[0].type), 'Formato não suportado (JPG, PNG ou WebP)')
    .optional(),
})

type NovoReporteForm = z.infer<typeof novoReporteSchema>

const POR_PAGINA = 5

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/* ─── Página ─── */
function ReportesPage() {
  const search = useSearch({ from: '/_layoutmain/reportes' })
  // page + status + pesquisa vivem na URL (nuqs).
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { q: parseAsString.withDefault(''), status: parseAsString.withDefault('todos') },
    POR_PAGINA,
  )
  const { page, q, status: filtro } = params
  const [busca, setBusca]       = useState(q)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [total, setTotal]       = useState(0)
  const [reportes, setReportes] = useState<ReportRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modalAberto, modalRef, () => fecharModal())

  const { register, handleSubmit, watch, getValues, reset, setValue, formState: { errors } } = useForm<NovoReporteForm>({
    resolver: zodResolver(novoReporteSchema),
  })

  // Localização opcional (lat/lng) escolhida no mapa/pesquisa, fora do react-hook-form.
  const [coords, setCoords] = useState<Coords | null>(null)
  const [selectedEcoponto, setSelectedEcoponto] = useState<EcopontoRecord | null>(null)
  const [selectedContentor, setSelectedContentor] = useState<ContentorRecord | null>(null)
  // Aviso de duplicados (R8) — calculado quando há coords + tipo.
  const [dupes, setDupes] = useState<ReportsDuplicadosResponse | null>(null)
  const tipoWatch = watch('tipo')

  // Deteção de duplicados antes de submeter (debounced). Servido pelo FastAPI.
  useEffect(() => {
    if (!coords || !tipoWatch) { setDupes(null); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetchJson<ReportsDuplicadosResponse>('/reports/duplicados', {
          baseUrl: clientEnv.analyticsBaseUrl,
          headers: authHeaders(),
          params: { lat: coords.lat, lng: coords.lng, categoria: tipoWatch, raio: 150 },
        })
        setDupes(r)
      } catch { setDupes(null) }
    }, 500)
    return () => clearTimeout(t)
  }, [coords, tipoWatch])

  const imagemWatch = watch('imagem')
  const imagemFile  = imagemWatch?.[0]

  useEffect(() => {
    if (!imagemFile) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(imagemFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imagemFile])

  /* ─ Carregamento da lista (paginação no servidor) ─ */
  const load = useCallback(async () => {
    if (!getAccessToken()) {
      setListError('Sessão inválida. Faça login novamente.')
      setLoading(false)
      return
    }
    setLoading(true)
    setListError(null)
    try {
      const reqParams: Record<string, string | number> = {
        page,
        pageSize,
      }
      if (filtro !== 'todos') reqParams.status = filtro
      if (q.trim())           reqParams.q      = q.trim()

      const resp = await fetchJson<ListReportsResponse>('/v1/reports/me', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
        params: reqParams,
      })
      setReportes(resp.reports)
      setTotal(resp.total)
    } catch (err) {
      setReportes([])
      setTotal(0)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar os reportes.'))
    } finally {
      setLoading(false)
    }
  }, [page, filtro, q, pageSize])

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

  /* KPIs — carregados uma vez via endpoint agregado */
  const [contagens, setContagens] = useState<Record<ReportStatus, number>>({ pendente: 0, analise: 0, resolvido: 0, rejeitado: 0, cancelado: 0 })
  const [totalGeral, setTotalGeral] = useState(0)

  const loadKpis = useCallback(async () => {
    if (!getAccessToken()) return
    try {
      const stats = await fetchJson<ReportStatsResponse>('/v1/reports/stats', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
        params: { scope: 'me', recentLimit: 0 },
      })
      setContagens(stats.byStatus)
      setTotalGeral(stats.total)
    } catch { /* mantém zeros — banner de erro da lista já cobre o caso geral */ }
  }, [])

  useEffect(() => { void loadKpis() }, [loadKpis])

  /* ─ Modal ─ */
  const abrirModal = useCallback((prefill?: Partial<NovoReporteForm>) => {
    reset({
      titulo: prefill?.titulo ?? '',
      tipo: prefill?.tipo,
      descricao: prefill?.descricao ?? '',
      local: prefill?.local ?? '',
    })
    setPreviewUrl(null)
    setSubmitError(null)
    setCoords(null)
    setDupes(null)
    setSelectedEcoponto(null)
    setSelectedContentor(null)
    setModalAberto(true)
  }, [reset])
  function fecharModal() { 
    setModalAberto(false); 
    setPreviewUrl(null); 
    setSubmitError(null); 
    setCoords(null); 
    setDupes(null);
    setSelectedEcoponto(null);
    setSelectedContentor(null);
    reset() 
  }

  // Reset ecoponto/contentor selections when report type changes
  useEffect(() => {
    if (tipoWatch) {
      setSelectedEcoponto(null)
      setSelectedContentor(null)
      setCoords(null)
      setValue('local', '')
    }
  }, [tipoWatch, setValue])

  /* ─ Auto-open via ?novo=1 (deep link da home ou do mapa) ─ */
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (autoOpenedRef.current) return
    if (search.novo !== '1') return
    autoOpenedRef.current = true
    abrirModal({
      local: search.local,
      tipo: search.tipo,
    })
  }, [search.novo, search.local, search.tipo, abrirModal])

  async function onSubmitReporte(data: NovoReporteForm) {
    if (isContentorRequiredType(data.tipo) && !selectedContentor) {
      setSubmitError('Selecione um contentor de ecoponto no mapa.')
      focusFirstInvalidField(modalRef.current, ['local'])
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const file = data.imagem?.[0]
      const body: CreateReportRequest = {
        titulo: data.titulo,
        tipo: data.tipo,
        descricao: data.descricao,
        local: data.local,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        ...(selectedEcoponto ? { ecopontoId: selectedEcoponto.id } : {}),
        ...(selectedContentor ? { contentorId: selectedContentor.id } : {}),
        ...(file ? { imagem: await fileToDataUrl(file) } : {}),
      }
      await fetchJson('/v1/reports', {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'POST',
        body: JSON.stringify(body),
        headers: authHeaders(),
      })
      fecharModal()
      await Promise.all([load(), loadKpis()])
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Não foi possível submeter o reporte. Tente novamente.'))
    } finally { setSubmitting(false) }
  }

  function onInvalidReporte(formErrors: FieldErrors<NovoReporteForm>) {
    const fieldOrder: (keyof NovoReporteForm)[] = ['titulo', 'tipo', 'local', 'descricao', 'imagem']
    const firstInvalidField = fieldOrder.find(field => formErrors[field])
    if (firstInvalidField) focusFirstInvalidField(modalRef.current, [firstInvalidField])
  }

  async function confirmCancelReporte() {
    if (!cancelTargetId) return
    const id = cancelTargetId
    setCancellingId(id)
    setCancelError(null)
    try {
      await fetchJson<CancelReportResponse>(`/v1/reports/${id}`, {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'DELETE',
        headers: authHeaders(),
      })
      await Promise.all([load(), loadKpis()])
      setExpandido(null)
      setCancelTargetId(null)
    } catch (error) {
      setCancelError(getApiErrorMessage(error, 'Não foi possível cancelar o reporte.'))
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-10 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Os Meus Reportes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${totalGeral} report${totalGeral !== 1 ? 'es' : ''} submetido${totalGeral !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity self-start sm:self-auto rounded-xl" onClick={() => abrirModal()}>
          <PlusCircle className="w-4 h-4" />
          Novo Reporte
        </Button>
      </div>

      {/* ── Resumo KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes',  value: contagens.pendente,  icon: Clock,       color: '#fb923c',              desc: 'aguardando triagem'    },
          { label: 'Em Análise', value: contagens.analise,   icon: Loader,      color: '#60a5fa',              desc: 'em processamento'      },
          { label: 'Resolvidos', value: contagens.resolvido, icon: CheckCircle, color: 'oklch(0.55 0.18 150)', desc: 'concluídos com sucesso' },
          { label: 'Rejeitados', value: contagens.rejeitado, icon: XCircle,     color: '#f87171',              desc: 'não procedentes'       },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</CardTitle>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}>
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{stat.desc}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Filtros + Pesquisa ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {filtrosDef.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilters({ status: f.value })}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                filtro === f.value
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40 hover:text-foreground'
              }`}
            >
              {f.label}
              {f.value !== 'todos' && (
                <span className={`ml-1.5 text-[10px] font-bold ${filtro === f.value ? 'opacity-80' : 'opacity-60'}`}>
                  {contagens[f.value as Status]}
                </span>
              )}
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

      {/* ── Erro ── */}
      {listError && !loading && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Lista ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Loader className="w-6 h-6 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">A carregar reportes…</p>
        </div>
      ) : reportes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Package className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">Sem reportes</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {filtro !== 'todos' || q
              ? 'Não encontrámos reportes para os filtros selecionados.'
              : 'Ainda não submeteu nenhum reporte. Clique em "Novo Reporte" para começar.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {reportes.map((r) => {
              const cfg = statusConfig[r.status]
              const Icon = cfg.icon
              const isOpen = expandido === r.id
              return (
                <Card
                  key={r.id}
                  className="border shadow-sm rounded-xl hover:shadow-md transition-all cursor-pointer overflow-hidden"
                  style={{
                    borderColor: `color-mix(in srgb, ${cfg.color} ${r.status === 'cancelado' ? '55%' : '30%'}, var(--border))`,
                    backgroundColor: `color-mix(in srgb, ${cfg.color} ${r.status === 'cancelado' ? '8%' : '3%'}, var(--card))`,
                  }}
                  onClick={() => setExpandido(isOpen ? null : r.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-start gap-4 p-4">
                      {r.imagem ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                          <img src={r.imagem} alt={`Fotografia do reporte ${r.titulo}`} className={`w-full h-full object-cover ${r.status === 'cancelado' ? 'grayscale opacity-60' : ''}`} />
                        </div>
                      ) : (
                        <div className={`w-12 h-12 rounded-lg shrink-0 flex items-center justify-center ${cfg.bg}`}>
                          <AlertCircle className="w-5 h-5" style={{ color: cfg.color }} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold leading-snug truncate pr-2 ${r.status === 'cancelado' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{r.titulo}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{r.tipo}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ color: cfg.color, backgroundColor: `color-mix(in srgb, ${cfg.color} 14%, transparent)` }}
                            >
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </div>
                            <ChevronRight className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 mt-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.local}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(r.data)}</span>
          </div>
          {(r.ecopontoId || r.contentorId) && (
            <div className="text-[10px] text-[var(--primary)] font-medium">
              {r.ecopontoId && <span>Ecospot ID: {r.ecopontoId} </span>}
              {r.contentorId && <span> | Contentor ID: {r.contentorId}</span>}
            </div>
          )}
        </div>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-border/60 bg-muted/20 pt-3">
                        <p className="text-sm text-foreground/80 leading-relaxed">{r.descricao}</p>
                        {r.status === 'pendente' && (
                          <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancellingId === r.id}
                              onClick={() => {
                                setCancelError(null)
                                setCancelTargetId(r.id)
                              }}
                            >
                              {cancellingId === r.id ? <Loader className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              Cancelar reporte
                            </Button>
                            <span className="text-[10px] text-muted-foreground sm:text-right">
                              Pode cancelar enquanto estiver pendente
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total} resultado{total !== 1 ? 's' : ''}</span>
            <span>Página {page} de {pageCount}</span>
          </div>
          <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}

      {/* ── Modal Novo Reporte ── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={fecharModal} aria-hidden="true" />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="reportes-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 id="reportes-modal-title" className="text-base font-bold text-foreground">Novo Reporte</h2>
              <button type="button" aria-label="Fechar modal" onClick={fecharModal} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmitReporte, onInvalidReporte)} className="flex flex-col gap-3">
              <div data-field="titulo">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
                <input type="text" {...register('titulo')} placeholder="Descreva brevemente o problema..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" />
                {errors.titulo && <p className="text-xs text-destructive mt-1">{errors.titulo.message}</p>}
              </div>

              <div data-field="tipo">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de ocorrência</label>
                <select {...register('tipo')}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30">
                  <option value="">Selecione...</option>
                  {tiposReporte.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.tipo && <p className="text-xs text-destructive mt-1">{errors.tipo.message}</p>}
              </div>

              {tipoWatch && (
                <>
                  <div data-field="local">
                    {isContentorRequiredType(tipoWatch) ? (
                      <>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Selecione o contentor do ecoponto
                        </label>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Clique diretamente no contentor (ex: papel, plástico, vidro) do ecoponto no mapa para reportar o problema.
                        </p>
                      </>
                    ) : (
                      <>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Selecione o local no mapa
                        </label>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Clique no mapa para colocar um pin no local onde pretende reportar o problema.
                        </p>
                      </>
                    )}
                    <LocationPicker
                      value={coords}
                      onChange={setCoords}
                      onAddress={(addr) => setValue('local', addr, { shouldValidate: true })}
                      onEcopontoSelect={setSelectedEcoponto}
                      onContentorSelect={setSelectedContentor}
                      onlyContentorSelection={isContentorRequiredType(tipoWatch)}
                    />
                    {/* Hidden local field, still required by schema */}
                    <input type="hidden" {...register('local')} />
                    {errors.local && <p className="text-xs text-destructive mt-1">{errors.local.message}</p>}
                    {isContentorRequiredType(tipoWatch) && !selectedContentor && !errors.local && (
                      <p className="text-xs text-destructive mt-1">Selecione um contentor de ecoponto no mapa.</p>
                    )}
                  </div>

                  {dupes?.duplicado && (
                    <div role="status" className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <p className="font-semibold">Possível duplicado</p>
                      <p className="mt-0.5">
                        Já {dupes.candidatos.length === 1 ? 'existe 1 reporte parecido' : `existem ${dupes.candidatos.length} reportes parecidos`} perto desta localização (últimos 7 dias). Considere subscrever em vez de criar um novo.
                      </p>
                    </div>
                  )}

                  <div data-field="descricao">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                    <textarea {...register('descricao')} rows={3} placeholder="Descreva o problema com mais detalhe..."
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 resize-none" />
                    {errors.descricao && <p className="text-xs text-destructive mt-1">{errors.descricao.message}</p>}
                  </div>

                  <div data-field="imagem">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Fotografia <span className="text-muted-foreground/60 font-normal">(opcional)</span>
                    </label>
                    {previewUrl ? (
                      <div className="relative rounded-xl overflow-hidden border border-border">
                        <img src={previewUrl} alt="Pré-visualização da fotografia do reporte" className="w-full h-40 object-cover" />
                        <button
                          type="button"
                          aria-label="Remover fotografia"
                          title="Remover fotografia"
                          onClick={() => { reset({ ...getValues(), imagem: undefined as never }); setPreviewUrl(null) }}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                          {imagemFile?.name}
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-[var(--primary)]/50 hover:bg-muted/30 transition-all">
                        <Upload className="w-7 h-7 text-muted-foreground/40" />
                        <p className="text-xs font-medium text-muted-foreground mt-2">Clique para selecionar imagem</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPG, PNG ou WebP · Máx. 5 MB</p>
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" {...register('imagem')} />
                      </label>
                    )}
                    {errors.imagem && <p className="text-xs text-destructive mt-1">{errors.imagem.message as string}</p>}
                  </div>
                </>
              )}

              {submitError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {submitError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="outline" size="sm" onClick={fecharModal} disabled={submitting}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={submitting} className="bg-[var(--primary)] hover:opacity-90 transition-opacity">
                  <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                  {submitting ? 'A submeter…' : 'Submeter Reporte'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={cancelTargetId !== null}
        title="Cancelar reporte?"
        description="Esta ação irá cancelar o reporte. Não poderá voltar a colocá-lo como pendente."
        confirmLabel="Cancelar reporte"
        loading={cancellingId === cancelTargetId}
        error={cancelError}
        onClose={() => {
          setCancelTargetId(null)
          setCancelError(null)
        }}
        onConfirm={() => void confirmCancelReporte()}
      />
    </div>
  )
}
