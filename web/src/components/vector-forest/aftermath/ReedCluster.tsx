export default function ReedCluster({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className} style={style}>
      <path d="M24 108 C26 82, 28 60, 30 38" stroke="#5d7e42" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 108 C39 84, 41 62, 42 28" stroke="#6a8e49" strokeWidth="3" strokeLinecap="round" />
      <path d="M52 108 C52 87, 54 67, 57 45" stroke="#58743e" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 38 C22 34, 18 29, 18 22" stroke="#5d7e42" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M42 28 C50 24, 55 18, 56 10" stroke="#6a8e49" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M57 45 C64 40, 69 34, 71 27" stroke="#58743e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
