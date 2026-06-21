import { Layers, Check } from 'lucide-react'
import { MAP_TYPES, type MapType } from '@/lib/geo/use-map-style'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MapStyleSwitcherProps {
  mapType: MapType
  onChange: (type: MapType) => void
  className?: string
}

export function MapStyleSwitcher({ mapType, onChange, className = '' }: MapStyleSwitcherProps) {
  return (
    <div className={`absolute bottom-6 left-2 z-[5] ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/90 backdrop-blur-sm border border-border shadow-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Estilo do Mapa"
            onClick={(e) => e.stopPropagation()}
          >
            <Layers className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-40 z-10">
          {MAP_TYPES.map((t) => (
            <DropdownMenuItem
              key={t.value}
              onClick={(e) => {
                e.stopPropagation()
                onChange(t.value)
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              {t.label}
              {mapType === t.value && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
