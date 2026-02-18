'use client'

/**
 * Lightweight APES-style explainer: tree diagram with callout labels
 * for CO₂ → sugars, carbon stored as wood, carbon to soil.
 */
export default function APESMiniDiagram({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Carbon flow (simplified)</p>
      <svg
        viewBox="0 0 100 120"
        className="w-full max-w-[140px] mx-auto block"
        aria-hidden
      >
        {/* Soil / roots zone */}
        <rect x="10" y="92" width="80" height="20" rx="2" fill="hsl(28 25% 35%)" />
        <text x="50" y="105" textAnchor="middle" style={{ fontSize: 8, fill: 'var(--text)' }}>
          Carbon to soil
        </text>

        {/* Trunk */}
        <rect x="42" y="42" width="16" height="50" rx="2" fill="hsl(28 22% 26%)" />
        <text x="50" y="72" textAnchor="middle" style={{ fontSize: 8, fill: 'var(--text)' }}>
          Carbon stored as wood
        </text>

        {/* Canopy blob */}
        <ellipse cx="50" cy="28" rx="22" ry="18" fill="hsl(120 28% 34%)" />
        <text x="50" y="28" textAnchor="middle" style={{ fontSize: 7, fill: 'white' }}>
          CO₂ in → sugars
        </text>
      </svg>
    </div>
  )
}
