export default function WaterPool({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 180 70" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className} style={style}>
      <path d="M14 44 C30 26, 62 20, 96 28 C124 16, 154 20, 168 40 C160 54, 132 59, 94 58 C54 59, 26 56, 14 44 Z" fill="#74a9d8" />
      <path d="M26 40 C44 31, 67 30, 94 34 C118 28, 140 31, 154 39" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
