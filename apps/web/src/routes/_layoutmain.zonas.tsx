import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import MapGL, { Source, Layer, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, CardContent } from '@/components/ui/card'
import { Map as MapIcon, Recycle, Loader, Info } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { clientEnv } from '@/lib/env'
import { useMapStyle } from '@/lib/geo/use-map-style'
import { MapStyleSwitcher } from '@/components/map-style-switcher'
import type { ListEcopontosResponse } from '@ecobairro/contracts'
import { zonaPolygon, type LatLng } from '@/lib/geo/zona-polygon'
import { AVEIRO_CENTER } from '@/lib/geo/aveiro'

export const Route = createFileRoute('/_layoutmain/zonas')({
  beforeLoad: requireRole(['operador', 'gestor', 'admin']),
  component: ZonasPage,
})

/* ─── Config geográfica das zonas legadas (polígonos + cor) — apenas display ───
   As zonas deixaram de ser geridas à mão: são derivadas automaticamente pelo
   backend agrupando ecopontos a ≤ 50 m. Nomes legados (Centro/Norte/…) ainda
   têm polígono; clusters novos caem em DEFAULT_CONFIG (sem polígono). */
const ZONA_CONFIG: Record<string, { cor: string; descricao: string; polygon: [number, number][] }> = {
  Centro: {
    cor: '#60a5fa',
    descricao: 'Zona histórica e comercial de Aveiro',
    polygon: [[40.6420, -8.6580], [40.6420, -8.6480], [40.6360, -8.6480], [40.6360, -8.6580]],
  },
  Norte: {
    cor: '#22c55e',
    descricao: 'Zona residencial norte — Campus e arredores',
    polygon: [[40.6480, -8.6580], [40.6480, -8.6440], [40.6420, -8.6440], [40.6420, -8.6580]],
  },
  Sul: {
    cor: '#fb923c',
    descricao: 'Zona sul — Aradas e Esgueira',
    polygon: [[40.6360, -8.6580], [40.6360, -8.6480], [40.6300, -8.6480], [40.6300, -8.6580]],
  },
  Oeste: {
    cor: '#a78bfa',
    descricao: 'Zona beira-mar e zonas costeiras',
    polygon: [[40.6450, -8.6700], [40.6450, -8.6580], [40.6350, -8.6580], [40.6350, -8.6700]],
  },
  Este: {
    cor: '#f472b6',
    descricao: 'Zona industrial e periférica este',
    polygon: [[40.6460, -8.6480], [40.6460, -8.6380], [40.6370, -8.6380], [40.6370, -8.6480]],
  },
}

// Paleta para colorir zonas auto-derivadas que não têm cor legada definida.
const PALETTE = ['#60a5fa', '#22c55e', '#fb923c', '#a78bfa', '#f472b6', '#f59e0b', '#14b8a6', '#ef4444']

interface ZonaView {
  nome: string
  descricao: string
  cor: string
  ecopontos: number
  polygon: [number, number][]
}

