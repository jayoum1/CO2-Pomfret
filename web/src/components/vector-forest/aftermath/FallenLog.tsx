export default function FallenLog({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 180 70" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className} style={style}>
      <ellipse cx="90" cy="56" rx="62" ry="7" fill="rgba(0,0,0,0.10)" />
      <rect x="25" y="28" width="110" height="20" rx="10" fill="#6a4b33" />
      <ellipse cx="135" cy="38" rx="16" ry="10" fill="#8b6545" />
      <ellipse cx="135" cy="38" rx="8" ry="5" fill="none" stroke="rgba(70,45,30,0.45)" strokeWidth="2" />
      <path d="M34 36 C55 32, 79 32, 112 35" stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
