import MapGL, { Marker as MapLibreMarker, NavigationControl, FullscreenControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Search, Crosshair, Loader2, MapPin } from 'lucide-react'
import { MarkerPin } from '@/components/ui/map-pin'
import { EcopontoPin } from '@/components/ui/ecoponto-pin'
import { useEffect, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { clientEnv } from '@/lib/env'
import {
  AVEIRO_CENTER,
  buildNominatimReverseUrl,
  buildNominatimSearchUrl,
  isAveiroNominatimResult,
  isWithinAveiro,
  type NominatimResult,
} from '@/lib/geo/aveiro'
import { useMapStyle } from '@/lib/geo/use-map-style'
import { MapStyleSwitcher } from '@/components/map-style-switcher'
import type { EcopontoRecord, ListEcopontosResponse, ContentorRecord } from '@ecobairro/contracts'

export type Coords = { lat: number; lng: number }

const PinIcon = () => (
  <div>
    <MarkerPin color="#ef4444" size={32} />
  </div>
)

interface LocationPickerProps {
  value: Coords | null
  onChange: (c: Coords) => void
  /** Recebe a morada (geocoding inverso) para preencher o campo de texto "local". */
  onAddress?: (address: string) => void
  onEcopontoSelect?: (ecoponto: EcopontoRecord | null) => void
  onContentorSelect?: (contentor: ContentorRecord | null) => void
  /** Restringe a seleção apenas a contentores de ecopontos */
  onlyContentorSelection?: boolean
}

export function LocationPicker({ value, onChange, onAddress, onEcopontoSelect, onContentorSelect, onlyContentorSelection = false }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mapStyle, mapType, setMapType } = useMapStyle()
  const [ecopontos, setEcopontos] = useState<EcopontoRecord[]>([])
  const [loadingEcopontos, setLoadingEcopontos] = useState(true)
  const [selectedEcoponto, setSelectedEcoponto] = useState<EcopontoRecord | null>(null)
  const [selectedContentor, setSelectedContentor] = useState<ContentorRecord | null>(null)

  // Load ecopontos
  useEffect(() => {
    fetchJson<ListEcopontosResponse>('/v1/ecopontos', { baseUrl: clientEnv.apiBaseUrl })
      .then((res) => setEcopontos(res.ecopontos))
      .catch(() => setEcopontos([]))
      .finally(() => setLoadingEcopontos(false))
  }, [])

  // Notify parent of ecoponto and contentor changes
  useEffect(() => {
    onEcopontoSelect?.(selectedEcoponto)
  }, [selectedEcoponto, onEcopontoSelect])

  useEffect(() => {
    onContentorSelect?.(selectedContentor)
  }, [selectedContentor, onContentorSelect])



  function pickContentor(eco: EcopontoRecord, contentor: any, _index: number) {
    const c = { lat: eco.lat, lng: eco.lng }
    onChange(c)
    const address = `${eco.morada || eco.nome} (${contentor.tipo})`
    onAddress?.(address)
    setSelectedAddress(address)
    setSelectedEcoponto(eco)
    setSelectedContentor(contentor)
    setSearchQuery('')
    setResults([])
  }

  // Pesquisa debounced (>= 3 caracteres) — rua ou código postal, restrita ao
  // concelho de Aveiro (viewbox + confirmação do município pela morada).
  useEffect(() => {
    if (searchQuery.trim().length < 3) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        const r = await fetch(buildNominatimSearchUrl(searchQuery), {
          headers: { Accept: 'application/json' },
        })
        const todos = (await r.json()) as NominatimResult[]
        const aveiro = todos.filter(isAveiroNominatimResult)
        setResults(aveiro)
        if (todos.length > 0 && aveiro.length === 0) {
          setError('Nenhuma morada encontrada no concelho de Aveiro.')
        }
      } catch {
        setError('Pesquisa de morada indisponível.')
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Aceita uma coordenada (clique/arraste/geolocalização) confirmando que pertence
  // ao concelho de Aveiro: bbox (rápido) + município via geocoding inverso. Só
  // propaga `onChange`/`onAddress` se passar; senão mostra erro e não altera nada.
  async function set(c: Coords) {
    if (!isWithinAveiro(c.lat, c.lng)) {
      setError('Localização fora do concelho de Aveiro.')
      return
    }
    try {
      const r = await fetch(buildNominatimReverseUrl(c.lat, c.lng), {
        headers: { Accept: 'application/json' },
      })
      const d = (await r.json()) as { display_name?: string; address?: NominatimResult['address'] }
      const res: NominatimResult = {
        lat: String(c.lat),
        lon: String(c.lng),
        display_name: d.display_name ?? '',
        address: d.address,
      }
      if (d.display_name && !isAveiroNominatimResult(res)) {
        setError('Localização fora do concelho de Aveiro.')
        return
      }
      setError(null)
      onChange(c)
      if (d.display_name) {
        onAddress?.(d.display_name)
        setSelectedAddress(d.display_name)
        setSelectedEcoponto(null)
        setSelectedContentor(null)
        setSearchQuery('')
      }
    } catch {
      // Geocoding inverso falhou — aceita pela bbox (não punir por falha de rede).
      setError(null)
      onChange(c)
    }
  }

  function pick(res: NominatimResult) {
    const c = { lat: parseFloat(res.lat), lng: parseFloat(res.lon) }
    onChange(c)
    onAddress?.(res.display_name)
    setResults([])
    setSelectedAddress(res.display_name)
    setSelectedEcoponto(null)
    setSelectedContentor(null)
    setSearchQuery('')
  }

  function usarLocalizacao() {
    setError(null)
    if (!('geolocation' in navigator)) {
      setError('Geolocalização não disponível neste dispositivo.')
      return
    }
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { void set({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoBusy(false) },
      () => { setError('Não foi possível obter a sua localização.'); setGeoBusy(false) },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {!onlyContentorSelection && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Procurar rua ou código postal (Aveiro)…"
              aria-label="Procurar morada"
              className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {results.length > 0 && (
              <ul className="absolute z-[1200] mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {results.map((r, i) => (
                  <li key={`${r.lat}-${r.lon}-${i}`}>
                    <button
                      type="button"
                      onClick={() => pick(r)}
                      className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted/50 flex items-start gap-2"
                    >
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{r.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={usarLocalizacao}
            disabled={geoBusy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/40 disabled:opacity-50"
          >
            {geoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
            A minha localização
          </button>
        </div>
      )}

      {error && <p role="alert" aria-live="polite" className="text-[11px] text-amber-600">{error}</p>}

          <div className="h-52 w-full rounded-lg overflow-hidden border border-border relative">
            {mapStyle && (
            <MapGL
              initialViewState={{
                longitude: value?.lng ?? AVEIRO_CENTER.lng,
                latitude: value?.lat ?? AVEIRO_CENTER.lat,
                zoom: value ? 16 : 13,
                pitch: 45,
              }}
              mapStyle={mapStyle}
              style={{ height: '100%', width: '100%' }}
          onClick={onlyContentorSelection ? undefined : (e) => void set({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
        >
          <FullscreenControl position="top-right" />
          <NavigationControl position="top-right" visualizePitch={true} />
          {/* Show ecopontos */}
          {!loadingEcopontos && ecopontos.map((eco) => (
            <MapLibreMarker
              key={eco.id}
              longitude={eco.lng}
              latitude={eco.lat}
              anchor="bottom"
            >
              <EcopontoPin
                contentores={eco.contentores}
                size={20}
                selected={value?.lat === eco.lat && value?.lng === eco.lng}
                selectedContentorIndex={
                  selectedEcoponto?.id === eco.id 
                    ? eco.contentores.findIndex(c => c.id === selectedContentor?.id)
                    : undefined
                }
                onContentorClick={(contentor) => {
                  const fullContentor = eco.contentores.find(c => 
                    c.id === contentor.id || 
                    (c.tipo === contentor.tipo && c.ocupacao === contentor.ocupacao)
                  ) || (contentor as unknown as ContentorRecord)
                  pickContentor(eco, fullContentor, contentor.index)
                }}
              />
            </MapLibreMarker>
          ))}
          {/* Selected location marker (only if not onlyContentorSelection) */}
          {!onlyContentorSelection && value && (
            <MapLibreMarker
              longitude={value.lng}
              latitude={value.lat}
              draggable
              onDragEnd={(e) => void set({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
              anchor="bottom"
            >
              <PinIcon />
            </MapLibreMarker>
            )}
          </MapGL>
            )}
            <MapStyleSwitcher mapType={mapType} onChange={setMapType} className="z-[1300]" />
          </div>

      {selectedAddress && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-lg">
          <MapPin className="w-4 h-4 text-[var(--primary)]" />
          <span className="text-sm text-foreground truncate">{selectedAddress}</span>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {onlyContentorSelection
          ? (value
              ? `Contentor selecionado: ${selectedAddress}`
              : 'Clique em um contentor de ecoponto no mapa para selecionar')
          : (value
              ? `Local selecionado (${value.lat.toFixed(5)}, ${value.lng.toFixed(5)})`
              : 'Clique em um ecoponto no mapa, pesquise uma morada ou use a sua localização.')}
      </p>
    </div>
  )
}
