import React from 'react'

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const getTipoColor = (t: string) => {
  const norm = normalize(t)
  if (norm.includes('papel') || norm.includes('cartao')) return '#2563eb' // azul forte
  if (norm.includes('plastic') || norm.includes('embalagem') || norm.includes('metal')) return '#eab308' // amarelo forte
  if (norm.includes('vidro')) return '#16a34a' // verde forte
  if (norm.includes('organic') || norm.includes('biorresiduos')) return '#9a3412' // castanho forte
  return '#4b5563' // cinzento/indiferenciado por defeito
}

interface EcopontoPinProps {
  tipos: string[]
  ocupacao: number // 0 to 100
  size?: number
  label?: number | string
  onClick?: (e: React.MouseEvent) => void
  selected?: boolean
  fallbackColor?: string
}

export function EcopontoPin({ tipos, ocupacao, size = 32, label, onClick, selected, fallbackColor }: EcopontoPinProps) {
  // Evitar crash se tipos não vier ou for vazio
  const bins = (tipos && tipos.length > 0) ? tipos : ['indiferenciado']
  
  const binWidth = 16
  const binHeight = 28
  const gap = 4
  const totalWidth = bins.length * binWidth + (bins.length - 1) * gap
  const height = binHeight + 8

  const viewBoxWidth = totalWidth + 4 // 2px padding each side
  const viewBoxHeight = height + 10 // space for anchor

  // Limit ocupacao between 0 and 100
  const fillPct = Math.min(Math.max(ocupacao, 0), 100)

  return (
    <svg
      width={viewBoxWidth * (size / 30)}
      height={viewBoxHeight * (size / 30)}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        filter: selected ? 'drop-shadow(0px 0px 8px rgba(0,0,0,0.6))' : 'drop-shadow(0px 3px 4px rgba(0,0,0,0.3))',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        transformOrigin: 'bottom center',
        transition: 'transform 0.2s ease-in-out, filter 0.2s ease-in-out'
      }}
      onClick={onClick}
    >
      {/* Anchor triangle */}
      <polygon
        points={`${viewBoxWidth / 2 - 5},${height - 1} ${viewBoxWidth / 2 + 5},${height - 1} ${viewBoxWidth / 2},${viewBoxHeight - 1}`}
        fill="#374151"
      />

      {bins.map((t, i) => {
        const color = fallbackColor || getTipoColor(t)
        const x = 2 + i * (binWidth + gap)
        const y = 6
        
        const fillH = (fillPct / 100) * binHeight
        const emptyH = binHeight - fillH

        return (
          <g key={i}>
            {/* Bin Body Background (Faded Color) */}
            <rect x={x} y={y} width={binWidth} height={binHeight} rx={3} fill={color} opacity="0.15" />
            
            {/* Bin Fill (Occupancy level) */}
            <clipPath id={`clip-${i}`}>
              <rect x={x} y={y} width={binWidth} height={binHeight} rx={3} />
            </clipPath>
            {/* Minimal fill height of 2px so even 0% shows a small bottom lip */}
            <rect 
              x={x} 
              y={y + emptyH - (fillPct === 0 ? 2 : 0)} 
              width={binWidth} 
              height={fillH + (fillPct === 0 ? 2 : 0)} 
              fill={color} 
              opacity="1.0" 
              clipPath={`url(#clip-${i})`}
            />
            
            {/* Bin Border (Strong Color) */}
            <rect x={x} y={y} width={binWidth} height={binHeight} rx={3} fill="none" stroke={color} strokeWidth="2.5" />
            
            {/* Bin Lid */}
            <rect x={x - 2} y={y - 3} width={binWidth + 4} height={3} rx={1.5} fill={color} />
            <rect x={x + 3} y={y - 5} width={binWidth - 6} height={2} rx={1} fill={color} />
          </g>
        )
      })}

      {/* Label Badge */}
      {label !== undefined && (
        <g transform={`translate(${viewBoxWidth - 10}, 6)`}>
          <circle cx="0" cy="0" r="7" fill="#ef4444" stroke="white" strokeWidth="1.5" />
          <text x="0" y="3" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
            {label}
          </text>
        </g>
      )}
    </svg>
  )
}
