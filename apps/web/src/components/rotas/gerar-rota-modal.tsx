import { useCallback, useEffect, useMemo, useState } from 'react'
import MapGL, { Marker as MapLibreMarker, Source, Layer, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre'
import { X, Loader2, Navigation, Save, Calculator, Sparkles } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'
import { useMapStyle } from '@/lib/geo/use-map-style'
import { MapStyleSwitcher } from '@/components/map-style-switcher'
import { EcopontoPin } from '@/components/ui/ecoponto-pin'
import type {
  CreateRotaRequest,
  ListEcopontoZonasResponse,
  RotaRecord,
  RotaSugestaoResponse,
} from '@ecobairro/contracts'

function ParagemIcon({ n, children }: { n: number, children?: React.ReactNode }) {
  return (
    <div className="relative group cursor-pointer" style={{ transform: 'translate(-50%, -100%)' }}>
      <EcopontoPin
        tipos={['indiferenciado']}
        ocupacao={0} // Unknown in modal planning, or we could pass if we had it
        size={36}
        label={n}
        fallbackColor="#16a34a"
      />
      {children && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-max max-w-xs bg-popover text-popover-foreground text-xs rounded shadow-md border border-border p-2">
          {children}
        </div>
      )}
    </div>
  )
}

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocalização não disponível neste dispositivo.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Não foi possível obter a sua localização.')),
    )
  })
}

