import { Marker as MapLibreMarker } from 'react-map-gl/maplibre'
import type { ReactNode } from 'react'
import { EcopontoPin } from '@/components/ui/ecoponto-pin'

interface RotaStopMarkerProps {
  longitude: number
  latitude: number
  /** Nº da ordem de visita (badge no pin). */
  label: number
  ocupacao?: number
  contentores?: { tipo: string; ocupacao: number }[]
  /** Cor de recurso quando a paragem não tem contentores (rotas de seed). */
  fallbackColor?: string
  anchor?: 'bottom' | 'center'
  /** Conteúdo do tooltip (hover). */
  children?: ReactNode
}

/**
 * Marker de paragem de rota. Reusa o mesmo `EcopontoPin` do mapa (caixas
 * coloridas por contentor + anel de estado) e acrescenta o nº da ordem de visita.
 * Sem contentores (rotas de seed), cai no pin "indiferenciado" cinzento.
 */
export function RotaStopMarker({
  longitude,
  latitude,
  label,
  ocupacao,
  contentores,
  fallbackColor,
  anchor = 'bottom',
  children,
}: RotaStopMarkerProps) {
  const temContentores = !!contentores && contentores.length > 0
  return (
    <MapLibreMarker longitude={longitude} latitude={latitude} anchor={anchor}>
      <div className="relative group cursor-pointer">
        <EcopontoPin
          contentores={temContentores ? contentores : undefined}
          tipos={temContentores ? undefined : ['indiferenciado']}
          ocupacao={ocupacao ?? 0}
          size={36}
          label={label}
          fallbackColor={temContentores ? undefined : fallbackColor}
        />
        {children && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-max max-w-xs bg-popover text-popover-foreground text-xs rounded shadow-md border border-border p-2">
            {children}
          </div>
        )}
      </div>
    </MapLibreMarker>
  )
}
