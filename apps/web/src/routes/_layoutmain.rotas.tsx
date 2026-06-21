import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import MapGL, { Marker as MapLibreMarker, Source, Layer, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, CardContent } from '@/components/ui/card'
import { Route as RouteIcon, Clock, MapPin, Truck, CheckCircle, Play, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken, getUser } from '@/lib/auth'
import { GerarRotaModal } from '@/components/rotas/gerar-rota-modal'
import type { RotaRecord, ListRotasResponse } from '@ecobairro/contracts'
import { AVEIRO_CENTER } from '@/lib/geo/aveiro'
import { useMapStyle } from '@/lib/geo/use-map-style'
import { MapStyleSwitcher } from '@/components/map-style-switcher'
import { EcopontoPin } from '@/components/ui/ecoponto-pin'

export const Route = createFileRoute('/_layoutmain/rotas')({
  beforeLoad: requireRole(['operador', 'gestor', 'admin']),
  component: RotasPage,
})

type EstadoRota = RotaRecord['estado']

const estadoConfig: Record<EstadoRota, { label: string; color: string }> = {
  ativa:     { label: 'Ativa',     color: '#22c55e' },
  concluida: { label: 'Concluída', color: '#60a5fa' },
  pendente:  { label: 'Pendente',  color: '#fb923c' },
}

function WaypointIcon({ color, n, ocupacao, children }: { color: string, n: number, ocupacao?: number, children?: React.ReactNode }) {
  return (
    <div className="relative group cursor-pointer" style={{ transform: 'translate(-50%, -100%)' }}>
      <EcopontoPin
        tipos={['indiferenciado']}
        ocupacao={ocupacao ?? 0}
        size={36}
        label={n}
        fallbackColor={color}
      />
      {children && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-max max-w-xs bg-popover text-popover-foreground text-xs rounded shadow-md border border-border p-2">
          {children}
        </div>
      )}
    </div>
  )
}