const COR_DEFAULT = '#22c55e'
const inputClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export function GerarRotaModal({ onClose, onSaved }: Props) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${getAccessToken() ?? ''}` }), [])

  const [zonas, setZonas] = useState<string[]>([])
  const [zona, setZona] = useState('')
  const [usarLocalizacao, setUsarLocalizacao] = useState(false)
  const [limiar, setLimiar] = useState(60)

  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [sugestao, setSugestao] = useState<RotaSugestaoResponse | null>(null)

  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(COR_DEFAULT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { mapStyle, mapType, setMapType } = useMapStyle()

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchJson<ListEcopontoZonasResponse>('/v1/ecopontos/zonas', {
          baseUrl: clientEnv.apiBaseUrl,
          headers,
        })
        setZonas(res.zonas)
      } catch {
        setZonas([])
      }
    })()
  }, [headers])

  const calcular = useCallback(async () => {
    setCalcError(null)
    setSugestao(null)
    setCalculating(true)
    try {
      const params: Record<string, string | number | undefined> = { limiar }
      if (zona) params.zona = zona
      if (usarLocalizacao) {
        const pos = await getPosition()
        params.veiculo_lat = pos.lat
        params.veiculo_lng = pos.lng
      }
      const res = await fetchJson<RotaSugestaoResponse>('/operacional/rota-sugestao', {
        baseUrl: clientEnv.analyticsBaseUrl,
        headers,
        params,
      })
      setSugestao(res)
      setNome((prev) => prev || `Rota ${res.zona ?? 'recolha'} — ${res.distancia_label}`)
    } catch (err) {
      setCalcError(getApiErrorMessage(err, 'Não foi possível calcular a rota.'))
    } finally {
      setCalculating(false)
    }
  }, [headers, limiar, usarLocalizacao, zona])

  const guardar = useCallback(async () => {
    if (!sugestao || sugestao.paragens.length === 0) return
    setSaveError(null)
    setSaving(true)
    try {
      const payload: CreateRotaRequest = {
        nome: nome.trim() || `Rota ${sugestao.zona ?? 'recolha'}`,
        zona: sugestao.zona,
        cor,
        distancia: sugestao.distancia_label,
        duracao: sugestao.duracao_label,
        waypoints: sugestao.paragens.map((p) => [p.lat, p.lng] as [number, number]),
        geometria: sugestao.geometria,
        paragens: sugestao.paragens,
        ecopontoIds: sugestao.paragens.map((p) => p.id),
      }
      await fetchJson<RotaRecord>('/v1/rotas', {
        baseUrl: clientEnv.apiBaseUrl,
        headers,
        method: 'POST',
        body: JSON.stringify(payload),
      })
      onSaved()
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Não foi possível guardar a rota.'))
    } finally {
      setSaving(false)
    }
  }, [cor, headers, nome, onSaved, sugestao])

  const semParagens = sugestao !== null && sugestao.paragens.length === 0
  const centro: [number, number] = sugestao?.paragens[0]
    ? [sugestao.paragens[0].lat, sugestao.paragens[0].lng]
    : [40.638, -8.654]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gerar-rota-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="gerar-rota-title" className="flex items-center gap-2 text-base font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" /> Gerar rota
          </h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Calcula uma rota real por estradas (OSM) para os ecopontos que precisam de recolha,
          ordenados por prioridade. Pré-visualize e guarde.
        </p>

        {/* Controlos */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Zona</label>
            <select value={zona} onChange={(e) => setZona(e.target.value)} className={inputClass}>
              <option value="">Todas as zonas</option>
              {zonas.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Limiar de enchimento (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={limiar}
              onChange={(e) => setLimiar(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className={inputClass}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={usarLocalizacao}
                onChange={(e) => setUsarLocalizacao(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Navigation className="h-3.5 w-3.5 text-muted-foreground" /> Partir da minha posição
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void calcular()}
          disabled={calculating}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
        >
          {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          {calculating ? 'A calcular…' : 'Calcular rota'}
        </button>

        {calcError && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {calcError}
          </div>
        )}

        {semParagens && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-700">
            Nenhum ecoponto precisa de recolha {zona ? `na zona "${zona}"` : ''} com este limiar.
          </div>
        )}

        {/* Pré-visualização */}
        {sugestao && sugestao.paragens.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  sugestao.motor === 'osrm'
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-amber-500/15 text-amber-600'
                }`}
                title={sugestao.motor === 'osrm' ? 'Trajeto por estradas (OSRM)' : 'Fallback linha-reta (OSRM indisponível)'}
              >
                {sugestao.motor === 'osrm' ? 'Estradas (OSRM)' : 'Aproximado (linha reta)'}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                {sugestao.distancia_label}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                {sugestao.duracao_label}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                {sugestao.paragens.length} paragens
              </span>
            </div>

            <div className="h-[280px] w-full overflow-hidden rounded-xl border border-border relative">
              {mapStyle && (
                <MapGL
                  initialViewState={{
                    longitude: centro[1],
                    latitude: centro[0],
                    zoom: 13,
                    pitch: 45,
                  }}
                  mapStyle={mapStyle}
                  terrain={{ source: 'terrainSource', exaggeration: 1.5 }}
                >
                  <FullscreenControl position="top-right" />
                  <NavigationControl position="top-right" visualizePitch={true} />
                  <Source id="terrainSource" type="raster-dem" url="https://demotiles.maplibre.org/terrain-tiles/tiles.json" tileSize={256} />
                  
                  {sugestao.geometria.length > 0 && (
                    <Source id="route-source" type="geojson" data={{
                      type: 'Feature',
                      properties: {},
                      geometry: { type: 'LineString', coordinates: sugestao.geometria.map(([lat, lng]) => [lng, lat]) }
                    }}>
                      <Layer 
                        id="route-layer" 
                        type="line" 
                        paint={{
                          'line-color': cor,
                          'line-width': 4,
                          'line-opacity': 0.9,
                        }} 
                      />
                    </Source>
                  )}
                  
                  {sugestao.paragens.map((p) => (
                    <MapLibreMarker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center">
                      <ParagemIcon n={p.ordem}>
                        <p className="text-xs font-semibold">{p.ordem}. {p.nome}</p>
                        <p className="text-[11px] text-muted-foreground">Enchimento: {p.ocupacao}%</p>
                      </ParagemIcon>
                    </MapLibreMarker>
                  ))}
                </MapGL>
              )}
              <MapStyleSwitcher mapType={mapType} onChange={setMapType} />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome da rota</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cor</label>
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="h-[42px] w-16 cursor-pointer rounded-xl border border-border bg-background"
                />
              </div>
            </div>

            {saveError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {saveError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void guardar()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-600 transition-all hover:-translate-y-0.5 hover:bg-emerald-600 hover:text-white hover:shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'A guardar…' : 'Guardar rota'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
