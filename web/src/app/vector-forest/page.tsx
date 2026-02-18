'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import VectorForestScene from '@/components/vector-forest/VectorForestScene'
import TreeInspectorPanel from '@/components/vector-forest/TreeInspectorPanel'
import VectorForestScenarioOverlay from '@/components/vector-forest/VectorForestScenarioOverlay'
import type { TreeSelection, TreeMeta } from '@/components/vector-forest/VectorForestScene'
import {
  defaultInvasiveOutbreakConfig,
  randomizeOutbreakCenter,
  type ScenarioConfig,
  type InvasiveOutbreakConfig,
} from '@/lib/vectorForest/scenarios'

const SCENARIO_SEED = 42

export default function VectorForestPage() {
  const [year, setYear] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [selection, setSelection] = useState<TreeSelection>(null)
  const [scenarioId, setScenarioId] = useState<'baseline' | 'invasive_outbreak'>('baseline')
  const [invasiveConfig, setInvasiveConfig] = useState<InvasiveOutbreakConfig>(() =>
    defaultInvasiveOutbreakConfig(SCENARIO_SEED)
  )
  const [metaById, setMetaById] = useState<Record<string, TreeMeta>>({})
  const [stats, setStats] = useState({
    baselineCarbon: 0,
    baselineAlive: 0,
    scenarioCarbon: 0,
    scenarioAlive: 0,
  })
  const containerRef = useRef<HTMLDivElement>(null)

  const scenarioConfig: ScenarioConfig =
    scenarioId === 'baseline' ? { id: 'baseline' } : invasiveConfig

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      if (el) {
        setDimensions({
          width: el.clientWidth || 800,
          height: Math.min(600, Math.max(400, el.clientHeight || 500)),
        })
      }
    }

    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelection(null)
  }, [])

  const handleRecordDeath = useCallback((treeId: string, deathYear: number, fallDir: number) => {
    setMetaById((prev) => ({ ...prev, [treeId]: { deathYear, fallDir } }))
  }, [])

  const handleResetScenario = useCallback(() => {
    setMetaById({})
  }, [])

  const handleNewOutbreakLocation = useCallback(() => {
    setInvasiveConfig((c) => randomizeOutbreakCenter(c))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Vector Forest</h1>
        <p className="text-[var(--text-muted)]">
          Animated forest growth visualization. Drag the Year slider to see trees grow over time.
        </p>
      </div>

      <div className="relative card p-0 overflow-hidden">
        <div ref={containerRef} className="w-full h-[500px]" style={{ touchAction: 'none' }}>
          <VectorForestScene
            year={year}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            selectedTreeId={selection?.treeId ?? null}
            onSelectionChange={setSelection}
            scenarioConfig={scenarioConfig}
            metaById={metaById}
            onRecordDeath={handleRecordDeath}
            onStatsChange={setStats}
          />
        </div>
        <div
          data-ui-overlay="true"
          className="flex items-center gap-4 p-4 bg-[var(--bg-alt)] border-t border-[var(--border)] rounded-b-lg pointer-events-auto"
        >
          <label className="text-sm font-medium text-[var(--text)] shrink-0">
            Year: <span className="text-[var(--primary)] font-semibold">{year}</span>
          </label>
          <input
            type="range"
            min={0}
            max={30}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="flex-1 min-w-0 max-w-md"
            style={{ accentColor: 'var(--primary)' }}
          />
          <span className="text-xs text-[var(--text-muted)] shrink-0">0 → 30 years</span>
        </div>

        <div data-ui-overlay="true" className="pointer-events-auto">
          <VectorForestScenarioOverlay
          year={year}
          scenarioId={scenarioId}
          onScenarioIdChange={setScenarioId}
          invasiveConfig={invasiveConfig}
          onInvasiveConfigChange={setInvasiveConfig}
          onResetScenario={handleResetScenario}
          onNewOutbreakLocation={handleNewOutbreakLocation}
          stats={stats}
        />
        </div>

        {selection && (
          <div
            data-ui-overlay="true"
            className="absolute right-0 top-0 w-full sm:w-[360px] max-w-full h-full min-h-[500px] rounded-l-lg shadow-lg z-10 flex flex-col bg-[var(--bg)]/98 backdrop-blur-sm border-l border-[var(--border)] pointer-events-auto"
          >
            <TreeInspectorPanel
              tree={selection.tree}
              state={selection.state}
              year={year}
              onClose={handleClosePanel}
              scenarioId={scenarioId}
            />
          </div>
        )}
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Each tree has a base DBH and growth rate (mock data). Later: hook in real baseline growth model and disturbance effects.
      </p>
    </div>
  )
}
