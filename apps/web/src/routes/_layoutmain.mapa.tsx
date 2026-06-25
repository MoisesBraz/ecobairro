import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import { Marker as MapLibreMarker, Source, Layer } from 'react-map-gl/maplibre'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Navigation, X, AlertTriangle, Star, Loader2, FileText, Package, GlassWater, Leaf, Trash2, Car, Bike, Footprints, Route as RouteIcon } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { clientEnv } from '@/lib/env'
import { getAccessToken, getUser } from '@/lib/auth'
import { addFavorito, listFavoritos, removeFavorito } from '@/lib/api/favoritos'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { normalizeText } from '@/lib/geo/aveiro'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { Mapa } from '@/components/mapa/mapa'
import { EcopontoPin, getTipoColor } from '@/components/ui/ecoponto-pin'

function getTipoIcon(tipo: string, color: string, className = "w-3.5 h-3.5") {
  switch (tipo.toLowerCase()) {
    case 'papel':
      return <FileText className={className} style={{ color }} />
    case 'plastico':
      return <Package className={className} style={{ color }} />
    case 'vidro':
      return <GlassWater className={className} style={{ color }} />
    case 'organico':
      return <Leaf className={className} style={{ color }} />
    case 'indiferenciado':
    default:
      return <Trash2 className={className} style={{ color }} />
  }
}
import type { EcopontoRecord, ListEcopontosResponse, EcopontoProximo } from '@ecobairro/contracts'
type TransportMode = 'driving' | 'walking' | 'cycling'

