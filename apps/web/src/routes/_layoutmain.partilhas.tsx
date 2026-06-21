import { createFileRoute, useSearch } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Package, PlusCircle, Search, MapPin, Users,
  ArrowRight, Upload, X, ImageIcon, Loader,
  CircleEllipsis, Sofa, Lamp, Book, Shirt
} from 'lucide-react'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { AddressAutocomplete } from '@/components/address-autocomplete'
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

const POR_PAGINA = 12

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
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modalAberto, modalRef, () => fecharModal())

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
    setSubmitError(null)
    setModalAberto(true)
  }, [reset])

  const fecharModal = useCallback(() => {
    setModalAberto(false)
    setPreviewUrl(null)
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
                <Card key={item.id} className="group border border-border/70 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer">
                  <div className="aspect-[4/3] w-full relative overflow-hidden bg-muted">
                    {item.imagem_url ? (
                      <img src={item.imagem_url} alt={item.titulo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                          <Users className="w-3 h-3 text-[var(--primary)]" />
                        </div>
                        <p className="text-[10px] font-semibold text-foreground truncate max-w-[80px]">{item.autorNome}</p>
                      </div>
                      <button className="flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider group/btn">
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

      {/* ── Modal Nova Partilha ── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={fecharModal} aria-hidden="true" />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="partilhas-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 id="partilhas-modal-title" className="text-base font-bold text-foreground">Partilhar Objeto</h2>
              <button type="button" aria-label="Fechar modal" onClick={fecharModal} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {submitError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmitPartilha)} className="flex flex-col gap-3">

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fotografia <span className="text-destructive">*</span></label>
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

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Título do objeto <span className="text-destructive">*</span></label>
                <input type="text" {...register('titulo')} aria-invalid={!!errors.titulo} placeholder="Ex: Sofá de 2 lugares em bom estado..."
                  className={`w-full px-3 py-2 text-sm rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${errors.titulo ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-[var(--primary)]/30'}`} />
                {errors.titulo && <p className="text-xs text-destructive mt-1">{errors.titulo.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria <span className="text-destructive">*</span></label>
                  <select {...register('categoria')} aria-invalid={!!errors.categoria}
                    className={`w-full px-3 py-2 text-sm rounded-xl border bg-background text-foreground focus:outline-none focus:ring-2 ${errors.categoria ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-[var(--primary)]/30'}`}>
                    <option value="">Selecione...</option>
                    {categorias.filter(c => c.id !== 'todos').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  {errors.categoria && <p className="text-xs text-destructive mt-1">{errors.categoria.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Rua <span className="text-destructive">*</span></label>
                  <AddressAutocomplete
                    value={watch('zona') ?? ''}
                    onChange={(v) => setValue('zona', v, { shouldValidate: true })}
                    onSelect={(r) => setValue('zona', r.rua ?? r.label, { shouldValidate: true })}
                    placeholder="Pesquisar a rua em Aveiro…"
                    ariaInvalid={!!errors.zona}
                    inputClassName={`w-full pl-9 pr-9 py-2 text-sm rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${errors.zona ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-[var(--primary)]/30'}`}
                  />
                  {errors.zona && <p className="text-xs text-destructive mt-1">{errors.zona.message}</p>}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="outline" size="sm" onClick={fecharModal} disabled={submitting}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={submitting} className="bg-[var(--primary)] hover:opacity-90 transition-opacity">
                  <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                  {submitting ? 'A publicar…' : 'Publicar Partilha'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
