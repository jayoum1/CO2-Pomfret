'use client'

import type { RegrowthItem } from './VectorForestScene'
import { getScenarioCard } from '@/lib/vectorForest/scenarioCatalog'

export default function RegrowthInspectorPanel({
  item,
  age,
  onClose,
}: {
  item: RegrowthItem
  age: number
  onClose?: () => void
}) {
  const scenarioCard = getScenarioCard(item.scenarioId)

  return (
    <div className="flex flex-col h-full overflow-auto bg-white">
      <div className="p-4 border-b border-gray-200 flex items-start justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sapling Inspector</h2>
          <p className="text-xs text-gray-500 mt-0.5">Post-disturbance regrowth</p>
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
        {scenarioCard && (
          <p className="text-xs text-gray-500">
            Scenario: {scenarioCard.title}
          </p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Type</span>
            <span className="text-gray-900 font-medium">Sapling</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Approx. age</span>
            <span className="text-gray-900 font-medium">{Math.max(0, age)} year{age !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Appeared at year</span>
            <span className="text-gray-900">{item.spawnYear}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Origin</span>
            <span className="text-gray-900 capitalize">{item.scenarioId.replace(/_/g, ' ')} recovery</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 leading-relaxed">
            Young regrowth appearing after the disturbance. As years pass, the sapling grows taller as the forest ecosystem slowly recovers.
          </p>
        </div>
      </div>
    </div>
  )
}
