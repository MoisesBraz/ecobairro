import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, ChevronRight, Search, Newspaper, Loader, Plus, X, Megaphone, Gift, Image as ImageIcon } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { fileToDataUrl } from '@/lib/image-upload'
import type { ListNoticiasResponse, NoticiaRecord, CreateNoticiaRequest, CampanhaRecord } from '@ecobairro/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAccessToken } from '@/lib/auth'

export const Route = createFileRoute('/_layoutmain/noticias')({
  component: NoticiasPage,
})

const filtrosDef = [
  { label: 'Tudo',       value: 'tudo'      },
  { label: 'Notícias',   value: 'noticias'  },
  { label: 'Campanhas',  value: 'campanhas' },
] as const

type Filtro = (typeof filtrosDef)[number]['value']

const POR_PAGINA = 6

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function NoticiasPage() {
  const [filtro, setFiltro]     = useState<Filtro>('tudo')
  // page + pesquisa vivem na URL (nuqs) — partilhável e preservado na recarga.
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { q: parseAsString.withDefault('') },
    POR_PAGINA,
  )
  const { page, q } = params
  const [busca, setBusca]       = useState(q)
  const [noticias, setNoticias] = useState<NoticiaRecord[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [campanhas, setCampanhas] = useState<CampanhaRecord[]>([])

  const { user } = Route.useRouteContext() as { user: { role: string } }
  const canCreate = ['ADMIN', 'GESTOR', 'OPERADOR', 'admin', 'gestor', 'operador'].includes(user.role)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateNoticiaRequest>({
    titulo: '',
    resumo: '',
    conteudo: '',
    imagem_url: '',
    categoria: 'Geral',
    destaque: false,
    tempo_leitura_min: 5,
  })

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
      if (q.trim()) reqParams.q = q.trim()

      const resp = await fetchJson<ListNoticiasResponse>('/v1/noticias', {
        baseUrl: clientEnv.apiBaseUrl,
        params: reqParams,
        // The endpoint could be public for GET, but adding the token is safe
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      setNoticias(resp.noticias)
      setTotal(resp.total)
    } catch (err) {
      setNoticias([])
      setTotal(0)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar as notícias.'))
    } finally {
      setLoading(false)
    }
  }, [page, q, pageSize])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  // Campanhas/benefícios publicados — carregados uma vez (não paginados).
  useEffect(() => {
    fetchJson<{ campanhas: CampanhaRecord[] }>('/v1/campanhas/publicas', {
      baseUrl: clientEnv.apiBaseUrl,
    })
      .then((resp) => setCampanhas(resp.campanhas))
      .catch(() => setCampanhas([]))
  }, [])

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo ficheiro
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setCreateError('Formato não suportado (JPG, PNG ou WebP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setCreateError('Imagem demasiado grande (máx. 5 MB).')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setFormData((prev) => ({ ...prev, imagem_url: dataUrl }))
      setCreateError(null)
    } catch {
      setCreateError('Não foi possível ler a imagem.')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setIsSubmitting(true)
    try {
      await fetchJson('/v1/noticias', {
        method: 'POST',
        baseUrl: clientEnv.apiBaseUrl,
        body: JSON.stringify(formData),
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      setIsModalOpen(false)
      setFormData({
        titulo: '', resumo: '', conteudo: '', imagem_url: '', categoria: 'Geral', destaque: false, tempo_leitura_min: 5,
      })
      void load()
    } catch (err) {
      setCreateError(getApiErrorMessage(err, 'Não foi possível criar a notícia.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const pageCount = Math.ceil(total / pageSize)

  const noticiasDestaque = noticias.filter(n => n.destaque)
  const noticiasSec      = noticias.filter(n => !n.destaque)
  const noticiaDestaque  = noticiasDestaque[0] ?? null

  const mostrarNoticias  = filtro === 'tudo' || filtro === 'noticias'
  const mostrarCampanhas = filtro === 'tudo' || filtro === 'campanhas'
  const campanhasFiltradas = campanhas.filter((c) => {
    const termo = q.trim().toLowerCase()
    if (!termo) return true
    return c.titulo.toLowerCase().includes(termo) || c.corpo.toLowerCase().includes(termo)
  })
  const nadaParaMostrar =
    (mostrarNoticias ? noticias.length === 0 : true) &&
    (mostrarCampanhas ? campanhasFiltradas.length === 0 : true)

  return (
    <div className="flex flex-col gap-6 pb-10">

      {listError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Tentar novamente</button>
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notícias e Eventos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fique a par do que acontece no ecoBairro</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
          />
        </div>
        {canCreate && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Nova Notícia
          </Button>
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="flex gap-2">
        {filtrosDef.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filtro === f.value
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader className="w-6 h-6 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">A carregar…</p>
        </div>
      ) : nadaParaMostrar ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Search className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">Sem resultados</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Não encontrámos conteúdos que correspondam à sua pesquisa.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
        {/* ── Campanhas & Benefícios ── */}
        {mostrarCampanhas && campanhasFiltradas.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[var(--primary)]" /> Campanhas &amp; Benefícios
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {campanhasFiltradas.map((c) => (
                <Card key={c.id} className="overflow-hidden border border-[var(--primary)]/30 bg-[var(--primary)]/[0.04] shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--primary)]/10 shrink-0">
                        <Gift className="w-4 h-4 text-[var(--primary)]" />
                      </span>
                      <Badge variant="outline" className="text-[10px] border-[var(--primary)]/40 text-[var(--primary)]">Campanha</Badge>
                    </div>
                    <h3 className="font-semibold text-sm text-foreground leading-snug">{c.titulo}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{c.corpo}</p>
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      <span className="truncate">{c.autor}</span>
                      <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" />até {c.data_validade}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── Notícias ── */}
        {mostrarNoticias && noticias.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[var(--primary)]" /> Notícias
          </h2>

          {/* Destaque */}
          {noticiaDestaque && (
            <Card className="overflow-hidden border border-border/70 shadow-none hover:shadow-sm transition-shadow cursor-pointer group">
              <div className="h-48 sm:h-60 w-full overflow-hidden bg-muted">
                <img
                  src={noticiaDestaque.imagem_url}
                  alt={noticiaDestaque.titulo}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-[var(--primary)]/40 text-[var(--primary)]">
                    {noticiaDestaque.tag}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">Destaque</Badge>
                </div>
                <h3 className="font-bold text-base text-foreground leading-snug group-hover:text-[var(--primary)] transition-colors">
                  {noticiaDestaque.titulo}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {noticiaDestaque.resumo}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(noticiaDestaque.data)}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{noticiaDestaque.tempo_leitura_min} min</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
                    Ler mais <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grelha secundária */}
          {noticiasSec.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {noticiasSec.map((n) => (
                <Card key={n.id} className="overflow-hidden border border-border/70 shadow-none hover:shadow-sm transition-shadow cursor-pointer group">
                  <div className="h-36 w-full overflow-hidden bg-muted">
                    <img src={n.imagem_url} alt={n.titulo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <Badge variant="outline" className="text-[10px] border-[var(--primary)]/40 text-[var(--primary)]">{n.tag}</Badge>
                    <h3 className="font-semibold text-sm text-foreground leading-snug group-hover:text-[var(--primary)] transition-colors">{n.titulo}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.resumo}</p>
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(n.data)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{n.tempo_leitura_min} min</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
        )}
        </div>
      )}

      {/* ── Paginação ── */}
      {!loading && mostrarNoticias && total > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total} item{total !== 1 ? 's' : ''}</span>
            <span>Página {page} de {pageCount}</span>
          </div>
          <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}

      {/* Modal Criar Notícia */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-lg font-semibold text-foreground">Nova Notícia / Evento</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col overflow-y-auto p-6 gap-5">
              {createError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                  {createError}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" required value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} placeholder="Título da notícia" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="resumo">Resumo (breve introdução)</Label>
                <textarea id="resumo" required rows={3} value={formData.resumo} onChange={e => setFormData({...formData, resumo: e.target.value})} placeholder="Um texto curto para aparecer nos cartões" className="w-full p-3 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conteudo">Conteúdo Completo</Label>
                <textarea id="conteudo" rows={6} value={formData.conteudo} onChange={e => setFormData({...formData, conteudo: e.target.value})} placeholder="Texto completo da notícia" className="w-full p-3 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria / Tag</Label>
                  <Input id="categoria" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ex: Eventos, Geral, Avisos" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imagem_url">URL da Imagem (opcional)</Label>
                  <Input id="imagem_url" value={(formData.imagem_url || '').startsWith('data:') ? '' : formData.imagem_url} onChange={e => setFormData({...formData, imagem_url: e.target.value})} placeholder="ou colar um link https://..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagem do dispositivo</Label>
                {formData.imagem_url ? (
                  <div className="relative w-full">
                    <img src={formData.imagem_url} alt="Pré-visualização" className="h-32 w-full rounded-md border border-border object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imagem_url: '' })}
                      aria-label="Remover imagem"
                      className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input text-sm text-muted-foreground transition-colors hover:border-[var(--primary)]/50 hover:bg-muted/30">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    <span>Carregar imagem do dispositivo</span>
                    <span className="text-[10px] text-muted-foreground/60">JPG, PNG ou WebP · máx. 5 MB</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handleImageFile(e)} />
                  </label>
                )}
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.destaque} onChange={e => setFormData({...formData, destaque: e.target.checked})} className="rounded border-input text-[var(--primary)] focus:ring-[var(--primary)]" />
                  <span>Destacar (aparece grande)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-border/50 flex justify-end gap-3 mt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                  {isSubmitting ? 'A Guardar...' : 'Publicar Notícia'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
