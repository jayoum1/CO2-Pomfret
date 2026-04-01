export default function BurntGroundPatch({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className} style={style}>
      <path d="M10 40 C25 20, 50 18, 75 28 C98 12, 130 15, 150 35 C145 50, 115 56, 80 54 C45 57, 20 52, 10 40 Z" fill="#2f2a28" />
      <path d="M22 39 C35 27, 58 25, 74 31 C94 23, 119 24, 137 36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
