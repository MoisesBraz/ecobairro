import { createFileRoute } from '@tanstack/react-router'
import { requireRole, getAccessToken } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusCircle, MapPin, X, Save, Pencil, Trash2, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { LocationPicker } from '@/components/reportes/location-picker'
import { AVEIRO_CENTER } from '@/lib/geo/aveiro'
import type {
  EcopontoRecord,
  ListEcopontosResponse,
  ListEcopontoZonasResponse,
  CreateEcopontoRequest,
  UpdateEcopontoRequest,
} from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/ecopontos')({
  beforeLoad: requireRole(['admin', 'gestor']),
  component: EcopontosPage,
})

type NivelEnchimento = EcopontoRecord['nivel']

const nivelConfig: Record<NivelEnchimento, { label: string; color: string; pct: number }> = {
  baixo: { label: 'Baixo',  color: 'oklch(0.55 0.18 150)', pct: 20 },
  medio: { label: 'Médio',  color: '#60a5fa',               pct: 55 },
  alto:  { label: 'Alto',   color: '#fb923c',               pct: 80 },
  cheio: { label: 'Cheio',  color: '#f87171',               pct: 100 },
}

// A restrição ao concelho de Aveiro é garantida pelo LocationPicker (que só
// propaga coords dentro de Aveiro) + pelo guard do backend ao criar/mover. Aqui
// não se revalida em bloco, para não impedir editar campos não-geográficos de um
// ecoponto legado fora da caixa.
const ecopontoSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  codigo: z.string().optional(),
  morada: z.string().min(3, 'Morada obrigatória'),
  contentores: z.array(z.object({
    tipo: z.string().min(1, 'Tipo obrigatório'),
    ocupacao: z.number().min(0).max(100),
  })),
  lat: z.number(),
  lng: z.number(),
})

