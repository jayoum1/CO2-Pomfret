'use client'

export interface TreeSVGProps {
  trunkWidthPx: number
  trunkHeightPx: number
  canopyScale: number
  canopyYPx: number
  hue?: number
  saturation?: string
  lightness?: string
  alpha?: number
  stroke?: string
  className?: string
}

export default function TreeSVG({
  trunkWidthPx,
  trunkHeightPx,
  canopyScale,
  canopyYPx,
  hue = 120,
  saturation = '28%',
  lightness = '34%',
  alpha = 1,
  stroke = 'rgba(10, 20, 15, 0.35)',
  className = ''
}: TreeSVGProps) {
  const trunkX = -trunkWidthPx / 2
  const trunkY = -trunkHeightPx
  const transition = 'all 0.7s ease-out'

  return (
    <svg
      viewBox="0 0 120 160"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      style={
        {
          pointerEvents: 'none',
          '--trunkW': `${trunkWidthPx}px`,
          '--trunkH': `${trunkHeightPx}px`,
          '--canopyScale': canopyScale,
          '--canopyY': `${canopyYPx}px`,
          '--hue': hue,
          '--sat': saturation,
          '--light': lightness,
          '--alpha': alpha,
          '--stroke': stroke,
        } as React.CSSProperties
      }
    >
      {/* subtle shadow */}
      <ellipse cx="60" cy="146" rx="28" ry="8" fill="rgba(0,0,0,0.10)" />

      {/* trunk - geometry in style so CSS transition animates growth */}
      <g transform="translate(60, 130)" opacity={alpha} style={{ transition }}>
        <rect
          x={trunkX}
          y={trunkY}
          width={trunkWidthPx}
          height={trunkHeightPx}
          style={{
            transition,
            // Duplicate geometry in style so transitions apply (attributes don't animate)
            width: trunkWidthPx,
            height: trunkHeightPx,
            x: trunkX,
            y: trunkY,
          }}
          rx={4}
          fill="hsl(28 22% 26%)"
          stroke={stroke}
          strokeWidth="1"
        />
        {/* small branch hint */}
        <path
          d="M -2 -30 C -18 -36, -22 -48, -10 -54"
          fill="none"
          stroke="rgba(40, 25, 18, 0.45)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* canopy */}
      <g
        transform={`translate(60, ${canopyYPx}) scale(${canopyScale})`}
        opacity={alpha}
        style={{ transition }}
      >
        {/* canopy blob (clean, slightly organic) */}
        <path
          d="M 0 -34
         C 18 -42, 38 -28, 36 -6
         C 44 10, 28 30, 4 28
         C -6 40, -34 34, -36 10
         C -46 -10, -32 -34, 0 -34 Z"
          fill={`hsl(${hue} ${saturation} ${lightness})`}
          stroke={stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* tiny highlight */}
        <path
          d="M -18 -14 C -10 -26, 6 -28, 16 -20"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}
