export default function Sapling({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className} style={style}>
      <ellipse cx="40" cy="108" rx="16" ry="5" fill="rgba(0,0,0,0.10)" />
      <path d="M40 102 L40 54" stroke="#5a3f2a" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 74 C28 68, 22 58, 25 48 C36 49, 43 58, 40 74 Z" fill="#587d43" />
      <path d="M40 66 C52 60, 60 50, 58 41 C46 43, 39 51, 40 66 Z" fill="#6c9550" />
    </svg>
  )
}
