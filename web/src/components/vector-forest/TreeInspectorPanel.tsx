'use client'

import type { TreeInstance, TreeState } from '@/lib/vectorForest/treeModel'
import type { ScenarioId } from '@/lib/vectorForest/scenarioCatalog'
import { getScenarioCard } from '@/lib/vectorForest/scenarioCatalog'
import TreeSpeciesImages from './TreeSpeciesImages'

const CO2E_FACTOR = 3.667

function treeStatusLabel(state: TreeState): string {
  if (state.burning) return 'Burning'
  if (state.charred) return state.alive ? 'Charred' : 'Charred (dead)'
  if (!state.alive) return 'Dead'
  if (state.health < 0.6) return 'Stressed'
  return 'Healthy'
}

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
  scenarioId?: ScenarioId
}) {
  const co2eKg = Math.round(state.carbonKgC * CO2E_FACTOR)
  const scenarioCard = scenarioId ? getScenarioCard(scenarioId) : null
  const statusLabel = treeStatusLabel(state)

  return (
    <div className="flex flex-col h-full overflow-auto bg-white">
      <div className="p-4 border-b border-gray-200 flex items-start justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Tree Inspector</h2>
          <p className="text-xs text-gray-500 mt-0.5">Demo forest (illustrative)</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 flex-1 min-h-0">
        {scenarioCard && scenarioId !== 'baseline' && (
          <p className="text-xs text-gray-500">
            Scenario: {scenarioCard.title}
          </p>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Tree</span>
            <span className="text-gray-900 font-mono">{tree.id}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Year</span>
            <span className="text-gray-900 font-medium">{year}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">DBH</span>
            <span className="text-gray-900">{state.dbh.toFixed(1)} cm</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Carbon stored</span>
            <span className="text-gray-900">{Math.round(state.carbonKgC)} kg C</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">CO₂ equivalent</span>
            <span className="text-gray-900">{co2eKg} kg CO₂e</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Growth rate</span>
            <span className="text-gray-900">{tree.growthRate.toFixed(2)} cm/year</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Health</span>
            <span className="text-gray-900">{Math.round(state.health * 100)}%</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Status</span>
            <span className="text-gray-900">{statusLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Alive</span>
            <span className="text-gray-900">{state.alive ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <TreeSpeciesImages
          speciesKey={tree.speciesKey}
          className="mt-4 pt-4 border-t border-gray-200"
        />
      </div>
    </div>
  )
}
