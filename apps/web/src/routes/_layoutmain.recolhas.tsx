import { createFileRoute, useSearch } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Truck, PlusCircle, Clock, Calendar, CheckCircle,
  ChevronRight, Info, MapPin, Package, AlertTriangle,
  Loader2, X, XCircle, Camera, ImageIcon, ArrowLeft, Send,
  Layers, ChevronDown, Filter, Upload
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery } from '@/lib/use-list-query'
import { z } from 'zod'
import { fetchJson, HttpError } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken, getUser } from '@/lib/auth'
import type { ListRecolhasResponse, RecolhaRecord, CreateRecolhaRequest, CreateRecolhaResponse, UpdateRecolhaStatusRequest, UpdateRecolhaResponse, CancelRecolhaResponse, RecolhaStatus } from '@ecobairro/contracts'
import { LocationPicker, type Coords } from '@/components/reportes/location-picker'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { focusFirstInvalidField } from '@/lib/focus-first-invalid-field'

interface RecolhasSearch {
  novo?: '1'
  // Gerido pelo nuqs; declarado aqui só para o TanStack Router não o remover.
  page?: number
}

export const Route = createFileRoute('/_layoutmain/recolhas')({
  validateSearch: (raw: Record<string, unknown>): RecolhasSearch => {
    const out: RecolhasSearch = {}
    if (raw.novo === '1') out.novo = '1'
    if (raw.page !== undefined && Number.isFinite(Number(raw.page))) {
      out.page = Number(raw.page)
    }
    return out
  },
  component: RecolhasPage,
})

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pendente:  { label: 'Pendente',  icon: Clock,        color: '#fbbf24',              bg: 'bg-amber-400/10'  },
  agendado:  { label: 'Agendado',  icon: Calendar,     color: '#60a5fa',              bg: 'bg-blue-500/10'   },
  concluido: { label: 'Concluído', icon: CheckCircle,  color: 'oklch(0.55 0.18 150)', bg: 'bg-green-500/10'  },
  cancelado: { label: 'Cancelado', icon: XCircle,      color: '#f87171',              bg: 'bg-red-500/10'    },
}

const tiposRecolha = ['Monos Volumosos', 'Entulho'] as const
const POR_PAGINA = 5

const agendarSchema = z.object({
  tipo: z.string().min(2),
  subtipo: z.string().min(2, 'Descreva o que pretende recolher (mín. 2 caracteres)'),
  morada: z.string().min(5, 'Indique a morada completa (mín. 5 caracteres)'),
  obs: z.string().optional(),
})