interface RouteAlternative {
  distance: number
  duration: number
  geometry: any
}
export const Route = createFileRoute('/_layoutmain/mapa')({
  validateSearch: (raw: Record<string, unknown>): { ecoponto?: string } => {
    return typeof raw.ecoponto === 'string' && raw.ecoponto.length > 0
      ? { ecoponto: raw.ecoponto }
      : {}
  },
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
  const { ecoponto: ecopontoIdFromUrl } = useSearch({ from: '/_layoutmain/mapa' })
  const [ecopontos, setEcopontos] = useState<EcopontoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pesquisa, setPesquisa] = useState('')
  const [pesquisaLista, setPesquisaLista] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>('todos')
  const [selected, setSelected] = useState<EcopontoRecord | null>(null)
  const [favoritoIds, setFavoritoIds] = useState<Set<string>>(new Set())
  const [favoritoBusy, setFavoritoBusy] = useState(false)
  const [favoritoError, setFavoritoError] = useState<string | null>(null)
  const [proximos, setProximos] = useState<Map<string, number> | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [showFavSuccess, setShowFavSuccess] = useState(false)
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number } | null>(null)
  const user = getUser()
  const isLoggedIn = Boolean(user && user.role !== 'guest')

  const [routeData, setRouteData] = useState<RouteAlternative[]>([])
  const [transportMode, setTransportMode] = useState<TransportMode>('driving')
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [routeBusy, setRouteBusy] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [routeDestination, setRouteDestination] = useState<EcopontoRecord | null>(null)
  const [routeOrigin, setRouteOrigin] = useState<{ lat: number; lng: number } | null>(null)

  const fetchRoute = useCallback(async (originLat: number, originLng: number, destLat: number, destLng: number, mode: TransportMode) => {
    setRouteBusy(true)
    setRouteError(null)
    setRouteData([])
    setSelectedRouteIndex(0)
    try {
      let basePath = ''
      if (mode === 'driving') basePath = '/osrm/car'
      else if (mode === 'cycling') basePath = '/osrm/bike'
      else basePath = '/osrm/foot'

      const url = `${basePath}/route/v1/${mode}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=true`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Falha ao obter rota.')
      const data = await res.json()
      if (data.code !== 'Ok' || !data.routes?.length) {
        throw new Error('Nenhuma rota encontrada.')
      }
      setRouteData(data.routes.map((r: any) => ({
        distance: r.distance,
        duration: r.duration,
        geometry: r.geometry,
      })))
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : 'Erro ao obter rota.')
    } finally {
      setRouteBusy(false)
    }
  }, [])

  function iniciarRota(dest: EcopontoRecord) {
    setRouteDestination(dest)
    setRouteError(null)
    setSelected(null) // hide standard popup
    if (!('geolocation' in navigator)) {
      setRouteError('Geolocalização não disponível neste dispositivo.')
      return
    }
    setRouteBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const o = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setRouteOrigin(o)
        void fetchRoute(o.lat, o.lng, dest.lat, dest.lng, transportMode)
      },
      () => {
        setRouteError('Não foi possível obter a sua localização. Verifique as permissões do navegador.')
        setRouteBusy(false)
      }
    )
  }

  // Observar GPS em background (silencioso — só atualiza posição)
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (pos) => setGpsPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* sem permissão — mantém null */ },
      { enableHighAccuracy: false, maximumAge: 30000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  function calcDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  useEffect(() => {
    if (routeOrigin && routeDestination) {
      void fetchRoute(routeOrigin.lat, routeOrigin.lng, routeDestination.lat, routeDestination.lng, transportMode)
    }
  }, [transportMode, routeOrigin, routeDestination, fetchRoute])

  function fecharRota() {
    setRouteDestination(null)
    setRouteOrigin(null)
    setRouteData([])
  }

  function formatDistance(m: number) {
    if (m < 1000) return `${Math.round(m)}m`
    return `${(m / 1000).toFixed(1)}km`
  }
  function formatDuration(s: number) {
    const m = Math.round(s / 60)
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h${rm > 0 ? ` ${rm}m` : ''}`
  }

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
      .then((res) => {
        setEcopontos(res.ecopontos)
        // Auto-select ecoponto passed in URL (e.g. navigating from home favorites)
        if (ecopontoIdFromUrl) {
          const match = res.ecopontos.find((e) => e.id === ecopontoIdFromUrl)
          if (match) setSelected(match)
        }
      })
      .catch(() => setEcopontos([]))
      .finally(() => setLoading(false))
    const id = window.setTimeout(() => {
      void loadFavoritos()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadFavoritos, ecopontoIdFromUrl])

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
      
      if (!isFav) {
        setShowFavSuccess(true)
      }
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


  const termoLista = normalizeText(pesquisaLista.trim())
  const filtered = ecopontos
    .filter((e) => {
      const matchNivel = filtroNivel === 'todos' || e.nivel === filtroNivel
      const matchSearch =
        termoLista === '' ||
        [e.nome, e.morada, e.codigo_postal, e.zona].some(
          (campo) => campo && normalizeText(campo).includes(termoLista),
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
            }}
            onSelect={(res) => {
              // Fly to the geocoded result
              setUserPos({ lat: Number(res.lat), lng: Number(res.lng) })
              setSelected(null)
              setProximos(null)
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

        {/* Coluna esquerda: lista ou rotas */}
        <div className="order-2 w-full shrink-0 flex flex-col min-h-0 relative lg:order-1 lg:h-full">
          {routeDestination ? (
            <Card className="border border-border/70 shadow-sm rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden relative z-10 bg-card">
              <div className="p-4 border-b border-border/70 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <RouteIcon className="w-4 h-4 text-[var(--primary)]" />
                    Como Chegar
                  </h3>
                  <button onClick={fecharRota} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="truncate">O seu local</span>
                  </div>
                  <div className="w-0.5 h-3 bg-border ml-1" />
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <span className="truncate font-medium">{routeDestination.nome}</span>
                  </div>
                </div>

                <div className="flex bg-muted/50 p-1 rounded-lg">
                  <button
                    onClick={() => setTransportMode('driving')}
                    className={`flex-1 flex justify-center py-1.5 rounded-md text-sm transition-colors ${transportMode === 'driving' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Car className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTransportMode('cycling')}
                    className={`flex-1 flex justify-center py-1.5 rounded-md text-sm transition-colors ${transportMode === 'cycling' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Bike className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTransportMode('walking')}
                    className={`flex-1 flex justify-center py-1.5 rounded-md text-sm transition-colors ${transportMode === 'walking' ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Footprints className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-muted/20">
                {routeBusy && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-sm">A calcular rota...</span>
                  </div>
                )}
                {routeError && (
                  <div className="p-4 text-sm text-destructive text-center bg-destructive/5 rounded-lg m-2">
                    {routeError}
                  </div>
                )}
                {!routeBusy && routeData.map((route, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedRouteIndex(i)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedRouteIndex === i
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm'
                        : 'border-border/60 bg-card hover:border-[var(--primary)]/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-[var(--primary)] text-sm">
                        {i === 0 ? 'Recomendada' : `Alternativa ${i}`}
                      </span>
                      <span className="font-bold text-foreground text-sm">
                        {formatDuration(route.duration)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Distância: {formatDistance(route.distance)}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          ) : (
          <Card className="border border-border/70 shadow-sm rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                {filtered.length} ecopontos
              </p>
              <input
                type="text"
                placeholder="Filtrar na lista..."
                value={pesquisaLista}
                onChange={(e) => setPesquisaLista(e.target.value)}
                className="w-full max-w-[160px] px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[var(--primary)] placeholder:text-muted-foreground transition-colors"
              />
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

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--primary)]' : 'text-foreground'}`}>{eco.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {eco.contentores && eco.contentores.length > 0 ? (
                          <div className="flex gap-1.5">
                            {eco.contentores.map((c) => (
                              <div key={c.id} title={`${c.tipo}: ${c.ocupacao}%`}>
                                {getTipoIcon(c.tipo, getTipoColor(c.tipo))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Sem contentores</span>
                        )}
                        {/* Distância via GPS em tempo real */}
                        {gpsPos && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            · <Navigation className="w-2.5 h-2.5" />
                            {Math.round(calcDistancia(gpsPos.lat, gpsPos.lng, eco.lat, eco.lng)) < 1000
                              ? `${Math.round(calcDistancia(gpsPos.lat, gpsPos.lng, eco.lat, eco.lng))} m`
                              : `${(calcDistancia(gpsPos.lat, gpsPos.lng, eco.lat, eco.lng) / 1000).toFixed(1)} km`
                            }
                          </span>
                        )}
                        {/* Distância via perto de mim (se GPS não disponível) */}
                        {!gpsPos && proximos && proximos.has(eco.id) && (
                          <span className="text-xs text-muted-foreground">
                            · {Math.round(proximos.get(eco.id) ?? 0)} m
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          </Card>
          )}
        </div>

        {/* Mapa direita */}
        <Card className="order-1 h-[560px] min-h-[420px] w-full overflow-hidden border border-border/70 shadow-sm rounded-xl relative z-0 lg:order-2 lg:h-full">
          <div className="h-full relative">
            <Mapa
              className="h-full w-full relative"
              onMapRef={(ref) => {
                if (ref && selected) {
                  ref.flyTo({ center: [selected.lng, selected.lat], zoom: 16, duration: 800 })
                } else if (ref && userPos && !selected) {
                  ref.flyTo({ center: [userPos.lng, userPos.lat], zoom: 16, duration: 800 })
                }
              }}
            >
                {/* Draw Route Geometries */}
                {routeOrigin && (
                  <MapLibreMarker longitude={routeOrigin.lng} latitude={routeOrigin.lat} anchor="bottom">
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md shadow-blue-500/50" />
                  </MapLibreMarker>
                )}
                {routeData.map((route, i) => (
                  <Source key={`route-src-${i}`} id={`route-src-${i}`} type="geojson" data={route.geometry}>
                    <Layer
                      id={`route-layer-${i}`}
                      type="line"
                      layout={{
                        'line-join': 'round',
                        'line-cap': 'round'
                      }}
                      paint={{
                        'line-color': selectedRouteIndex === i ? 'hsl(142, 76%, 36%)' : '#a1a1aa',
                        'line-width': selectedRouteIndex === i ? 5 : 3,
                        'line-opacity': selectedRouteIndex === i ? 0.9 : 0.6
                      }}
                    />
                  </Source>
                ))}
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
                      contentores={eco.contentores}
                      size={r * 2.5}
                      selected={isSelected}
                    />
                  </MapLibreMarker>
                )
              })}
            </Mapa>
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
                  <div className="space-y-3 mt-2">
                    {selected.contentores?.map((c) => {
                      const color = getTipoColor(c.tipo)
                      return (
                        <div key={c.id} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium items-center mb-1">
                            <span className="capitalize" style={{ color }}>{c.tipo}</span>
                            <span className="text-muted-foreground">{c.ocupacao}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${c.ocupacao}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      )
                    })}
                    {(!selected.contentores || selected.contentores.length === 0) && (
                      <p className="text-xs text-muted-foreground">Sem contentores registados.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (selected) iniciarRota(selected);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-[var(--primary)] hover:opacity-90 rounded-lg transition-opacity"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Como chegar
                    </button>
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

      {showFavSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-500 mx-auto flex items-center justify-center">
                <Star className="w-6 h-6 fill-current" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Adicionado aos favoritos!</h3>
              <p className="text-sm text-muted-foreground">
                Pode consultar os seus ecopontos favoritos na página principal (Home).
              </p>
              <button
                onClick={() => setShowFavSuccess(false)}
                className="w-full mt-4 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
