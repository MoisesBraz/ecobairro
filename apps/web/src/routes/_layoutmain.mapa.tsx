import { createFileRoute, Link } from '@tanstack/react-router'
import MapGL, { Marker as MapLibreMarker, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, X, AlertTriangle, Star, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { clientEnv } from '@/lib/env'
import { getAccessToken, getUser } from '@/lib/auth'
import { addFavorito, listFavoritos, removeFavorito } from '@/lib/api/favoritos'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { AVEIRO_CENTER, normalizeText } from '@/lib/geo/aveiro'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { MapStyleSwitcher } from '@/components/map-style-switcher'
import { useMapStyle } from '@/lib/geo/use-map-style'
import { EcopontoPin } from '@/components/ui/ecoponto-pin'
import type { EcopontoRecord, ListEcopontosResponse, EcopontoProximo } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/mapa')({
  component: MapaPage,
})

const nivelConfig = {
  baixo: { color: 'oklch(0.55 0.18 150)', bar: 'oklch(0.55 0.18 150 / 0.85)', label: 'Disponível' },
  medio: { color: '#fb923c',              bar: '#fb923ccc',                    label: 'Moderado'  },
  alto:  { color: '#f87171',              bar: '#f87171cc',                    label: 'Cheio'     },
  cheio: { color: '#f87171',              bar: '#f87171cc',                    label: 'Cheio'     },
} as const

type FiltroNivel = EcopontoRecord['nivel'] | 'todos'

