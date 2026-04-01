/**
 * Parameterized sapling SVG. Growth is driven by internal geometry changes:
 * stem gets taller/thicker, leaves shift upward and grow slightly.
 * growthProgress 0 = tiny seedling, 1 = tall young sapling (never a mature tree).
 */
export default function Sapling({
  growthProgress = 0,
  className,
  style,
}: {
  growthProgress?: number
  className?: string
  style?: React.CSSProperties
}) {
  const t = Math.min(1, Math.max(0, growthProgress))

  const baseY = 108
  const stemMinH = 16
  const stemMaxH = 56
  const stemHeight = stemMinH + t * (stemMaxH - stemMinH)
  const stemTop = baseY - stemHeight

  const stemMinW = 3
  const stemMaxW = 5.5
  const stemWidth = stemMinW + t * (stemMaxW - stemMinW)

  const leafBaseScale = 0.55
  const leafMaxScale = 1.05
  const leafScale = leafBaseScale + t * (leafMaxScale - leafBaseScale)
  const leafCenterY = stemTop + stemHeight * 0.25

  return (
    <svg
      viewBox="0 0 80 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      style={style}
    >
      <ellipse cx="40" cy={baseY} rx="16" ry="5" fill="rgba(0,0,0,0.10)" />

      <line
        x1={40}
        y1={baseY - 6}
        x2={40}
        y2={stemTop}
        stroke="#5a3f2a"
        strokeWidth={stemWidth}
        strokeLinecap="round"
      />

      <g
        transform={`translate(40, ${leafCenterY}) scale(${leafScale})`}
        style={{ transition: 'transform 600ms ease' }}
      >
        <path
          d="M0 8 C-12 2, -18 -8, -15 -18 C-4 -17, 3 -8, 0 8 Z"
          fill="#587d43"
        />
        <path
          d="M0 0 C12 -6, 20 -16, 18 -25 C6 -23, -1 -15, 0 0 Z"
          fill="#6c9550"
        />
      </g>
    </svg>
  )
}
