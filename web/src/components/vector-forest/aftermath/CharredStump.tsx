export default function CharredStump({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className} style={style}>
      <ellipse cx="40" cy="88" rx="20" ry="6" fill="rgba(0,0,0,0.12)" />
      <path d="M24 80 L28 30 C29 22, 35 18, 41 18 C47 18, 53 22, 54 30 L58 80 Z" fill="#2d2a29" />
      <ellipse cx="41" cy="28" rx="13" ry="6" fill="#47413d" />
      <path d="M32 27 C36 24, 45 24, 49 27" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
    </svg>
  )
}