function MapaPage() {
  const [ecopontos, setEcopontos] = useState<EcopontoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pesquisa, setPesquisa] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>('todos')
  const [selected, setSelected] = useState<EcopontoRecord | null>(null)
  const [favoritoIds, setFavoritoIds] = useState<Set<string>>(new Set())
  const [favoritoBusy, setFavoritoBusy] = useState(false)
  const [favoritoError, setFavoritoError] = useState<string | null>(null)
  const [proximos, setProximos] = useState<Map<string, number> | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const { mapStyle, mapType, setMapType } = useMapStyle()
  const user = getUser()
  const isLoggedIn = Boolean(user && user.role !== 'guest')

  const loadFavoritos = useCallback(async () => {
    const u = getUser()
    if (!u || u.role === 'guest') {
      setFavoritoIds(new Set())
      return
    }
    try {
      const res = await listFavoritos()
      setFavoritoIds(new Set(res.ecopontos.map((e) => e.id)))
    } catch {
      setFavoritoIds(new Set())
    }
  }, [])

  useEffect(() => {
    fetchJson<ListEcopontosResponse>('/v1/ecopontos', { baseUrl: clientEnv.apiBaseUrl })
      .then((res) => setEcopontos(res.ecopontos))
      .catch(() => setEcopontos([]))
      .finally(() => setLoading(false))
    const id = window.setTimeout(() => {
      void loadFavoritos()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadFavoritos])

  async function toggleFavorito(ecopontoId: string) {
    if (!isLoggedIn) {
      setFavoritoError('Inicie sessão para guardar favoritos.')
      return
    }
    setFavoritoBusy(true)
    setFavoritoError(null)
    try {
      const isFav = favoritoIds.has(ecopontoId)
      const res = isFav
        ? await removeFavorito(ecopontoId)
        : await addFavorito(ecopontoId)
      setFavoritoIds(new Set(res.ecopontos.map((e) => e.id)))
    } catch (error) {
      setFavoritoError(getApiErrorMessage(error, 'Não foi possível atualizar o favorito.'))
    } finally {
      setFavoritoBusy(false)
    }
  }

  function limparProximos() {
    setProximos(null)
    setUserPos(null)
    setGeoError(null)
  }

  function pertoDeMim() {
    setGeoError(null)
    if (!isLoggedIn) {
      setGeoError('Inicie sessão para usar "Perto de mim".')
      return
    }
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocalização não disponível neste dispositivo.')
      return
    }
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          // Servido pelo serviço analytics (FastAPI / PostGIS ST_DWithin), não pela API NestJS.
          const res = await fetchJson<EcopontoProximo[]>('/ecopontos/proximos', {
            baseUrl: clientEnv.analyticsBaseUrl,
            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
            params: { lat, lng, raio: 2000 },
          })
          setUserPos({ lat, lng })
          setProximos(new Map(res.map((e) => [e.id, e.distancia_m])))
        } catch (err) {
          setGeoError(getApiErrorMessage(err, 'Não foi possível obter ecopontos próximos.'))
        } finally {
          setGeoBusy(false)
        }
      },
      () => {
        setGeoBusy(false)
        setGeoError('Não foi possível obter a sua localização.')
      },
    )
  }

  const [isAddressSelected, setIsAddressSelected] = useState(false)

  const termo = normalizeText(pesquisa.trim())
  const filtered = ecopontos
    .filter((e) => {
      const matchNivel = filtroNivel === 'todos' || e.nivel === filtroNivel
      // Se selecionou uma morada, não filtramos os ecopontos pelo texto da morada (mostra tudo)
      const matchSearch =
        isAddressSelected ||
        termo === '' ||
        [e.nome, e.morada, e.codigo_postal, e.zona].some(
          (campo) => campo && normalizeText(campo).includes(termo),
        )
      const matchProximo = !proximos || proximos.has(e.id)
      return matchNivel && matchSearch && matchProximo
    })
    .sort((a, b) => (proximos ? (proximos.get(a.id) ?? 0) - (proximos.get(b.id) ?? 0) : 0))

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100svh - 200px)', minHeight: 480 }}>

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Mapa de Ecopontos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aveiro · {loading ? '…' : `${ecopontos.length} ecopontos na sua zona`}{' '}
            {!loading && ecopontos[0]?.codigo ? <span className="text-[11px] opacity-70">({`DB: ${ecopontos[0].codigo}`})</span> : null}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <AddressAutocomplete
            value={pesquisa}
            onChange={(val) => {
              setPesquisa(val)
              setIsAddressSelected(false)
            }}
            onSelect={(res) => {
              // Fly to the geocoded result
              setUserPos({ lat: Number(res.lat), lng: Number(res.lng) })
              setSelected(null)
              setProximos(null)
              setIsAddressSelected(true)
            }}
            placeholder="Pesquisar rua, código postal ou ecoponto…"
            inputClassName="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
          />
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex gap-2 flex-wrap items-center justify-center shrink-0">
        {([['todos', 'Todos'], ['baixo', 'Disponível'], ['medio', 'Moderado'], ['alto', 'Alto'], ['cheio', 'Cheio']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltroNivel(val)}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${
              filtroNivel === val
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={proximos ? limparProximos : pertoDeMim}
          disabled={geoBusy}
          className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-50 ${
            proximos
              ? 'bg-[var(--primary)] text-white shadow-sm'
              : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40 hover:text-foreground'
          }`}
        >
          {geoBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
          {proximos ? `Perto de mim (${proximos.size})` : 'Perto de mim'}
        </button>
        <div className="ml-auto hidden sm:flex items-center gap-4">
          {(['baixo', 'medio', 'alto'] as const).map((k) => (
            <div key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: nivelConfig[k].color }} />
              {nivelConfig[k].label}
            </div>
          ))}
        </div>
      </div>

      {geoError && (
        <div role="alert" aria-live="polite" className="shrink-0 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {geoError}
        </div>
      )}

      {/* ── Lista + Mapa ── */}
      <div
        className="flex flex-col gap-4 flex-1 min-h-0 lg:grid lg:items-stretch lg:gap-6"
        style={{ gridTemplateColumns: 'minmax(0, 23rem) minmax(0, 1fr)' }}
      >

        {/* Coluna esquerda: lista */}
        <div className="order-2 w-full shrink-0 flex flex-col min-h-0 relative lg:order-1 lg:h-full">
          <Card className="border border-border/70 shadow-sm rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/70">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {filtered.length} ecopontos
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border sm:grid sm:grid-cols-2 sm:divide-y-0 lg:block lg:max-h-none lg:flex-1 lg:divide-y lg:divide-border">
              {loading && (
                <div className="p-4 text-sm text-muted-foreground text-center">A carregar…</div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">Sem resultados</div>
              )}
              {filtered.map((eco) => {
                const cfg = nivelConfig[eco.nivel]
                const isActive = selected?.id === eco.id
                return (
                  <button
                    key={eco.id}
                    onClick={() => setSelected(isActive ? null : eco)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-sm ${isActive ? 'bg-[var(--primary)]/8' : ''}`}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--primary)]' : 'text-foreground'}`}>{eco.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {eco.ocupacao}% ocupado
                        {proximos && proximos.has(eco.id) ? ` · ${Math.round(proximos.get(eco.id) ?? 0)} m` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Mapa direita */}
        <Card className="order-1 h-[560px] min-h-[420px] w-full overflow-hidden border border-border/70 shadow-sm rounded-xl relative z-0 lg:order-2 lg:h-full">
          <div className="h-full relative">
            {mapStyle && (
              <MapGL
                initialViewState={{
                  longitude: AVEIRO_CENTER.lng,
                  latitude: AVEIRO_CENTER.lat,
                  zoom: 14,
                  pitch: 45, // Set pitch for 3D view
                }}
                mapStyle={mapStyle}
                terrain={{ source: 'terrainSource', exaggeration: 1.5 }}
                style={{ width: '100%', height: '100%' }}
                ref={(ref) => {
                  if (ref && selected) {
                    ref.flyTo({ center: [selected.lng, selected.lat], zoom: 16, duration: 800 })
                  } else if (ref && userPos && !selected) {
                    ref.flyTo({ center: [userPos.lng, userPos.lat], zoom: 16, duration: 800 })
                  }
                }}
              >
                <FullscreenControl position="top-right" />
                <NavigationControl position="top-right" visualizePitch={true} />
              {filtered.map((eco) => {

                const isSelected = selected?.id === eco.id
                const r = isSelected ? 14 : 10
                return (
                  <MapLibreMarker
                    key={eco.id}
                    longitude={eco.lng}
                    latitude={eco.lat}
                    anchor="bottom"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      setSelected(eco)
                    }}
                  >
                    <EcopontoPin
                      tipos={eco.tipos}
                      ocupacao={eco.ocupacao}
                      size={r * 2.5}
                      selected={isSelected}
                    />
                  </MapLibreMarker>
                )
              })}
                </MapGL>
            )}
            <MapStyleSwitcher mapType={mapType} onChange={setMapType} />
          </div>

          {/* Popup flutuante */}
          {selected && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1100] w-80 animate-in slide-in-from-bottom-2 duration-200">
              <Card className="border border-border/70 shadow-lg rounded-xl overflow-hidden bg-card">
                <div className="h-1 w-full" style={{ backgroundColor: nivelConfig[selected.nivel].bar }} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground leading-tight">{selected.nome}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{selected.codigo}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />{selected.morada}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isLoggedIn && (
                        <button
                          type="button"
                          disabled={favoritoBusy}
                          onClick={() => void toggleFavorito(selected.id)}
                          className="p-1 rounded-md text-muted-foreground hover:text-amber-500 transition-colors disabled:opacity-50"
                          title={favoritoIds.has(selected.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Star
                            className={`w-4 h-4 ${favoritoIds.has(selected.id) ? 'fill-amber-400 text-amber-500' : ''}`}
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {favoritoError && (
                    <p className="text-[11px] text-destructive">{favoritoError}</p>
                  )}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${selected.ocupacao}%`, backgroundColor: nivelConfig[selected.nivel].bar }} />
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {selected.ocupacao}% ocupado
                        {selected.ultima_atualizacao ? ` · ${selected.ultima_atualizacao}` : ''}
                      </span>
                      <span className="font-medium" style={{ color: nivelConfig[selected.nivel].color }}>
                        {nivelConfig[selected.nivel].label}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selected.tipos.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={`https://www.openstreetmap.org/directions?from=&to=${selected.lat}%2C${selected.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-[var(--primary)] hover:opacity-90 rounded-lg transition-opacity"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Como chegar
                    </a>
                    <Link
                      to="/reportes"
                      search={{
                        novo: '1' as const,
                        local: selected.morada || selected.nome,
                        tipo: 'Ecoponto Cheio' as const,
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold border border-destructive/60 text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Reportar
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}
