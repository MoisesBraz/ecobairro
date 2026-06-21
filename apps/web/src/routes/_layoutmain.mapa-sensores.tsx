import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import Map, { Marker as MapLibreMarker, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, CardContent } from '@/components/ui/card'
import { Wifi, WifiOff, Radio, Battery, Thermometer, AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'
import { AVEIRO_CENTER } from '@/lib/geo/aveiro'
import type { EcopontoRecord, ListEcopontosResponse, EcopontoSensor } from '@ecobairro/contracts'
import { useMapStyle } from '@/lib/geo/use-map-style'
import { MapStyleSwitcher } from '@/components/map-style-switcher'
import { EcopontoPin } from '@/components/ui/ecoponto-pin'

export const Route = createFileRoute('/_layoutmain/mapa-sensores')({
  beforeLoad: requireRole(['operador', 'gestor', 'admin']),
  component: MapaSensoresPage,
})

type SensorEstado = EcopontoSensor

const estadoConfig: Record<SensorEstado, { color: string; label: string }> = {
  online:  { color: '#22c55e', label: 'Online'  },
  offline: { color: '#94a3b8', label: 'Offline' },
  alerta:  { color: '#f87171', label: 'Alerta'  },
}



function MapaSensoresPage() {
  const [ecopontos, setEcopontos] = useState<EcopontoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<EcopontoRecord | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<SensorEstado | 'todos'>('todos')
  const { mapStyle, mapType, setMapType } = useMapStyle()

  const headers = useMemo(() => ({ Authorization: `Bearer ${getAccessToken() ?? ''}` }), [])

  useEffect(() => {
    fetchJson<ListEcopontosResponse>('/v1/ecopontos', {
      baseUrl: clientEnv.apiBaseUrl,
      headers,
    })
      .then(res => {
        setEcopontos(res.ecopontos)
        setListError(null)
      })
      .catch((err) => {
        setEcopontos([])
        setListError(getApiErrorMessage(err, 'Não foi possível carregar os sensores.'))
      })
      .finally(() => setLoading(false))
  }, [headers])

  const lista = ecopontos.filter(s => filtroEstado === 'todos' || s.sensor_estado === filtroEstado)

  const counts = {
    online:  ecopontos.filter(s => s.sensor_estado === 'online').length,
    alerta:  ecopontos.filter(s => s.sensor_estado === 'alerta').length,
    offline: ecopontos.filter(s => s.sensor_estado === 'offline').length,
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
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {listError}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold text-foreground">Mapa de Sensores IoT</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{ecopontos.length} sensores instalados</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Online',  value: counts.online,  color: '#22c55e' },
          { label: 'Alerta',  value: counts.alerta,  color: '#f87171' },
          { label: 'Offline', value: counts.offline, color: '#94a3b8' },
        ].map(s => (
          <Card key={s.label} className="border border-border/70 shadow-sm rounded-xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 justify-center flex-wrap">
        {([
          { label: 'Todos',   value: 'todos'   },
          { label: 'Online',  value: 'online'  },
          { label: 'Alerta',  value: 'alerta'  },
          { label: 'Offline', value: 'offline' },
        ] as const).map(f => (
          <button key={f.value} onClick={() => setFiltroEstado(f.value)}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${filtroEstado === f.value ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:border-[var(--primary)]/40 hover:text-foreground'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="h-[560px] min-h-[420px] w-full rounded-xl overflow-hidden border border-border shadow-sm relative">
          {mapStyle && (
          <Map
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
            {ecopontos.map(s => {

              return (
                <MapLibreMarker
                  key={s.id}
                  longitude={s.lng}
                  latitude={s.lat}
                  anchor="bottom"
                >
                  <EcopontoPin
                    tipos={s.tipos}
                    ocupacao={s.ocupacao}
                    size={36}
                    selected={s.id === selecionado?.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelecionado(s)
                    }}
                  />
                </MapLibreMarker>
              )
            })}
          </Map>
          )}
          <MapStyleSwitcher mapType={mapType} onChange={setMapType} />
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-80 overflow-y-auto pr-1">
          {lista.map(s => {
            const cfg = estadoConfig[s.sensor_estado]
            return (
              <Card
                key={s.id}
                onClick={() => setSelecionado(s)}
                className={`border shadow-sm rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${selecionado?.id === s.id ? 'border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/30' : 'border-border/70'}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                      <code className="text-xs font-semibold text-foreground">{s.codigo ?? s.nome}</code>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)` }}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{s.morada}</p>
                  {s.sensor_estado !== 'offline' && s.bateria != null && (
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Battery className="w-3 h-3" />{s.bateria}%</span>
                      {s.temperatura != null && (
                        <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" />{s.temperatura}°C</span>
                      )}
                      <span className="flex items-center gap-1">
                        {s.ocupacao >= 80 ? <AlertTriangle className="w-3 h-3 text-amber-500" /> : <Wifi className="w-3 h-3" />}
                        {s.ocupacao}%
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{s.ultima_atualizacao ?? '—'}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {selecionado && selecionado.sensor_estado !== 'offline' && (
        <Card className="border border-[var(--primary)]/30 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">{selecionado.codigo ?? selecionado.nome} — {selecionado.morada}</h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: estadoConfig[selecionado.sensor_estado].color, backgroundColor: `color-mix(in srgb, ${estadoConfig[selecionado.sensor_estado].color} 12%, transparent)` }}>
                {estadoConfig[selecionado.sensor_estado].label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Bateria',     value: selecionado.bateria != null ? `${selecionado.bateria}%` : '—',           icon: Battery     },
                { label: 'Temperatura', value: selecionado.temperatura != null ? `${selecionado.temperatura}°C` : '—',   icon: Thermometer },
                { label: 'Enchimento',  value: `${selecionado.ocupacao}%`,                                               icon: Radio       },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <p className="text-base font-bold text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Última leitura: {selecionado.ultima_atualizacao ?? '—'}</p>
          </CardContent>
        </Card>
      )}
      {selecionado && selecionado.sensor_estado === 'offline' && (
        <Card className="border border-destructive/30 bg-destructive/5 rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">{selecionado.codigo ?? selecionado.nome} está offline</p>
              <p className="text-xs text-muted-foreground">Sem comunicação desde {selecionado.ultima_atualizacao ?? '—'}. Verificar ligação no local.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