function formatarData(date: string) {
  if (!date) return 'A definir'
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function RecolhasPage() {
  const user = getUser()
  const isManagementView = user?.role === 'operador' || user?.role === 'gestor' || user?.role === 'admin'
  const search = useSearch({ from: '/_layoutmain/recolhas' })
  // page vive na URL (nuqs). Esta lista não tem filtros/pesquisa.
  const { params, setPage, pageSize } = useListQuery({}, POR_PAGINA)
  const { page } = params
  const [expandido, setExpandido] = useState<string | null>(null)
  const [recolhas, setRecolhas] = useState<RecolhaRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [passoAgendamento, setPassoAgendamento] = useState(1)
  const [enviado, setEnviado] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imagemFile, setImagemFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ morada?: string; subtipo?: string; data?: string }>({})
  const [forceCreateModal, setForceCreateModal] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')
  const [infoAberta, setInfoAberta] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [updateForm, setUpdateForm] = useState<{ status: RecolhaStatus; data_prevista: string }>({ status: 'agendado', data_prevista: '' })
  const [locationCoords, setLocationCoords] = useState<Coords | null>(null)
  const [form, setForm] = useState({
    tipo: 'Monos Volumosos',
    subtipo: '',
    morada: '',
    data: '',
    obs: '',
  })
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modalAberto, modalRef, () => setModalAberto(false))

  const headers = useMemo(() => ({ Authorization: `Bearer ${getAccessToken() ?? ''}` }), [])

  const load = useCallback(async (pg = page) => {
    setLoading(true)
    try {
      const res = await fetchJson<ListRecolhasResponse>(
        `/v1/recolhas?page=${pg}&pageSize=${pageSize}`,
        { baseUrl: clientEnv.apiBaseUrl, headers }
      )
      setRecolhas(res.recolhas)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [headers, page, pageSize])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  useEffect(() => {
    if (!imagemFile) {
      const id = window.setTimeout(() => setPreviewUrl(null), 0)
      return () => window.clearTimeout(id)
    }
    const url = URL.createObjectURL(imagemFile)
    const id = window.setTimeout(() => setPreviewUrl(url), 0)
    return () => {
      window.clearTimeout(id)
      URL.revokeObjectURL(url)
    }
  }, [imagemFile])

  const resetAgendamento = useCallback(() => {
    setForm({ tipo: 'Monos Volumosos', subtipo: '', morada: '', data: '', obs: '' })
    setPassoAgendamento(1)
    setEnviado(false)
    setImagemFile(null)
    setPreviewUrl(null)
    setSubmitting(false)
    setSubmitError(null)
    setFieldErrors({})
    setLocationCoords(null)
  }, [])

  const abrirModal = useCallback(() => {
    resetAgendamento()
    setModalAberto(true)
  }, [resetAgendamento])

  const fecharModal = useCallback(() => {
    setModalAberto(false)
    setForceCreateModal(false)
    resetAgendamento()
  }, [resetAgendamento])

  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (autoOpenedRef.current) return
    if (search.novo !== '1') return
    const id = window.setTimeout(() => {
      setForceCreateModal(true)
      abrirModal()
    }, 0)
    return () => window.clearTimeout(id)
  }, [abrirModal, search.novo])

  function avancarPasso() {
    if (passoAgendamento === 1) {
      const errs: { morada?: string; subtipo?: string; data?: string } = {}
      if (!form.morada.trim()) errs.morada = 'Indique a localização da recolha.'
      if (!form.subtipo.trim()) errs.subtipo = 'Indique um título para a recolha.'
      if (!form.data) {
        errs.data = 'Escolha uma data para a recolha.'
      } else if (form.data < new Date().toISOString().split('T')[0]) {
        errs.data = 'A data selecionada não pode ser no passado.'
      }
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs)
        const firstInvalidField = (['morada', 'subtipo', 'data'] as const).find(field => errs[field])
        if (firstInvalidField) focusFirstInvalidField(modalRef.current, [firstInvalidField])
        return
      }
    }
    setFieldErrors({})
    setPassoAgendamento((passo) => Math.min(passo + 1, 3))
  }

  async function onAgendar(e: React.FormEvent) {
    e.preventDefault()
    // Submeter só no último passo. Caso contrário (ex.: Enter num campo),
    // avançamos o passo com validação, em vez de criar a recolha à força.
    if (passoAgendamento < 3) {
      avancarPasso()
      return
    }
    setSubmitError(null)

    const parsed = agendarSchema.safeParse(form)
    if (!parsed.success) {
      const errs: { morada?: string; subtipo?: string; data?: string } = {}
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'morada') errs.morada = issue.message
        if (issue.path[0] === 'subtipo') errs.subtipo = issue.message
      }
      setFieldErrors(errs)
      setPassoAgendamento(1)
      const firstInvalidField = (['morada', 'subtipo', 'data'] as const).find(field => errs[field])
      if (firstInvalidField) focusFirstInvalidField(modalRef.current, [firstInvalidField])
      return
    }

    setSubmitting(true)
    try {
      const dataSugerida = formatarData(form.data)
      const baseObs = parsed.data.obs?.trim()
      const obsFinal = `Data sugerida: ${dataSugerida}` + (baseObs ? `\n\n${baseObs}` : '')

      const body: CreateRecolhaRequest = {
        tipo: parsed.data.tipo,
        subtipo: parsed.data.subtipo.trim(),
        morada: parsed.data.morada.trim(),
        obs: obsFinal,
      }
      await fetchJson<CreateRecolhaResponse>('/v1/recolhas', {
        baseUrl: clientEnv.apiBaseUrl,
        headers,
        method: 'POST',
        body: JSON.stringify(body),
      })
      await load(1)
      setPage(1)
      setEnviado(true)
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        setSubmitError('Sessão expirada. Faça login novamente.')
      } else {
        setSubmitError(
          getApiErrorMessage(error, 'Não foi possível agendar a recolha. Tente novamente.'),
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onUpdateStatus(id: string) {
    setUpdatingId(id)
    setUpdateError(null)
    const body: UpdateRecolhaStatusRequest = { status: updateForm.status }
    if (updateForm.data_prevista) {
      const [y, m, d] = updateForm.data_prevista.split('-')
      body.data_prevista = `${d}/${m}/${y}`
    }
    try {
      await fetchJson<UpdateRecolhaResponse>(`/v1/recolhas/${id}`, {
        baseUrl: clientEnv.apiBaseUrl,
        headers,
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await load()
      setExpandido(null)
    } catch (err) {
      setUpdateError(getApiErrorMessage(err, 'Não foi possível atualizar o estado.'))
    } finally {
      setUpdatingId(null)
    }
  }

  async function confirmCancel() {
    if (!cancelTargetId) return
    const id = cancelTargetId
    setCancellingId(id)
    setCancelError(null)
    try {
      await fetchJson<CancelRecolhaResponse>(`/v1/recolhas/${id}`, {
        baseUrl: clientEnv.apiBaseUrl,
        headers,
        method: 'DELETE',
      })
      await load()
      setExpandido(null)
      setCancelTargetId(null)
    } catch (error) {
      setCancelError(getApiErrorMessage(error, 'Não foi possível cancelar o pedido.'))
    } finally {
      setCancellingId(null)
    }
  }

  const pageCount = Math.ceil(total / pageSize)
  const progressoAgendamento = enviado ? 100 : (passoAgendamento / 3) * 100

  const contagens = {
    pendente:  recolhas.filter(p => p.status === 'pendente').length,
    agendado:  recolhas.filter(p => p.status === 'agendado').length,
    concluido: recolhas.filter(p => p.status === 'concluido').length,
    cancelado: recolhas.filter(p => p.status === 'cancelado').length,
  }

  const recolhasFiltradas = statusFiltro === 'todos'
    ? recolhas
    : recolhas.filter(p => p.status === statusFiltro)



  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImagemFile(file)
    }
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-10 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-[var(--primary)]" />
            <h1 className="text-xl font-bold text-foreground">
              {isManagementView ? 'Gestão de Recolhas de Monos' : 'Monos e Entulhos'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isManagementView
              ? 'Acompanhe pedidos submetidos, estados de agendamento e intervenções concluídas.'
              : 'Agende e acompanhe a recolha de objetos volumosos e entulho.'}
          </p>
        </div>
        {!isManagementView && (
          <Button
            className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity self-start sm:self-auto rounded-xl"
            onClick={abrirModal}
          >
            <PlusCircle className="w-4 h-4" />
            Agendar Recolha
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Pedidos Pendentes',  value: contagens.pendente,  icon: Clock,        color: '#fb923c',              desc: 'A aguardar triagem' },
          { label: 'Recolhas Agendadas', value: contagens.agendado,  icon: Calendar,     color: '#60a5fa',              desc: 'Próximas intervenções'  },
          { label: 'Pedidos Concluídos', value: contagens.concluido, icon: CheckCircle,  color: 'oklch(0.55 0.18 150)', desc: 'Recolhas realizadas'     },
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
                {loading ? (
                  <div className="h-8 w-12 rounded-lg bg-muted animate-pulse" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{stat.desc}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <section className="space-y-3">
        <button
          onClick={() => setInfoAberta(v => !v)}
          className="flex items-center gap-2 w-full text-left group"
        >
          <Info className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex-1">
            {isManagementView ? 'Como funciona a gestão?' : 'O que recolhemos?'}
          </h2>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${infoAberta ? 'rotate-180' : ''}`} />
        </button>
        {infoAberta && <Card className="border border-border/70 shadow-sm rounded-xl bg-card overflow-hidden animate-in fade-in duration-150">
          <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isManagementView ? 'Triagem dos pedidos' : 'Monos Volumosos'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isManagementView
                      ? 'Os pedidos pendentes são revistos pelo gestor antes de seguirem para agendamento operacional.'
                      : 'Eletrodomésticos, móveis (sofás, armários), colchões e equipamentos eletrónicos.'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isManagementView ? 'Acompanhamento territorial' : 'Entulho de Obras'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isManagementView
                      ? 'A morada, tipo e observações ajudam a planear equipas, rotas e janelas de recolha.'
                      : 'Pequenos restos de obras domésticas (tijolos, cerâmicas). Limite de 1m³ por pedido.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-red-50 border border-red-300 shadow-sm dark:bg-red-950/30 dark:border-red-800 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-950 dark:text-red-100">
                  {isManagementView ? 'Prioridade operacional' : 'Importante'}
                </p>
                <p className="text-[11px] text-red-900 dark:text-red-200 leading-relaxed mt-0.5">
                  {isManagementView
                    ? 'Pedidos pendentes devem ser tratados antes de acumularem impacto no espaço público.'
                    : 'Não coloque monos na rua sem agendamento prévio. A recolha é gratuita e ajuda a manter o bairro limpo.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {isManagementView ? 'Pedidos de Recolha' : 'Os Meus Pedidos'}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{total} pedido{total !== 1 ? 's' : ''}</span>
        </div>

        {/* Filtros por estado */}
        {!loading && recolhas.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {(['todos', 'pendente', 'agendado', 'concluido', 'cancelado'] as const).map(s => {
              const count = s === 'todos' ? recolhas.length : contagens[s as keyof typeof contagens]
              const cfg = s === 'todos' ? null : statusConfig[s]
              return (
                <button
                  key={s}
                  onClick={() => setStatusFiltro(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                    statusFiltro === s
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40'
                  }`}
                >
                  {cfg ? cfg.label : 'Todos'}
                  <span className={`px-1 rounded-full text-[10px] font-semibold ${
                    statusFiltro === s ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-border/70 bg-card p-4 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-4 w-2/5 bg-muted rounded-full" />
                      <div className="h-5 w-16 bg-muted rounded-full" />
                    </div>
                    <div className="h-3 w-3/5 bg-muted rounded-full" />
                    <div className="h-3 w-1/2 bg-muted rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recolhasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Truck className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sem pedidos de recolha</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isManagementView
                      ? 'Ainda não existem pedidos para gerir.'
                      : statusFiltro !== 'todos'
                        ? `Sem pedidos com estado "${statusConfig[statusFiltro]?.label ?? statusFiltro}".`
                        : 'Ainda não criou nenhum pedido de recolha.'}
                  </p>
                </div>
                {!isManagementView && statusFiltro === 'todos' && (
                  <Button
                    size="sm"
                    className="gap-2 bg-[var(--primary)] hover:opacity-90 rounded-xl mt-1"
                    onClick={abrirModal}
                  >
                    <PlusCircle className="w-4 h-4" />
                    Agendar Recolha
                  </Button>
                )}
              </div>
            ) : recolhasFiltradas.map((p) => {
              const cfg = statusConfig[p.status] ?? statusConfig['pendente']!
              const SIcon = cfg.icon
              const isOpen = expandido === p.id

              return (
                <Card
                  key={p.id}
                  className="border shadow-sm rounded-xl hover:shadow-md transition-all cursor-pointer overflow-hidden"
                  style={{
                    borderColor: `color-mix(in srgb, ${cfg.color} ${p.status === 'cancelado' ? '55%' : '30%'}, var(--border))`,
                    backgroundColor: `color-mix(in srgb, ${cfg.color} ${p.status === 'cancelado' ? '8%' : '3%'}, var(--card))`,
                  }}
                  onClick={() => {
                    if (!isOpen) {
                      const nextStatus = p.status === 'pendente' ? 'agendado' : 'concluido'
                      setUpdateForm({ status: nextStatus as RecolhaStatus, data_prevista: '' })
                      setUpdateError(null)
                    }
                    setExpandido(isOpen ? null : p.id)
                  }}
                >
                  <CardContent className="p-0">
                    <div className="p-4 flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <SIcon className="w-5 h-5" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold leading-snug truncate pr-2 ${p.status === 'cancelado' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{p.tipo}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.subtipo}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ color: cfg.color, backgroundColor: `color-mix(in srgb, ${cfg.color} 14%, transparent)` }}
                            >
                              <SIcon className="w-3 h-3" />
                              {cfg.label}
                            </div>
                            <ChevronRight className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 truncate max-w-[180px]" title={p.morada}><MapPin className="w-3 h-3 shrink-0" /> {p.morada}</span>
                          <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" /> {p.data_pedido}</span>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-3 border-t border-border/60 bg-muted/20">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <p className="text-muted-foreground font-medium">Data Prevista</p>
                            <p className="font-semibold" style={{ color: p.status === 'cancelado' ? cfg.color : undefined }}>
                              {p.data_prevista
                                ? p.data_prevista
                                : p.status === 'cancelado'
                                  ? 'Cancelado'
                                  : p.status === 'pendente'
                                    ? 'Aguarda agendamento pela equipa'
                                    : 'A definir'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground font-medium">Observações</p>
                            <p className="text-foreground italic text-[11px] leading-relaxed">{p.obs ?? 'Sem observações'}</p>
                          </div>
                        </div>
                        {isManagementView && (p.status === 'pendente' || p.status === 'agendado') && (
                          <div className="mt-4 space-y-2" onClick={e => e.stopPropagation()}>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Atualizar estado</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                value={expandido === p.id ? updateForm.status : (p.status === 'pendente' ? 'agendado' : 'concluido')}
                                onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value as RecolhaStatus }))}
                              >
                                {p.status === 'pendente' && <option value="agendado">Agendado</option>}
                                {(p.status === 'pendente' || p.status === 'agendado') && <option value="concluido">Concluído</option>}
                              </select>
                              <input
                                type="date"
                                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                value={updateForm.data_prevista}
                                onChange={e => setUpdateForm(f => ({ ...f, data_prevista: e.target.value }))}
                                title="Data prevista (opcional)"
                              />
                              <Button
                                size="sm"
                                disabled={updatingId === p.id}
                                className="bg-[var(--primary)] hover:opacity-90 text-xs rounded-lg"
                                onClick={() => onUpdateStatus(p.id)}
                              >
                                {updatingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
                              </Button>
                            </div>
                            {updateError && expandido === p.id && (
                              <p className="text-xs text-red-600">{updateError}</p>
                            )}
                          </div>
                        )}
                        {!isManagementView && p.status === 'pendente' && (
                          <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancellingId === p.id}
                              onClick={() => {
                                setCancelError(null)
                                setCancelTargetId(p.id)
                              }}
                            >
                              {cancellingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              Cancelar pedido
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
        )}
        <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
      </section>

      {modalAberto && (!isManagementView || forceCreateModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={fecharModal} aria-hidden="true" />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="recolhas-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <button type="button" aria-label="Fechar modal" onClick={fecharModal} className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h2 id="recolhas-modal-title" className="text-base font-bold text-foreground">{enviado ? 'Enviado' : 'Agendamento'}</h2>
              <div className="w-8" />
            </div>

            {!enviado && (
              <div className="px-5 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Passo {passoAgendamento} de 3</span>
                  <span className="text-muted-foreground">
                    {passoAgendamento === 1 ? 'Detalhes da recolha' : passoAgendamento === 2 ? 'Fotografia' : 'Resumo do agendamento'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                  <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${progressoAgendamento}%` }} />
                </div>
              </div>
            )}

            <form id="recolha-form" onSubmit={onAgendar} className="flex-1 overflow-y-auto px-5 py-4">
              {enviado ? (
                <div className="min-h-[460px] flex flex-col items-center justify-center text-center gap-5">
                  <div>
                    <h3 className="text-xl font-bold text-foreground leading-tight">Agendamento confirmado com sucesso!</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-xs">
                      Em breve entraremos em contacto com mais detalhes. Por favor, fique atento às notificações.
                    </p>
                  </div>
                  <div className="w-36 h-36 rounded-full border-[10px] border-[var(--primary)]/85 flex items-center justify-center text-[var(--primary)]">
                    <CheckCircle className="w-24 h-24" strokeWidth={1.8} />
                  </div>
                </div>
              ) : (
                <div className="min-h-[460px]">
                  {passoAgendamento === 1 && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1.5 block">Tipo de recolha</label>
                        <div className="grid grid-cols-2 gap-2">
                          {tiposRecolha.map((tipo) => {
                            const TipoIcon = tipo === 'Monos Volumosos' ? Package : Layers
                            return (
                              <label key={tipo} className="cursor-pointer">
                                <input
                                  type="radio"
                                  value={tipo}
                                  checked={form.tipo === tipo}
                                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                                  className="peer sr-only"
                                />
                                <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition-all peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary)]/10 peer-checked:text-[var(--primary)]">
                                  <TipoIcon className="w-4 h-4" />
                                  {tipo === 'Monos Volumosos' ? 'Monos Volumosos' : 'Entulho de Obras'}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      <div data-field="morada">
                        <label className="text-sm font-semibold text-foreground mb-1.5 block">Localização <span className="text-destructive">*</span></label>
                        <div className={`rounded-xl overflow-hidden border ${fieldErrors.morada ? 'border-destructive' : 'border-border'}`} style={{ height: 260 }}>
                          <LocationPicker
                            value={locationCoords}
                            onChange={setLocationCoords}
                            onAddress={(addr) => {
                              setForm(f => ({ ...f, morada: addr }))
                              setFieldErrors(prev => ({ ...prev, morada: undefined }))
                            }}
                          />
                        </div>
                        {form.morada && (
                          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0 text-[var(--primary)]" />
                            {form.morada}
                          </p>
                        )}
                        {fieldErrors.morada && <p className="text-xs text-destructive mt-1">{fieldErrors.morada}</p>}
                      </div>

                      <div data-field="subtipo">
                        <label className="text-sm font-semibold text-foreground mb-1.5 block">Título <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          value={form.subtipo}
                          onChange={e => { setForm(f => ({ ...f, subtipo: e.target.value })); setFieldErrors(prev => ({ ...prev, subtipo: undefined })) }}
                          aria-invalid={!!fieldErrors.subtipo}
                          placeholder="Ex: Sofá de 3 lugares"
                          className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${fieldErrors.subtipo ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-[var(--primary)]/30'}`}
                        />
                        {fieldErrors.subtipo && <p className="text-xs text-destructive mt-1">{fieldErrors.subtipo}</p>}
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1.5 block">Descrição <span className="text-muted-foreground font-normal">(Opcional)</span></label>
                        <textarea
                          value={form.obs}
                          onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
                          rows={4}
                          placeholder="Adicione mais detalhes sobre a recolha aqui..."
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 resize-none"
                        />
                      </div>

                      <div data-field="data">
                        <label className="text-sm font-semibold text-foreground mb-1.5 block">Data <span className="text-destructive">*</span></label>
                        <div className={`relative flex min-h-11 items-center rounded-xl border bg-background focus-within:ring-2 ${fieldErrors.data ? 'border-destructive focus-within:ring-destructive/30' : 'border-border focus-within:ring-[var(--primary)]/30'}`}>
                          <Calendar className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-muted-foreground" />
                          <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={form.data}
                            onChange={e => { setForm(f => ({ ...f, data: e.target.value })); setFieldErrors(prev => ({ ...prev, data: undefined })) }}
                            aria-invalid={!!fieldErrors.data}
                            aria-describedby={fieldErrors.data ? 'recolha-data-error' : undefined}
                            className="h-10 w-full rounded-xl border-0 bg-transparent pl-9 pr-3 text-sm text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
                          />
                        </div>
                        {fieldErrors.data && <p id="recolha-data-error" className="text-xs text-destructive mt-1">{fieldErrors.data}</p>}
                      </div>
                    </div>
                  )}

                  {passoAgendamento === 2 && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1.5 block">Fotografia <span className="text-muted-foreground font-normal">(Opcional)</span></label>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">Uma imagem vale mais que mil palavras. Ajude-nos a identificar melhor os objetos a recolher.</p>
                        {previewUrl ? (
                          <div className="relative rounded-xl overflow-hidden border border-border">
                            <img src={previewUrl} alt="Pré-visualização da fotografia do agendamento" className="w-full h-48 object-cover" />
                            <button
                              type="button"
                              aria-label="Remover fotografia"
                              title="Remover fotografia"
                              onClick={() => { setImagemFile(null); setPreviewUrl(null) }}
                              className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                              {imagemFile?.name}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Zona drag-and-drop */}
                            <div
                              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                              onDragLeave={() => setDragOver(false)}
                              onDrop={handleDrop}
                              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-all ${
                                dragOver
                                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                                  : 'border-border bg-muted/20 hover:border-[var(--primary)]/40'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <Upload className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium text-foreground">Arraste uma imagem para aqui</p>
                                <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG ou WebP · máx. 10 MB</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="h-10 rounded-xl bg-muted hover:bg-muted/80 border border-border cursor-pointer flex items-center justify-center gap-2 text-xs font-medium text-foreground transition-colors">
                                <Camera className="w-4 h-4" />
                                Câmara
                                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => setImagemFile(e.target.files?.[0] ?? null)} />
                              </label>
                              <label className="h-10 rounded-xl bg-muted hover:bg-muted/80 border border-border cursor-pointer flex items-center justify-center gap-2 text-xs font-medium text-foreground transition-colors">
                                <ImageIcon className="w-4 h-4" />
                                Galeria
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setImagemFile(e.target.files?.[0] ?? null)} />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {passoAgendamento === 3 && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-2">Localização</h3>
                        {locationCoords ? (
                          <div className="rounded-xl border border-border overflow-hidden relative" style={{ height: 140 }}>
                            <img
                              src={`/tiles/styles/basic-preview/static/${locationCoords.lng},${locationCoords.lat},15/600x280@2x.png`}
                              alt="Mapa da localização"
                              className="w-full h-full object-cover"
                              onError={e => { e.currentTarget.style.display = 'none' }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <MapPin className="w-7 h-7 fill-red-500 text-white drop-shadow-md" strokeWidth={1.5} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
                              <p className="text-[11px] text-white font-medium truncate">{form.morada}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-border bg-background p-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[var(--primary)] shrink-0" />
                            <p className="text-xs text-foreground">{form.morada}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3">Resumo do agendamento</h3>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="font-semibold text-foreground">Tipo</p>
                            <p className="text-muted-foreground mt-1">{form.tipo}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Título</p>
                            <p className="text-muted-foreground mt-1">{form.subtipo}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Data</p>
                            <p className="text-muted-foreground mt-1">{formatarData(form.data)}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Descrição <span className="text-muted-foreground font-normal">(Opcional)</span></p>
                            <p className="text-muted-foreground mt-1 leading-relaxed">{form.obs || 'Sem observações adicionais.'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Fotografia <span className="text-muted-foreground font-normal">(Opcional)</span></p>
                            {previewUrl ? (
                              <img src={previewUrl} alt="Pré-visualização da fotografia do agendamento (resumo)" className="mt-2 w-full h-28 object-cover rounded-xl border border-border" />
                            ) : (
                              <p className="text-muted-foreground mt-1">Sem fotografia anexada.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {submitError && (
                <p className="text-xs text-destructive px-1 pt-1">{submitError}</p>
              )}
            </form>

            {/* Footer fixo fora do scroll */}
            <div className="shrink-0 px-5 pt-3 pb-4 border-t border-border bg-card">
              {enviado ? (
                <Button type="button" onClick={fecharModal} className="w-full rounded-full bg-[var(--primary)] hover:opacity-90 transition-opacity">
                  Concluir
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {passoAgendamento > 1 ? (
                    <Button type="button" variant="outline" onClick={() => setPassoAgendamento((passo) => Math.max(passo - 1, 1))} className="rounded-full">
                      <ArrowLeft className="w-4 h-4" />
                      Voltar
                    </Button>
                  ) : (
                    <div />
                  )}
                  {passoAgendamento < 3 ? (
                    <Button type="button" onClick={avancarPasso} className="rounded-full bg-[var(--primary)] hover:opacity-90 transition-opacity">
                      Continuar
                    </Button>
                  ) : (
                    <Button type="submit" form="recolha-form" className="rounded-full bg-[var(--primary)] hover:opacity-90 transition-opacity" disabled={submitting}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Submeter
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={cancelTargetId !== null}
        title="Cancelar pedido de recolha?"
        description="Esta ação irá cancelar o pedido de recolha e não pode ser anulada."
        confirmLabel="Cancelar pedido"
        loading={cancellingId === cancelTargetId}
        error={cancelError}
        onClose={() => {
          setCancelTargetId(null)
          setCancelError(null)
        }}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  )
}
