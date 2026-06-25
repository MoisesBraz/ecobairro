import { createFileRoute, useSearch } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Package, PlusCircle, Search, MapPin, Users,
  ArrowRight, Upload, X, ImageIcon, Loader,
  CircleEllipsis, Sofa, Lamp, Book, Shirt,
  Tag, Calendar
} from 'lucide-react'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { LocationPicker, type Coords } from '@/components/reportes/location-picker'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'
import { fileToDataUrl } from '@/lib/image-upload'
import type {
  CreatePartilhaRequest,
  ListPartilhasResponse,
  PartilhaCategoria,
  PartilhaRecord,
} from '@ecobairro/contracts'

interface PartilhasSearch {
  novo?: '1'
  // Geridos pelo nuqs; declarados aqui só para o TanStack Router não os remover.
  page?: number
  q?: string
  categoria?: string
}

export const Route = createFileRoute('/_layoutmain/partilhas')({
  validateSearch: (raw: Record<string, unknown>): PartilhasSearch => {
    const out: PartilhasSearch = {}
    if (raw.novo === '1') out.novo = '1'
    if (raw.page !== undefined && Number.isFinite(Number(raw.page))) {
      out.page = Number(raw.page)
    }
    if (typeof raw.q === 'string' && raw.q.length > 0) out.q = raw.q
    if (typeof raw.categoria === 'string' && raw.categoria.length > 0) {
      out.categoria = raw.categoria
    }
    return out
  },
  component: PartilhasPage,
})

/* ─── Categorias (config UI) ─── */
const categorias: { id: PartilhaCategoria | 'todos'; label: string; icon: React.ElementType }[] = [
  { id: 'todos',  label: 'Tudo',   icon: CircleEllipsis },
  { id: 'moveis', label: 'Móveis', icon: Sofa            },
  { id: 'eletro', label: 'Eletro', icon: Lamp            },
  { id: 'livros', label: 'Livros', icon: Book            },
  { id: 'roupa',  label: 'Roupa',  icon: Shirt           },
]

const categoriaIds = ['moveis', 'eletro', 'livros', 'roupa'] as const

const novaPartilhaSchema = z.object({
  titulo:    z.string().min(3, 'Título obrigatório (mín. 3 caracteres)'),
  categoria: z.enum(categoriaIds, { message: 'Selecione uma categoria' }),
  zona:      z.string().min(2, 'Rua obrigatória'),
  imagem:    z.custom<FileList>()
    .refine(fl => fl && fl.length > 0, 'Fotografia obrigatória')
    .refine(fl => !fl || fl.length === 0 || fl[0].size <= 5 * 1024 * 1024, 'Tamanho máximo: 5 MB')
    .refine(fl => !fl || fl.length === 0 || ['image/jpeg', 'image/png', 'image/webp'].includes(fl[0].type), 'Formato não suportado (JPG, PNG ou WebP)'),
})

type NovaPartilhaForm = z.infer<typeof novaPartilhaSchema>

const interesseSchema = z.object({
  mensagem: z.string().max(500, 'Máx. 500 caracteres').optional(),
})
type InteresseForm = z.infer<typeof interesseSchema>

const POR_PAGINA = 12

