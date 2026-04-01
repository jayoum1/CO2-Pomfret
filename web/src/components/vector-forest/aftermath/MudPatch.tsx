export default function MudPatch({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className} style={style}>
      <path d="M8 39 C21 24, 47 20, 75 27 C100 18, 133 20, 151 37 C142 51, 115 56, 79 54 C41 56, 18 50, 8 39 Z" fill="#6f5a49" />
      <path d="M22 40 C38 33, 56 31, 74 35 C94 30, 116 31, 135 39" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
