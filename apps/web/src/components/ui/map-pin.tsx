import React from 'react'

interface MarkerPinProps {
  color?: string
  size?: number
  label?: string | number
  onClick?: (e: React.MouseEvent) => void
}

export function MarkerPin({ color = '#10b981', size = 24, label, onClick }: MarkerPinProps) {
  // Convert size to internal radius logic to maintain proportion
  const r = size / 2

  return (
    <svg
      width={r * 2 + 4}
      height={r * 2 + 10}
      viewBox={`0 0 ${r * 2 + 4} ${r * 2 + 10}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ cursor: onClick ? 'pointer' : 'default', filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' }}
      onClick={onClick}
    >
      <circle cx={r + 2} cy={r + 2} r={r} fill="white" stroke={color} strokeWidth="2" />
      {label ? (
        <text
          x={r + 2}
          y={r + 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={r * 1.1}
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          {label}
        </text>
      ) : (
        <circle cx={r + 2} cy={r + 2} r={r * 0.55} fill={color} />
      )}
      <polygon points={`${r + 2},${r * 2 + 10} ${r - 4},${r * 2 - 2} ${r + 8},${r * 2 - 2}`} fill={color} />
    </svg>
  )
}