/** Formata a data ISO da partilha para PT-PT (ex.: «24 de junho de 2026»). */
function formatarData(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function PartilhasPage() {
  const search = useSearch({ from: '/_layoutmain/partilhas' })
  // page + categoria + pesquisa vivem na URL (nuqs).
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { q: parseAsString.withDefault(''), categoria: parseAsString.withDefault('todos') },
    POR_PAGINA,
  )
  const { page, q, categoria: filtro } = params
  const [busca, setBusca]       = useState(q)
  const [partilhas, setPartilhas] = useState<PartilhaRecord[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [locationCoords, setLocationCoords] = useState<Coords | null>(null)
  const [imagemCompleta, setImagemCompleta] = useState<{ src: string; alt: string } | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modalAberto, modalRef, () => fecharModal())

  const imagemCompletaRef = useRef<HTMLDivElement>(null)
  const fecharImagemCompleta = useCallback(() => setImagemCompleta(null), [])
  const abrirImagemCompleta = useCallback((src: string, alt: string) => setImagemCompleta({ src, alt }), [])
  useModalA11y(imagemCompleta !== null, imagemCompletaRef, fecharImagemCompleta)

  // ── Detalhe da partilha (aberto ao clicar no cartão / "Tenho interesse") ──
  const [detalheItem, setDetalheItem] = useState<PartilhaRecord | null>(null)
  const detalheRef = useRef<HTMLDivElement>(null)
  const fecharDetalhe = useCallback(() => {
    setDetalheItem(null)
    setImagemCompleta(null)
  }, [])
  useModalA11y(detalheItem !== null && imagemCompleta === null, detalheRef, fecharDetalhe)
  const abrirDetalhe = useCallback((item: PartilhaRecord) => setDetalheItem(item), [])

  // ── "Tenho interesse": notifica o autor por email ──
  const [interesseItem, setInteresseItem] = useState<PartilhaRecord | null>(null)
  const [interesseSubmitting, setInteresseSubmitting] = useState(false)
  const [interesseError, setInteresseError] = useState<string | null>(null)
  const [interesseFeito, setInteresseFeito] = useState(false)
  const interesseRef = useRef<HTMLDivElement>(null)
  const interesseForm = useForm<InteresseForm>({
    resolver: zodResolver(interesseSchema),
    defaultValues: { mensagem: '' },
  })
  const fecharInteresse = useCallback(() => {
    setInteresseItem(null)
    setInteresseError(null)
    setInteresseFeito(false)
    setInteresseSubmitting(false)
    interesseForm.reset()
  }, [interesseForm])
  useModalA11y(interesseItem !== null, interesseRef, fecharInteresse)

  const abrirInteresse = useCallback((item: PartilhaRecord) => {
    interesseForm.reset({ mensagem: '' })
    setInteresseError(null)
    setInteresseFeito(false)
    setDetalheItem(null)
    setInteresseItem(item)
  }, [interesseForm])

  async function enviarInteresse(data: InteresseForm) {
    if (!interesseItem) return
    setInteresseSubmitting(true)
    setInteresseError(null)
    try {
      const mensagem = data.mensagem?.trim()
      await fetchJson(`/v1/partilhas/${interesseItem.id}/interesse`, {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'POST',
        body: JSON.stringify(mensagem ? { mensagem } : {}),
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      })
      setInteresseFeito(true)
    } catch (err) {
      setInteresseError(getApiErrorMessage(err, 'Não foi possível enviar o seu interesse.'))
    } finally {
      setInteresseSubmitting(false)
    }
  }

  const { register, handleSubmit, watch, reset, setValue, getValues, formState: { errors } } = useForm<NovaPartilhaForm>({
    resolver: zodResolver(novaPartilhaSchema),
    defaultValues: { zona: '' },
  })

  const imagemWatch = watch('imagem')
  const imagemFile  = imagemWatch?.[0]

  useEffect(() => {
    if (!imagemFile) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(imagemFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imagemFile])

  // Empurra a pesquisa para a URL com debounce (setFilters volta à página 1).
  useEffect(() => {
    if (busca === q) return
    const t = setTimeout(() => setFilters({ q: busca }), 350)
    return () => clearTimeout(t)
  }, [busca, q, setFilters])

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const reqParams: Record<string, string | number> = { page, pageSize }
      if (filtro !== 'todos') reqParams.categoria = filtro
      if (q.trim())           reqParams.q         = q.trim()

      const resp = await fetchJson<ListPartilhasResponse>('/v1/partilhas', {
        baseUrl: clientEnv.apiBaseUrl,
        params: reqParams,
      })
      setPartilhas(resp.partilhas)
      setTotal(resp.total)
    } catch (err) {
      setPartilhas([])
      setTotal(0)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar as partilhas.'))
    } finally {
      setLoading(false)
    }
  }, [page, filtro, q, pageSize])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const pageCount = Math.ceil(total / pageSize)

  const abrirModal = useCallback(() => {
    reset()
    setPreviewUrl(null)
    setLocationCoords(null)
    setSubmitError(null)
    setModalAberto(true)
  }, [reset])

  const fecharModal = useCallback(() => {
    setModalAberto(false)
    setPreviewUrl(null)
    setLocationCoords(null)
    setSubmitError(null)
    reset()
  }, [reset])

  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (autoOpenedRef.current) return
    if (search.novo !== '1') return
    autoOpenedRef.current = true
    abrirModal()
  }, [abrirModal, search.novo])

  async function onSubmitPartilha(data: NovaPartilhaForm) {
    setSubmitting(true)
    try {
      const file = data.imagem?.[0]
      const body: CreatePartilhaRequest = {
        titulo:    data.titulo,
        zona:      data.zona,
        categoria: data.categoria,
        ...(file ? { imagem_url: await fileToDataUrl(file) } : {}),
      }
      await fetchJson('/v1/partilhas', {
        baseUrl: clientEnv.apiBaseUrl,
        method:  'POST',
        body:    JSON.stringify(body),
        headers: authHeaders(),
      })
      fecharModal()
      await load()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Não foi possível submeter a partilha.'))
    }
    finally { setSubmitting(false) }
  }

  const catLabel = useMemo(
    () => (id: string) => categorias.find(c => c.id === id)?.label ?? id,
    [],
  )

  return (
    <div className="flex w-full max-w-full flex-col gap-10 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">

      {listError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Tentar novamente</button>
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-[var(--primary)]" />
            <h1 className="text-xl font-bold text-foreground">Partilhas Locais</h1>
          </div>
          <p className="text-sm text-muted-foreground">Encontre ou ofereça objetos à comunidade do seu bairro.</p>
        </div>
        <Button className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity self-start sm:self-auto rounded-xl" onClick={abrirModal}>
          <PlusCircle className="w-4 h-4" />
          Partilhar Algo
        </Button>
      </div>

      {/* ── Filtros e Pesquisa ── */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar objetos ou zonas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all font-medium shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 w-full md:w-auto">
          {categorias.map((cat) => {
            const Icon    = cat.icon
            const isActive = filtro === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setFilters({ categoria: cat.id })}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-md shadow-[var(--primary)]/20'
                    : 'bg-card text-muted-foreground border-border hover:border-[var(--primary)]/40 hover:text-foreground hover:shadow-sm'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[var(--primary)]'}`} />
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Grelha de Objetos ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-[var(--primary)] rounded-full" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Disponíveis Perto de Si</h2>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {loading ? '…' : `${total} resultado${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Loader className="w-6 h-6 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">A carregar partilhas…</p>
          </div>
        ) : partilhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <div>
              <p className="font-bold text-foreground">Sem resultados</p>
              <p className="text-sm text-muted-foreground">Tente ajustar os seus filtros ou pesquisa.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {partilhas.map((item) => (
                <Card
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirDetalhe(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalhe(item) } }}
                  aria-label={`Ver detalhes de ${item.titulo}`}
                  className="group border border-border/70 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
                >
                  <div className="aspect-[4/3] w-full relative overflow-hidden bg-muted">
                    {item.imagem_url ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); abrirImagemCompleta(item.imagem_url!, item.titulo) }}
                        className="relative h-full w-full cursor-zoom-in overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]/50"
                        aria-label={`Ver fotografia completa de ${item.titulo}`}
                      >
                        <img src={item.imagem_url} alt={item.titulo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2 pt-8 text-[10px] font-semibold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          Ver fotografia
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <Badge className="absolute top-3 right-3 bg-black/50 backdrop-blur-md border-none text-white text-[10px] font-bold uppercase tracking-tight">
                      {catLabel(item.categoria)}
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-1 group-hover:text-[var(--primary)] transition-colors">
                        {item.titulo}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium"><MapPin className="w-3 h-3" /> {item.zona}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                          <Users className="w-3 h-3 text-[var(--primary)]" />
                        </div>
                        <p className="text-[10px] font-semibold text-foreground truncate max-w-[80px]">{item.autorNome}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); abrirDetalhe(item) }}
                        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 group/btn"
                      >
                        Tenho Interesse <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>A mostrar {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} de {total}</span>
              <span>Página {page} de {pageCount}</span>
            </div>
            <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
          </>
        )}
      </div>

      {/* ── Modal Detalhe da Partilha ── */}
      {detalheItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={fecharDetalhe} aria-hidden="true" />
          <div ref={detalheRef} role="dialog" aria-modal="true" aria-labelledby="detalhe-modal-title" tabIndex={-1} className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="relative h-52 max-h-[38dvh] w-full shrink-0 bg-muted sm:h-64">
              {detalheItem.imagem_url ? (
                <button
                  type="button"
                  onClick={() => abrirImagemCompleta(detalheItem.imagem_url!, detalheItem.titulo)}
                  className="group/image relative h-full w-full cursor-zoom-in overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]/50"
                  aria-label={`Ver fotografia completa de ${detalheItem.titulo}`}
                >
                  <img src={detalheItem.imagem_url} alt={detalheItem.titulo} className="w-full h-full object-cover" />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-10 text-xs font-semibold text-white opacity-0 transition-opacity group-hover/image:opacity-100 group-focus-visible/image:opacity-100">
                    Clique para ver a fotografia completa
                  </span>
                </button>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
              <Badge className="absolute top-3 left-3 bg-black/50 backdrop-blur-md border-none text-white text-[10px] font-bold uppercase tracking-tight">
                {catLabel(detalheItem.categoria)}
              </Badge>
              <button type="button" aria-label="Fechar" onClick={fecharDetalhe} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
              <h2 id="detalhe-modal-title" className="text-lg font-bold text-foreground leading-snug">{detalheItem.titulo}</h2>

              <dl className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0 text-[var(--primary)]" />
                  <dt className="sr-only">Localização</dt>
                  <dd className="text-foreground font-medium">{detalheItem.zona}</dd>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="w-4 h-4 shrink-0 text-[var(--primary)]" />
                  <dt className="sr-only">Categoria</dt>
                  <dd className="text-foreground font-medium">{catLabel(detalheItem.categoria)}</dd>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4 shrink-0 text-[var(--primary)]" />
                  <dt className="sr-only">Partilhado por</dt>
                  <dd className="text-foreground font-medium">{detalheItem.autorNome}</dd>
                </div>
                {formatarData(detalheItem.data) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0 text-[var(--primary)]" />
                    <dt className="sr-only">Publicado em</dt>
                    <dd className="text-foreground font-medium">Publicado a {formatarData(detalheItem.data)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-card px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
              <Button type="button" variant="outline" size="sm" onClick={fecharDetalhe}>Fechar</Button>
              <Button type="button" size="sm" onClick={() => abrirInteresse(detalheItem)} className="bg-[var(--primary)] hover:opacity-90 transition-opacity gap-1.5">
                Tenho interesse <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Fotografia Completa ── */}
      {imagemCompleta && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={fecharImagemCompleta} aria-hidden="true" />
          <div ref={imagemCompletaRef} role="dialog" aria-modal="true" aria-label="Fotografia completa" tabIndex={-1} className="relative z-10 flex h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl flex-col items-center justify-center sm:h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)]">
            <button
              type="button"
              aria-label="Fechar fotografia completa"
              onClick={fecharImagemCompleta}
              className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-0 sm:top-0"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={imagemCompleta.src}
              alt={imagemCompleta.alt}
              className="h-full w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ── Modal "Tenho Interesse" ── */}
      {interesseItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={fecharInteresse} aria-hidden="true" />
          <div ref={interesseRef} role="dialog" aria-modal="true" aria-labelledby="interesse-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="interesse-modal-title" className="text-base font-bold text-foreground">Tenho interesse</h2>
              <button type="button" aria-label="Fechar" onClick={fecharInteresse} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {interesseFeito ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <p className="text-sm font-semibold text-foreground">Interesse enviado!</p>
                <p className="text-sm text-muted-foreground">
                  Notificámos {interesseItem.autorNome} por email com o seu contacto. A pessoa irá contactá-lo(a) para combinar a entrega.
                </p>
                <Button type="button" size="sm" className="mt-2" onClick={fecharInteresse}>Fechar</Button>
              </div>
            ) : (
              <form onSubmit={interesseForm.handleSubmit(enviarInteresse)} className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Vamos avisar <strong className="text-foreground">{interesseItem.autorNome}</strong> de que tem interesse em
                  «{interesseItem.titulo}». O autor receberá o seu nome e email para o(a) contactar e combinar a entrega.
                </p>
                <div>
                  <label htmlFor="interesse-msg" className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem (opcional)</label>
                  <textarea
                    id="interesse-msg"
                    rows={3}
                    {...interesseForm.register('mensagem')}
                    maxLength={500}
                    placeholder="Ex.: Tenho disponibilidade ao fim de semana para levantar o objeto."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                  />
                </div>
                {interesseError && (
                  <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {interesseError}
                  </div>
                )}
                <div className="flex gap-2 justify-end pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={fecharInteresse} disabled={interesseSubmitting}>Cancelar</Button>
                  <Button type="submit" size="sm" disabled={interesseSubmitting} className="bg-[var(--primary)] hover:opacity-90 transition-opacity gap-1.5">
                    {interesseSubmitting && <Loader className="w-3.5 h-3.5 animate-spin" />}
                    {interesseSubmitting ? 'A enviar…' : 'Enviar interesse'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Nova Partilha ── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={fecharModal} aria-hidden="true" />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="partilhas-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden max-h-[92vh]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 id="partilhas-modal-title" className="text-base font-bold text-foreground">Partilhar Objeto</h2>
              <button type="button" aria-label="Fechar modal" onClick={fecharModal} className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form id="partilha-form" onSubmit={handleSubmit(onSubmitPartilha)} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
              {submitError && (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {submitError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fotografia <span className="text-destructive">*</span></label>
                {previewUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={previewUrl} alt="Pré-visualização da fotografia do objeto" className="w-full h-44 object-cover" />
                    <button
                      type="button"
                      aria-label="Remover fotografia"
                      title="Remover fotografia"
                      onClick={() => { reset({ ...getValues(), imagem: undefined as never }); setPreviewUrl(null) }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-medium truncate max-w-[200px]">
                      {imagemFile?.name}
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-[var(--primary)]/50 hover:bg-muted/30 transition-all">
                    <Upload className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-xs font-medium text-muted-foreground mt-2">Clique para selecionar imagem</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPG, PNG ou WebP · Máx. 5 MB</p>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" {...register('imagem')} />
                  </label>
                )}
                {errors.imagem && <p className="text-xs text-destructive mt-1">{errors.imagem.message as string}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Título do objeto <span className="text-destructive">*</span></label>
                  <input type="text" {...register('titulo')} aria-invalid={!!errors.titulo} placeholder="Ex: Sofá de 2 lugares em bom estado..."
                    className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${errors.titulo ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-[var(--primary)]/30'}`} />
                  {errors.titulo && <p className="text-xs text-destructive mt-1">{errors.titulo.message}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoria <span className="text-destructive">*</span></label>
                  <select {...register('categoria')} aria-invalid={!!errors.categoria}
                    className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-background text-foreground focus:outline-none focus:ring-2 ${errors.categoria ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-[var(--primary)]/30'}`}>
                    <option value="">Selecione...</option>
                    {categorias.filter(c => c.id !== 'todos').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  {errors.categoria && <p className="text-xs text-destructive mt-1">{errors.categoria.message}</p>}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Localização <span className="text-destructive">*</span></label>
                <div className={`rounded-xl overflow-hidden border ${errors.zona ? 'border-destructive' : 'border-border'}`} style={{ height: 260 }}>
                  <LocationPicker
                    value={locationCoords}
                    onChange={setLocationCoords}
                    onAddress={(addr) => {
                      setValue('zona', addr, { shouldValidate: true })
                    }}
                  />
                </div>
                {watch('zona') && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0 text-[var(--primary)]" />
                    {watch('zona')}
                  </p>
                )}
                {errors.zona && <p className="text-xs text-destructive mt-1">{errors.zona.message}</p>}
              </div>

            </form>

            <div className="shrink-0 px-5 pt-3 pb-4 border-t border-border bg-card flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={fecharModal} disabled={submitting}>Cancelar</Button>
              <Button type="submit" form="partilha-form" size="sm" className="rounded-full bg-[var(--primary)] hover:opacity-90 transition-opacity" disabled={submitting}>
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                {submitting ? 'A publicar…' : 'Publicar Partilha'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
