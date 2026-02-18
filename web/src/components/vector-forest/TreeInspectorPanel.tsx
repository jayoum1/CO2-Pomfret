'use client'

import type { TreeInstance, TreeState } from '@/lib/vectorForest/treeModel'
import APESMiniDiagram from './APESMiniDiagram'

const CO2E_FACTOR = 3.667

export default function TreeInspectorPanel({
  tree,
  state,
  year,
  onClose,
  scenarioId,
}: {
  tree: TreeInstance
  state: TreeState
  year: number
  onClose?: () => void
  scenarioId?: 'baseline' | 'invasive_outbreak'
}) {
  const co2eKg = Math.round(state.carbonKgC * CO2E_FACTOR)

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 border-b border-[var(--border)] flex items-start justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Tree Inspector</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Demo forest (illustrative)</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-alt)] transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 flex-1 min-h-0">
        {scenarioId && scenarioId !== 'baseline' && (
          <p className="text-xs text-[var(--text-muted)]">
            Showing scenario: {scenarioId === 'invasive_outbreak' ? 'Invasive Outbreak' : scenarioId}
          </p>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Tree</span>
            <span className="text-[var(--text)] font-mono">{tree.id}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Year</span>
            <span className="text-[var(--text)] font-medium">{year}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">DBH</span>
            <span className="text-[var(--text)]">{state.dbh.toFixed(1)} cm</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Carbon stored</span>
            <span className="text-[var(--text)]">{Math.round(state.carbonKgC)} kg C</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">CO₂ equivalent</span>
            <span className="text-[var(--text)]">{co2eKg} kg CO₂e</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Growth rate</span>
            <span className="text-[var(--text)]">{tree.growthRate.toFixed(2)} cm/year</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Health</span>
            <span className="text-[var(--text)]">{Math.round(state.health * 100)}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Alive</span>
            <span className="text-[var(--text)]">{state.alive ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <APESMiniDiagram className="mt-4 pt-4 border-t border-[var(--border)]" />
      </div>
    </div>
  )
}