function ZonasPage() {
  const [zonas, setZonas]         = useState<ZonaView[]>([])
  const [loading, setLoading]     = useState(true)
  const [selecionada, setSelecionada] = useState<ZonaView | null>(null)
  const { mapStyle, mapType, setMapType } = useMapStyle()

  useEffect(() => {
    fetchJson<ListEcopontosResponse>('/v1/ecopontos', { baseUrl: clientEnv.apiBaseUrl })
      .then(resp => {
        /* Agrupa ecopontos pela zona auto-derivada, guardando as coordenadas */
        const coords: Record<string, LatLng[]> = {}
        for (const ep of resp.ecopontos) {
          const z = ep.zona ?? 'Sem zona'
          ;(coords[z] ??= []).push([ep.lat, ep.lng])
        }
        const views: ZonaView[] = Object.entries(coords).map(([nome, pts], i) => {
          const cfg = ZONA_CONFIG[nome]
          return {
            nome,
            ecopontos: pts.length,
            descricao: cfg?.descricao ?? '',
            cor: cfg?.cor ?? PALETTE[i % PALETTE.length]!,
            // Geometria derivada dos ecopontos da zona (atualiza ao adicioná-los).
            polygon: zonaPolygon(pts),
          }
        })
        setZonas(views)
      })
      .catch(() => setZonas([]))
      .finally(() => setLoading(false))
  }, [])

  const totalEcopontos = useMemo(() => zonas.reduce((s, z) => s + z.ecopontos, 0), [zonas])

  return (
    <div className="flex w-full max-w-full flex-col gap-6 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Zonas (automáticas)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${zonas.length} zonas derivadas dos ecopontos`}
          </p>
        </div>
      </div>

      {/* Nota: zonas auto-derivadas */}
      <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-[var(--primary)]" />
        <p>
          As zonas são calculadas automaticamente: ao adicionar um ecoponto, ele junta-se à
          zona de um ponto vizinho a ≤ 50 m; se estiver isolado, forma uma zona nova com o
          nome da sua morada. Não há criação nem edição manual.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ecopontos',  value: totalEcopontos,   color: '#60a5fa' },
          { label: 'Zonas',      value: zonas.length,     color: 'oklch(0.55 0.18 150)' },
          { label: 'Zona Maior', value: zonas.length > 0 ? Math.max(...zonas.map(z => z.ecopontos)) : 0, color: '#fb923c' },
        ].map(s => (
          <Card key={s.label} className="border border-border/70 shadow-sm rounded-xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Mapa */}
          <div className="h-[560px] min-h-[420px] w-full rounded-xl overflow-hidden border border-border shadow-sm relative">
            {mapStyle && (
              <MapGL
                initialViewState={{
                  longitude: AVEIRO_CENTER.lng,
                  latitude: AVEIRO_CENTER.lat,
                  zoom: 13,
                  pitch: 45,
                }}
                mapStyle={mapStyle}
                terrain={{ source: 'terrainSource', exaggeration: 1.5 }}
                style={{ width: '100%', height: '100%' }}
                interactiveLayerIds={zonas.filter(z => z.polygon.length > 0).map(z => `layer-fill-${z.nome}`)}
                onClick={(e) => {
                  if (e.features && e.features.length > 0) {
                    const feature = e.features[0]
                    const nome = feature.layer.id.replace('layer-fill-', '')
                    const zona = zonas.find(z => z.nome === nome)
                    if (zona) setSelecionada(zona)
                  } else {
                    setSelecionada(null)
                  }
                }}
              >
                <FullscreenControl position="top-right" />
                <NavigationControl position="top-right" visualizePitch={true} />
                <Source id="terrainSource" type="raster-dem" url="https://demotiles.maplibre.org/terrain-tiles/tiles.json" tileSize={256} />
                
                {zonas.filter(z => z.polygon.length > 0).map(z => {
                  // Polygon is [[lat, lng], [lat, lng], ...], geojson needs [[lng, lat], ...]
                  const coordinates = z.polygon.map(([lat, lng]) => [lng, lat])
                  // Polygons in GeoJSON are arrays of linear rings, so we wrap coordinates in an array
                  // and make sure the first and last point are the same (close the polygon)
                  if (coordinates.length > 0) {
                    const first = coordinates[0]
                    const last = coordinates[coordinates.length - 1]
                    if (first![0] !== last![0] || first![1] !== last![1]) {
                      coordinates.push([...first!])
                    }
                  }
                  
                  return (
                    <Source key={`source-${z.nome}`} id={`source-${z.nome}`} type="geojson" data={{
                      type: 'Feature',
                      properties: { nome: z.nome },
                      geometry: { type: 'Polygon', coordinates: [coordinates] }
                    }}>
                      <Layer 
                        id={`layer-fill-${z.nome}`} 
                        type="fill" 
                        paint={{
                          'fill-color': z.cor,
                          'fill-opacity': selecionada?.nome === z.nome ? 0.35 : 0.15,
                        }} 
                      />
                      <Layer 
                        id={`layer-line-${z.nome}`} 
                        type="line" 
                        paint={{
                          'line-color': z.cor,
                          'line-width': selecionada?.nome === z.nome ? 3 : 1.5,
                        }} 
                      />
                    </Source>
                  )
                })}
              </MapGL>
            )}
            <MapStyleSwitcher mapType={mapType} onChange={setMapType} />
          </div>

          {/* Lista */}
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 max-h-80 overflow-y-auto">
            {zonas.map(z => (
              <Card
                key={z.nome}
                onClick={() => setSelecionada(z)}
                className={`border shadow-sm rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${selecionada?.nome === z.nome ? 'border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/30' : 'border-border/70'}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: z.cor }} />
                    <p className="text-xs font-semibold text-foreground truncate">{z.nome}</p>
                  </div>
                  {z.descricao && <p className="text-[10px] text-muted-foreground line-clamp-1">{z.descricao}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Recycle className="w-3 h-3" />{z.ecopontos}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      )}

      {/* Detalhe zona selecionada */}
      {selecionada && (
        <Card className="border border-border/70 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: selecionada.cor }} />
              <h3 className="text-sm font-bold text-foreground">Zona {selecionada.nome}</h3>
              {selecionada.descricao && <p className="text-xs text-muted-foreground">— {selecionada.descricao}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Ecopontos', value: selecionada.ecopontos, icon: Recycle, color: '#60a5fa'               },
                { label: 'Zona',      value: selecionada.nome,      icon: MapIcon, color: 'oklch(0.55 0.18 150)' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex flex-col items-center p-3 rounded-xl bg-muted/30 gap-1">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <p className="text-base font-bold text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