function RotasPage() {
  const role = getUser()?.role
  const isOperador = role === 'operador'
  const isManager = role === 'gestor' || role === 'admin'
  const [rotas, setRotas] = useState<RotaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaRecord | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const { mapStyle, mapType, setMapType } = useMapStyle()

  const headers = useMemo(() => ({ Authorization: `Bearer ${getAccessToken() ?? ''}` }), [])

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const res = await fetchJson<ListRotasResponse>('/v1/rotas', {
        baseUrl: clientEnv.apiBaseUrl,
        headers,
      })
      setRotas(res.rotas)
      if (res.rotas.length > 0) setRotaSelecionada(res.rotas[0]!)
    } catch (err) {
      setRotas([])
      setListError(getApiErrorMessage(err, 'Não foi possível carregar as rotas.'))
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  async function updateEstado(id: string, estado: EstadoRota) {
    const updated = await fetchJson<RotaRecord>(`/v1/rotas/${id}`, {
      baseUrl: clientEnv.apiBaseUrl,
      headers,
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    })
    setRotas(prev => prev.map(r => r.id === id ? updated : r))
    if (rotaSelecionada?.id === id) setRotaSelecionada(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-6 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">
      {listError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Tentar novamente</button>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{isOperador ? 'As Minhas Rotas' : 'Gestão de Rotas'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rotas.length} {isOperador ? 'rotas atribuídas' : 'rotas configuradas'}</p>
        </div>
        {isManager && (
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Sparkles className="h-4 w-4" /> Gerar rota
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ativas',     value: rotas.filter(r => r.estado === 'ativa').length,     color: '#22c55e' },
          { label: 'Pendentes',  value: rotas.filter(r => r.estado === 'pendente').length,  color: '#fb923c' },
          { label: 'Concluídas', value: rotas.filter(r => r.estado === 'concluida').length, color: '#60a5fa' },
        ].map(s => (
          <Card key={s.label} className="border border-border/70 shadow-sm rounded-xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="h-[560px] min-h-[420px] w-full rounded-xl overflow-hidden border border-border shadow-sm relative">
          {mapStyle && (
          <MapGL
            initialViewState={{
              longitude: AVEIRO_CENTER.lng,
              latitude: AVEIRO_CENTER.lat,
              zoom: 14,
              pitch: 45,
            }}
            mapStyle={mapStyle}
            terrain={{ source: 'terrainSource', exaggeration: 1.5 }}
            style={{ width: '100%', height: '100%' }}
          >
            <FullscreenControl position="top-right" />
            <NavigationControl position="top-right" visualizePitch={true} />
            <Source id="terrainSource" type="raster-dem" url="https://demotiles.maplibre.org/terrain-tiles/tiles.json" tileSize={256} />
            
            {rotas.map(r => {
              const positions = r.geometria.length > 0 ? r.geometria : r.waypoints
              const coordinates = positions.map(([lat, lng]) => [lng, lat])
              
              if (coordinates.length === 0) return null
              
              return (
                <Source key={`source-${r.id}`} id={`source-${r.id}`} type="geojson" data={{
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'LineString', coordinates }
                }}>
                  <Layer 
                    id={`layer-${r.id}`} 
                    type="line" 
                    paint={{
                      'line-color': r.cor,
                      'line-width': r.id === rotaSelecionada?.id ? 4 : 2,
                      'line-opacity': r.id === rotaSelecionada?.id ? 0.9 : 0.35,
                    }} 
                  />
                </Source>
              )
            })}

            {rotaSelecionada && (
              rotaSelecionada.paragens.length > 0
                ? rotaSelecionada.paragens.map((p) => (
                    <MapLibreMarker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center">
                      <WaypointIcon color={rotaSelecionada.cor} n={p.ordem} ocupacao={p.ocupacao}>
                        <p className="text-xs font-medium">{p.ordem}. {p.nome}</p>
                        <p className="text-[11px] text-muted-foreground">Enchimento: {p.ocupacao}%</p>
                      </WaypointIcon>
                    </MapLibreMarker>
                  ))
                : rotaSelecionada.waypoints.map(([lat, lng], i) => (
                    <MapLibreMarker key={i} longitude={lng} latitude={lat} anchor="center">
                      <WaypointIcon color={rotaSelecionada.cor} n={i + 1}>
                        <p className="text-xs font-medium">Paragem {i + 1}</p>
                      </WaypointIcon>
                    </MapLibreMarker>
                  ))
            )}
          </MapGL>
          )}
          <MapStyleSwitcher mapType={mapType} onChange={setMapType} />
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-80 overflow-y-auto">
          {rotas.map(r => {
            const cfg = estadoConfig[r.estado]
            const isSelected = rotaSelecionada?.id === r.id
            return (
              <Card
                key={r.id}
                onClick={() => setRotaSelecionada(r)}
                className={`border shadow-sm rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/30' : 'border-border/70'}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.cor }} />
                      <p className="text-xs font-semibold text-foreground">{r.nome}</p>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)` }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                    <Truck className="w-3 h-3" /> {r.operador}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.ecopontos} ecopontos</span>
                    <span className="flex items-center gap-1"><RouteIcon className="w-3 h-3" />{r.distancia}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.duracao}</span>
                  </div>
                  {r.estado === 'pendente' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void updateEstado(r.id, 'ativa') }}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-[var(--primary)]/30 px-2 py-1 text-[11px] font-semibold text-[var(--primary)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--primary)] hover:text-white hover:shadow-md"
                    >
                      <Play className="w-3 h-3" /> Iniciar rota
                    </button>
                  )}
                  {r.estado === 'ativa' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void updateEstado(r.id, 'concluida') }}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2 py-1 text-[11px] font-semibold text-emerald-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600 hover:text-white hover:shadow-md"
                    >
                      <CheckCircle className="w-3 h-3" /> Concluir rota
                    </button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

      </div>

      {modalAberto && (
        <GerarRotaModal
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            setModalAberto(false)
            void load()
          }}
        />
      )}
    </div>
  )
}
