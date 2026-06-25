import MapGL, {
  NavigationControl,
  FullscreenControl,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ReactNode } from 'react'
import { AVEIRO_CENTER } from '@/lib/geo/aveiro'
import { useMapStyle } from '@/lib/geo/use-map-style'
import { MapStyleSwitcher } from '@/components/map-style-switcher'

interface MapaProps {
  /** Classes do wrapper (define altura, borda, etc.). */
  className?: string
  /** Centro inicial. Default: centro de Aveiro. */
  center?: { lat: number; lng: number }
  /** Zoom inicial. Default 14. */
  zoom?: number
  /** Pitch (3D). Default 45. */
  pitch?: number
  /** Ativa o relevo (terrainSource + terrain). Default true. */
  terrain?: boolean
  onClick?: (e: MapLayerMouseEvent) => void
  /** Acesso ao mapa (ex.: flyTo). */
  onMapRef?: (map: MapRef | null) => void
  /** Classe extra para o seletor de estilo. */
  switcherClassName?: string
  children?: ReactNode
}

/**
 * Mapa base partilhado (MapGL + relevo + controlos + seletor de estilo).
 * Os markers / `Source` / `Layer` específicos de cada vista entram como children.
 */
export function Mapa({
  className,
  center = AVEIRO_CENTER,
  zoom = 14,
  pitch = 45,
  terrain = true,
  onClick,
  onMapRef,
  switcherClassName,
  children,
}: MapaProps) {
  const { mapStyle, mapType, setMapType } = useMapStyle()

  return (
    <div className={className ?? 'h-[560px] min-h-[420px] w-full rounded-xl overflow-hidden border border-border shadow-sm relative'}>
      {mapStyle && (
        <MapGL
          initialViewState={{
            longitude: center.lng,
            latitude: center.lat,
            zoom,
            pitch,
          }}
          mapStyle={mapStyle}
          terrain={terrain ? { source: 'terrainSource', exaggeration: 1.5 } : undefined}
          style={{ width: '100%', height: '100%' }}
          onClick={onClick}
          ref={onMapRef}
        >
          <FullscreenControl position="top-right" />
          <NavigationControl position="top-right" visualizePitch={true} />
          {terrain && (
            <Source
              id="terrainSource"
              type="raster-dem"
              url="https://demotiles.maplibre.org/terrain-tiles/tiles.json"
              tileSize={256}
            />
          )}
          {children}
        </MapGL>
      )}
      <MapStyleSwitcher mapType={mapType} onChange={setMapType} className={switcherClassName} />
    </div>
  )
}
