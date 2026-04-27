'use client'

import type { TreeInstance, TreeState } from '@/lib/vectorForest/treeModel'
import TreeSpeciesImages from './TreeSpeciesImages'

const CO2E_FACTOR = 3.667

function treeStatusLabel(state: TreeState): string {
  if (state.burning) return 'Burning'
  if (state.charred) return state.alive ? 'Charred' : 'Charred (dead)'
  if (!state.alive) return 'Dead'
  if (state.health < 0.6) return 'Stressed'
  return 'Healthy'
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function TreeInspectorPanel({
  tree,
  state,
  year,
  onClose,
}: {
  tree: TreeInstance
  state: TreeState
  year: number
  onClose?: () => void
}) {
  const co2eKg = Math.round(state.carbonKgC * CO2E_FACTOR)
  const statusLabel = treeStatusLabel(state)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--surface)]">
      <div className="p-3 border-b border-[var(--border)] flex items-start justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Tree Inspector</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-3 pb-3 pt-2 flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto">
        <div className="space-y-1 text-sm shrink-0">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Tree ID</span>
            <span className="text-[var(--text)] font-mono">{tree.id}</span>
          </div>
          {tree.plot && (
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-muted)]">Plot</span>
              <span className="text-[var(--text)]">{tree.plot}</span>
            </div>
          )}
          {tree.speciesName && (
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-muted)]">Species</span>
              <span className="text-[var(--text)]">{capitalize(tree.speciesName)}</span>
            </div>
          )}
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
            <span className="text-[var(--text-muted)]">Health</span>
            <span className="text-[var(--text)]">{Math.round(state.health * 100)}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-muted)]">Status</span>
            <span className="text-[var(--text)]">{statusLabel}</span>
          </div>
        </div>

        <TreeSpeciesImages
          speciesKey={tree.speciesKey}
          className="mt-1 pt-1.5 border-t border-[var(--border)] flex-1 min-h-0 flex flex-col"
        />
      </div>
    </div>
  )
}
