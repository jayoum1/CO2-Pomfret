'use client'

import { useState } from 'react'
import type { ScenarioCard } from '@/lib/vectorForest/scenarioCatalog'

export default function ScenarioCarousel({
  card,
  startYear,
  onStartYearChange,
  onPrev,
  onNext,
  onReset,
}: {
  card: ScenarioCard
  startYear: number
  onStartYearChange: (year: number) => void
  onPrev: () => void
  onNext: () => void
  onReset?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isDisturbance = card.id !== 'baseline'

  if (!isExpanded) {
    return (
      <button
        type="button"
        data-ui-overlay="true"
        onClick={() => setIsExpanded(true)}
        aria-label="Open scenario selector"
        className="absolute left-0 top-0 m-3 z-[250] px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] dark:border-[var(--border-strong)] text-[var(--text)] shadow-[var(--shadow-soft)] pointer-events-auto transition-colors"
      >
        Scenario
      </button>
    )
  }

  return (
    <div
      data-ui-overlay="true"
      className="absolute left-0 top-0 m-3 w-64 rounded-xl border border-[var(--border)] dark:border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-soft)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-[250] overflow-hidden pointer-events-auto"
    >
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-[var(--text)] truncate">{card.title}</h3>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Close scenario selector"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous scenario"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next scenario"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="aspect-video rounded-lg bg-[var(--surface-2)] overflow-hidden mb-2">
          <img
            src={card.imageSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              const el = e.currentTarget
              el.style.display = 'none'
              if (!el.nextElementSibling) {
                const fallback = document.createElement('div')
                fallback.className = 'w-full h-full flex items-center justify-center text-gray-500 text-xs'
                fallback.textContent = 'No image'
                el.parentElement?.appendChild(fallback)
              }
            }}
          />
        </div>
        {isDisturbance && (
          <div className="mb-2">
            <label className="text-xs text-[var(--text-muted)]">Start year</label>
            <div className="flex items-center gap-2 mt-0.5">
              <input
                type="range"
                min={0}
                max={25}
                value={startYear}
                onChange={(e) => onStartYearChange(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: 'var(--primary)' }}
              />
              <span className="text-sm font-medium text-[var(--text)] w-7 tabular-nums">{startYear}</span>
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--text-muted)] line-clamp-2">{card.description}</p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="mt-2 w-full py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
          >
            Reset scenario
          </button>
        )}
      </div>
    </div>
  )
}
