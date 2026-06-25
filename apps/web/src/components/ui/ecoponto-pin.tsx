import React from 'react'

export const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

export const getTipoColor = (t: string) => {
  const norm = normalize(t)
  if (norm.includes('papel') || norm.includes('cartao')) return '#2563eb' // azul forte
  if (norm.includes('plastic') || norm.includes('embalagem') || norm.includes('metal')) return '#eab308' // amarelo forte
  if (norm.includes('vidro')) return '#16a34a' // verde forte
  if (norm.includes('organic') || norm.includes('biorresiduos')) return '#9a3412' // castanho forte
  return '#4b5563' // cinzento/indiferenciado por defeito
}

interface EcopontoPinProps {
  tipos?: string[]
  ocupacao?: number // 0 to 100
  contentores?: { tipo: string, ocupacao: number, id?: string }[]
  size?: number
  label?: number | string
  onClick?: (e: React.MouseEvent) => void
  onContentorClick?: (contentor: { tipo: string, ocupacao: number, id?: string, index: number }) => void
  selected?: boolean
  selectedContentorIndex?: number
  fallbackColor?: string
}

export function EcopontoPin({ tipos, ocupacao, contentores, size = 32, label, onClick, onContentorClick, selected, selectedContentorIndex, fallbackColor }: EcopontoPinProps) {
  // Parse bins logic
  let binsData: { tipo: string, ocupacao: number, id?: string }[] = []
  if (contentores && contentores.length > 0) {
    binsData = [...contentores]
  } else if (tipos && tipos.length > 0) {
    // Legacy support with fake offsets
    const offsets = [0, -15, 12, -8]
    binsData = tipos.map((t, i) => ({
      tipo: t,
      ocupacao: Math.min(Math.max((ocupacao || 0) + offsets[i % offsets.length], 0), 100)
    }))
  } else {
    binsData = [{ tipo: 'indiferenciado', ocupacao: ocupacao || 0 }]
  }

  // Sort into typical Ecoponto order (Papel -> Plástico -> Vidro -> Orgânico -> Indiferenciado)
  binsData.sort((a, b) => {
    const na = normalize(a.tipo)
    const nb = normalize(b.tipo)
    const getWeight = (t: string) => {
      if (t.includes('papel') || t.includes('cartao')) return 1
      if (t.includes('plastic') || t.includes('embalagem') || t.includes('metal')) return 2
      if (t.includes('vidro')) return 3
      if (t.includes('organic') || t.includes('biorresiduos')) return 4
      return 5
    }
    return getWeight(na) - getWeight(nb)
  })

  // We should NOT deduplicate here if the API allows multiple containers of the same type.
  // The user explicitly requested "ate que nao podemos ter 2 contentores amarelos no mesmo ecoponto".
  // Wait, the user said: "ate que nao podemos ter 2 contentores amarelos no mesmo ecoponto e o azul pode ter 20% o amarelo 30%"
  // It means: "It's even possible to have 2 yellow bins in the same ecoponto". "não podemos ter" in pt-pt context usually means "can't we have?", wait no, "ate que podemos ter" = "we can even have". "ate que nao podemos ter" is strange. Ah "ate que nao podemos ter..." it might be a typo for "ate porque podemos ter...". So we MUST NOT deduplicate!
  
  const binWidth = 16
  const binHeight = 28
  const gap = 4
  const totalWidth = binsData.length * binWidth + (binsData.length - 1) * gap
  const height = binHeight + 8

  const viewBoxWidth = totalWidth + 4 // 2px padding each side
  const viewBoxHeight = height + 10 // space for anchor

  // Compute overall status based on highest occupancy
  const maxOcupacao = binsData.length > 0 ? Math.max(...binsData.map(b => b.ocupacao)) : 0
  const fillPct = Math.min(Math.max(maxOcupacao, 0), 100)

  const getStatusColor = (pct: number) => {
    if (pct < 50) return '#22c55e' // Verde
    if (pct < 80) return '#f97316' // Laranja
    return '#ef4444' // Vermelho
  }
  const statusColor = getStatusColor(fillPct)

  return (
    <div 
      className="relative flex flex-col items-center justify-end"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        filter: selected ? 'drop-shadow(0px 0px 8px rgba(0,0,0,0.6))' : 'drop-shadow(0px 3px 4px rgba(0,0,0,0.3))',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        transformOrigin: 'bottom center',
        transition: 'transform 0.2s ease-in-out, filter 0.2s ease-in-out'
      }}
      onClick={onClick}
    >
      {/* Círculo a cintilar ao redor de todo o pin */}
      <div 
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '70px',
          height: '70px',
          bottom: '-15px', // Center relative to the pin
          border: `3px solid ${statusColor}`,
          boxShadow: `0 0 10px ${statusColor}`,
          animation: 'ping-ring 3s cubic-bezier(0.1, 0, 0.3, 1) infinite',
        }}
      />
      <style>{`
        @keyframes ping-ring {
          0% { transform: scale(0.6); opacity: 1; border-width: 4px; }
          100% { transform: scale(1.5); opacity: 0; border-width: 1px; }
        }
      `}</style>
      
      <svg
        width={viewBoxWidth * (size / 30)}
        height={viewBoxHeight * (size / 30)}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Anchor triangle */}
        <polygon
          points={`${viewBoxWidth / 2 - 5},${height - 1} ${viewBoxWidth / 2 + 5},${height - 1} ${viewBoxWidth / 2},${viewBoxHeight - 1}`}
          fill="#374151"
        />

        {binsData.map((b, i) => {
          const color = fallbackColor || getTipoColor(b.tipo)
          const x = 2 + i * (binWidth + gap)
          const y = 6
          
          const binPct = Math.min(Math.max(b.ocupacao, 0), 100)
          
          const fillH = (binPct / 100) * binHeight
          const emptyH = binHeight - fillH

          const isSelected = i === selectedContentorIndex

          return (
            <g key={i} 
               style={{ cursor: onContentorClick ? 'pointer' : 'default' }}
               onClick={(e) => {
                 e.stopPropagation()
                 onContentorClick?.({ ...b, index: i })
               }}
            >
              {/* Bin Body Background (Faded Color) */}
              <rect x={x} y={y} width={binWidth} height={binHeight} rx={3} fill={color} opacity={isSelected ? "0.3" : "0.15"} />
              
              {/* Bin Fill (Occupancy level) */}
              <clipPath id={`clip-${i}`}>
                <rect x={x} y={y} width={binWidth} height={binHeight} rx={3} />
              </clipPath>
              {/* Minimal fill height of 2px so even 0% shows a small bottom lip */}
              <rect 
                x={x} 
                y={y + emptyH - (binPct === 0 ? 2 : 0)} 
                width={binWidth} 
                height={fillH + (binPct === 0 ? 2 : 0)} 
                fill={color} 
                opacity={isSelected ? "1.0" : "1.0"} 
                clipPath={`url(#clip-${i})`}
              />
              
              {/* Bin Border (Strong Color) */}
              <rect x={x} y={y} width={binWidth} height={binHeight} rx={3} fill="none" stroke={color} strokeWidth={isSelected ? "4" : "2.5"} />
              
              {/* Bin Lid */}
              <rect x={x - 2} y={y - 3} width={binWidth + 4} height={3} rx={1.5} fill={color} />
              <rect x={x + 3} y={y - 5} width={binWidth - 6} height={2} rx={1} fill={color} />

              {/* Selection ring if selected */}
              {isSelected && (
                <circle 
                  cx={x + binWidth/2} 
                  cy={y + binHeight/2} 
                  r={binWidth/2 + 4} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth="2"
                />
              )}

              {/* Percentage text inside the bin */}
              <text 
                x={x + binWidth / 2} 
                y={y + binHeight / 2 + 2} 
                textAnchor="middle" 
                fill={binPct > 50 || isSelected ? "#ffffff" : "#4b5563"} 
                fontSize="6" 
                fontWeight="900" 
                fontFamily="sans-serif"
                style={{ textShadow: binPct > 50 || isSelected ? '0 1px 2px rgba(0,0,0,0.8)' : 'none' }}
              >
                {Math.round(binPct)}%
              </text>
            </g>
          )
        })}

        {/* Label Badge (ex: para Rotas / Números de paragem) */}
        {label !== undefined && (
          <g transform={`translate(${viewBoxWidth - 10}, 6)`}>
            <circle cx="0" cy="0" r="7" fill="#ef4444" stroke="white" strokeWidth="1.5" />
            <text x="0" y="3" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
              {label}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