type EcopontoForm = z.infer<typeof ecopontoSchema>

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function EcopontosPage() {
  const [ecopontos, setEcopontos] = useState<EcopontoRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [zonasDisponiveis, setZonasDisponiveis] = useState<string[]>([])
  // page + pesquisa + filtros vivem na URL (nuqs).
  const { params, setPage, setFilters, pageSize } = useListQuery(
    {
      q: parseAsString.withDefault(''),
      codigo_postal: parseAsString.withDefault(''),
      zona: parseAsString.withDefault(''),
      nivel: parseAsString.withDefault('todos'),
    },
    10,
  )
  const { page, q, codigo_postal: filtroCodigoPostal, zona: filtroZona, nivel: filtroNivel } = params
  const [busca, setBusca] = useState(q)
  const [buscaCp, setBuscaCp] = useState(filtroCodigoPostal)
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null)
  const [editando, setEditando] = useState<EcopontoRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modal !== null, modalRef, () => setModal(null))

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EcopontoForm>({
    resolver: zodResolver(ecopontoSchema),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contentores',
  })

  // Ponte react-hook-form ↔ LocationPicker: lat/lng vivem no form (inputs hidden),
  // o picker lê/escreve via watch/setValue.
  const latVal = watch('lat')
  const lngVal = watch('lng')
  const pickerCoords =
    Number.isFinite(Number(latVal)) && Number.isFinite(Number(lngVal))
      ? { lat: Number(latVal), lng: Number(lngVal) }
      : null

  const reload = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      // todos:true mantém os inativos visíveis na gestão (linhas a opacity-50).
      const reqParams: Record<string, string | number> = { page, pageSize, todos: 'true' }
      if (q.trim()) reqParams.q = q.trim()
      if (filtroCodigoPostal.trim()) reqParams.codigo_postal = filtroCodigoPostal.trim()
      if (filtroZona) reqParams.zona = filtroZona
      if (filtroNivel !== 'todos') reqParams.nivel = filtroNivel

      const res = await fetchJson<ListEcopontosResponse>('/v1/ecopontos', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
        params: reqParams,
      })
      setEcopontos(res.ecopontos)
      setTotal(res.total)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Não foi possível carregar os ecopontos.'))
    }
    finally { setLoading(false) }
  }, [page, q, filtroCodigoPostal, filtroZona, filtroNivel, pageSize])

  // Empurra pesquisa/código postal para a URL com debounce (volta à página 1).
  useEffect(() => {
    if (busca === q) return
    const t = setTimeout(() => setFilters({ q: busca }), 400)
    return () => clearTimeout(t)
  }, [busca, q, setFilters])
  useEffect(() => {
    if (buscaCp === filtroCodigoPostal) return
    const t = setTimeout(() => setFilters({ codigo_postal: buscaCp }), 400)
    return () => clearTimeout(t)
  }, [buscaCp, filtroCodigoPostal, setFilters])

  useEffect(() => {
    const id = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(id)
  }, [reload])

  // Zonas distintas vêm de um endpoint dedicado (a listagem é paginada, logo já
  // não traz todas as zonas). Carrega uma vez ao montar.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchJson<ListEcopontoZonasResponse>('/v1/ecopontos/zonas', {
          baseUrl: clientEnv.apiBaseUrl,
          headers: authHeaders(),
        })
        setZonasDisponiveis(res.zonas)
      } catch {
        // Filtro de zona fica vazio — a pesquisa textual continua a cobrir zonas.
      }
    })()
  }, [])

  const lista = ecopontos
  const pageCount = Math.ceil(total / pageSize)

  function abrirNovo() {
    setEditando(null)
    reset({ nome: '', codigo: '', morada: '', contentores: [{ tipo: 'Papel', ocupacao: 0 }], lat: AVEIRO_CENTER.lat, lng: AVEIRO_CENTER.lng })
    setModal('novo')
  }

  function abrirEditar(ep: EcopontoRecord) {
    setEditando(ep)
    reset({
      nome: ep.nome,
      codigo: ep.codigo ?? '',
      morada: ep.morada,
      contentores: ep.contentores.map(c => ({ tipo: c.tipo, ocupacao: c.ocupacao })),
      lat: ep.lat,
      lng: ep.lng,
    })
    setModal('editar')
  }

  async function onSubmit(data: EcopontoForm) {
    setSaving(true)
    try {
      if (editando) {
        // Só envia lat/lng se mudaram — assim editar campos não-geográficos não
        // dispara a (re)validação de localização no backend (alinha frontend↔backend).
        const coordsChanged = data.lat !== editando.lat || data.lng !== editando.lng
        const body: UpdateEcopontoRequest = {
          nome: data.nome,
          codigo: data.codigo ?? undefined,
          morada: data.morada,
          contentores: data.contentores,
          ...(coordsChanged ? { lat: data.lat, lng: data.lng } : {}),
        }
        await fetchJson(`/v1/ecopontos/${editando.id}`, {
          baseUrl: clientEnv.apiBaseUrl,
          method: 'PATCH',
          body: JSON.stringify(body),
          headers: authHeaders(),
        })
      } else {
        const body: CreateEcopontoRequest = {
          nome: data.nome,
          codigo: data.codigo ?? undefined,
          morada: data.morada,
          contentores: data.contentores,
          lat: data.lat,
          lng: data.lng,
        }
        await fetchJson('/v1/ecopontos', {
          baseUrl: clientEnv.apiBaseUrl,
          method: 'POST',
          body: JSON.stringify(body),
          headers: authHeaders(),
        })
      }
      setModal(null)
      setSubmitError(null)
      await reload()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Não foi possível guardar o ecoponto.'))
    }
    finally { setSaving(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('Desativar este ecoponto?')) return
    try {
      await fetchJson(`/v1/ecopontos/${id}`, {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'DELETE',
        headers: authHeaders(),
      })
      await reload()
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Não foi possível desativar o ecoponto.'))
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-12">

      {listError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void reload()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Tentar novamente</button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Parque de Equipamentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${total} ecopontos registados`}
          </p>
        </div>
        <Button size="sm" className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity self-start sm:self-auto" onClick={abrirNovo}>
          <PlusCircle className="w-4 h-4" />
          Novo Ecoponto
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Online',     value: ecopontos.filter(e => e.contentores.some(c => c.sensor_estado === 'online')).length,  color: 'oklch(0.55 0.18 150)' },
          { label: 'Offline',    value: ecopontos.filter(e => e.contentores.some(c => c.sensor_estado === 'offline')).length, color: '#94a3b8'               },
          { label: 'Cheios',     value: ecopontos.filter(e => e.nivel === 'cheio').length,           color: '#f87171'               },
          { label: 'Nível Alto', value: ecopontos.filter(e => e.nivel === 'alto').length,            color: '#fb923c'               },
        ].map((s) => (
          <Card key={s.label} className="border border-border/70 shadow-sm rounded-xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        {/* Nível */}
        <div className="flex gap-2 flex-wrap">
          {(['todos', 'cheio', 'alto', 'medio', 'baixo'] as const).map((n) => (
            <button
              key={n}
              onClick={() => setFilters({ nivel: n })}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all capitalize ${
                filtroNivel === n
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40'
              }`}
            >
              {n === 'todos' ? 'Todos' : nivelConfig[n].label}
            </button>
          ))}
        </div>

        {/* Pesquisa textual + código postal + zona */}
        <div className="flex flex-col sm:flex-row gap-2">
          <AddressAutocomplete
            className="flex-1"
            value={busca}
            onChange={setBusca}
            onSelect={(r) => {
              setBusca(r.rua ?? r.label)
              if (r.codigo_postal) setBuscaCp(r.codigo_postal)
            }}
            placeholder="Pesquisar por rua (Aveiro) ou nome…"
            inputClassName="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
          />
          <input
            type="text"
            placeholder="Código postal (ex: 3810)"
            value={buscaCp}
            onChange={(e) => setBuscaCp(e.target.value)}
            className="sm:w-44 px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
          />
          <select
            value={filtroZona}
            onChange={(e) => setFilters({ zona: e.target.value })}
            className="sm:w-36 px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 transition-all"
          >
            <option value="">Todas as zonas</option>
            {zonasDisponiveis.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Código', 'Morada', 'Zona', 'Enchimento', 'Sensor', 'Última Recolha', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">A carregar…</td>
                </tr>
              )}
              {!loading && lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Sem resultados</td>
                </tr>
              )}
              {lista.map((ep, i) => {
                return (
                  <tr key={ep.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${!ep.ativo ? 'opacity-50' : ''} ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-3">
                      <code className="text-xs font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">{ep.codigo ?? '—'}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-foreground">
                        <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="truncate max-w-[160px]">
                          <span>{ep.morada}</span>
                          {ep.codigo_postal && (
                            <span className="ml-1 text-[10px] text-muted-foreground">{ep.codigo_postal}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">{ep.zona ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        {ep.contentores?.map(c => (
                          <div key={c.id} className="flex items-center gap-3 text-[10px]">
                            <span className="font-semibold w-28 shrink-0">{c.tipo}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${c.ocupacao}%` }} />
                            </div>
                            <span>{c.ocupacao}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-[10px] font-medium">
                        {ep.contentores?.map(c => (
                           <div key={c.id} className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full ${c.sensor_estado === 'online' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-muted-foreground bg-muted'}`}>
                             {c.sensor_estado === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                             {c.sensor_estado === 'online' ? 'Online' : 'Offline'}
                           </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{ep.contentores?.[0]?.ultima_recolha ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button aria-label="Editar" title="Editar" onClick={() => abrirEditar(ep)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button aria-label="Eliminar" title="Eliminar" onClick={() => void eliminar(ep.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
            <span>{total} ecoponto{total !== 1 ? 's' : ''}</span>
            <span>Página {page} de {pageCount}</span>
          </div>
          <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} aria-hidden="true" />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="ecopontos-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="ecopontos-modal-title" className="text-base font-bold text-foreground">{modal === 'novo' ? 'Novo Ecoponto' : 'Editar Ecoponto'}</h2>
              <button type="button" aria-label="Fechar modal" onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {submitError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
                  <input type="text" {...register('nome')} placeholder="Ecoponto Rossio"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" />
                  {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Código</label>
                  <input type="text" {...register('codigo')} placeholder="EP-XXX"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Morada</label>
                  <input type="text" {...register('morada')} placeholder="R. do Rossio, Aveiro"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" />
                  {errors.morada && <p className="text-xs text-destructive mt-1">{errors.morada.message}</p>}
                </div>
                <div className="col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-muted-foreground block">Contentores</label>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ tipo: 'Papel', ocupacao: 0 })} className="h-6 px-2 text-[10px]">
                      + Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center border border-border p-2 rounded-xl">
                        <select {...register(`contentores.${index}.tipo`)} className="w-1/2 px-2 py-1 text-sm rounded border border-border bg-background text-foreground">
                          <option value="Papel">Papel / Azul</option>
                          <option value="Plastico">Plástico / Amarelo</option>
                          <option value="Vidro">Vidro / Verde</option>
                          <option value="Indiferenciado">Indiferenciado / Preto</option>
                        </select>
                        <input type="number" min={0} max={100} {...register(`contentores.${index}.ocupacao`, { valueAsNumber: true })} placeholder="%" className="w-1/3 px-2 py-1 text-sm rounded border border-border bg-background text-foreground" />
                        <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Localização <span className="text-muted-foreground/60 font-normal">(pesquise a rua/código postal ou clique no mapa — apenas Aveiro)</span>
                  </label>
                  {/* lat/lng vivem no form via inputs hidden; o picker escreve-os. */}
                  <input type="hidden" {...register('lat')} />
                  <input type="hidden" {...register('lng')} />
                  <LocationPicker
                    value={pickerCoords}
                    onChange={(c) => {
                      setValue('lat', c.lat, { shouldValidate: true })
                      setValue('lng', c.lng, { shouldValidate: true })
                    }}
                    onAddress={(addr) => setValue('morada', addr, { shouldValidate: true })}
                  />
                  {errors.lat && <p className="text-xs text-destructive mt-1">{errors.lat.message}</p>}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setModal(null)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={saving} className="gap-1.5 bg-[var(--primary)] hover:opacity-90 transition-opacity">
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'A guardar…' : modal === 'novo' ? 'Criar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
