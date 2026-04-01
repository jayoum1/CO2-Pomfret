'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import VectorForestScene from '@/components/vector-forest/VectorForestScene'
import TreeInspectorPanel from '@/components/vector-forest/TreeInspectorPanel'
import RegrowthInspectorPanel from '@/components/vector-forest/RegrowthInspectorPanel'
import type { TreeSelection, TreeMeta } from '@/components/vector-forest/VectorForestScene'
import { getScenarioConfig, getScenarioTiming, applyScenario } from '@/lib/vectorForest/scenarios'
import { getTreeState } from '@/lib/vectorForest/treeModel'
import {
  getScenarioCard,
  getPrevScenarioId,
  getNextScenarioId,
  type ScenarioId,
} from '@/lib/vectorForest/scenarioCatalog'

const SCENARIO_SEED = 42

export default function VectorForestPage() {
  const [year, setYear] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [selection, setSelection] = useState<TreeSelection>(null)
  const [scenarioId, setScenarioId] = useState<ScenarioId>('emerald_ash_borer')
  const [scenarioStartYear, setScenarioStartYear] = useState(() => getScenarioTiming('emerald_ash_borer').startYear)
  const [metaById, setMetaById] = useState<Record<string, TreeMeta>>({})
  const [stats, setStats] = useState({
    baselineCarbon: 0,
    baselineAlive: 0,
    scenarioCarbon: 0,
    scenarioAlive: 0,
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const scenarioCard = getScenarioCard(scenarioId)
  const scenarioConfig = useMemo(
    () => getScenarioConfig(scenarioId, SCENARIO_SEED, scenarioStartYear),
    [scenarioId, scenarioStartYear]
  )

  useEffect(() => {
    setScenarioStartYear(getScenarioTiming(scenarioId).startYear)
  }, [scenarioId])

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
    setYear(0)
    setMetaById({})
    setSelection(null)
  }, [])

  const handleScenarioPrev = useCallback(
    () => setScenarioId((cur) => getPrevScenarioId(cur)),
    []
  )
  const handleScenarioNext = useCallback(
    () => setScenarioId((cur) => getNextScenarioId(cur)),
    []
  )

  const inspectorState = useMemo(() => {
    if (!selection || selection.kind !== 'tree') return null
    const base = getTreeState(selection.tree, year)
    return applyScenario(base, selection.tree, year, scenarioConfig)
  }, [selection, year, scenarioConfig])

  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(document.fullscreenElement === fullscreenRef.current)
  }, [])

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [handleFullscreenChange])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          setSelection(null)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = fullscreenRef.current
    if (!el) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Vector Forest</h1>
        <p className="text-[var(--text-muted)]">
          Animated forest growth visualization. Drag the Year slider to see trees grow over time.
        </p>
      </div>

      <div
        ref={fullscreenRef}
        className={`relative card p-0 overflow-hidden flex flex-col ${isFullscreen ? 'h-screen min-h-0' : ''}`}
      >
        <div
          ref={containerRef}
          className="w-full relative z-10 flex-1 min-h-0 min-h-[500px]"
        >
          <VectorForestScene
            year={year}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            selectedTreeId={selection ? (selection.kind === 'tree' ? selection.treeId : selection.item.id) : null}
            onSelectionChange={setSelection}
            scenarioConfig={scenarioConfig}
            scenarioId={scenarioId}
            scenarioCard={scenarioCard}
            scenarioStartYear={scenarioStartYear}
            onScenarioStartYearChange={setScenarioStartYear}
            onScenarioPrev={handleScenarioPrev}
            onScenarioNext={handleScenarioNext}
            onResetScenario={handleResetScenario}
            metaById={metaById}
            onRecordDeath={handleRecordDeath}
            onStatsChange={setStats}
          />
        </div>
        <button
          type="button"
          data-ui-overlay="true"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          className="absolute right-3 bottom-[4.25rem] z-[250] p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]/90 border border-[var(--border)] bg-[var(--bg)]/90 shadow-sm pointer-events-auto transition-colors"
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
        <div
          data-ui-overlay="true"
          className="flex items-center gap-4 p-4 bg-[var(--bg-alt)] border-t border-[var(--border)] rounded-b-lg pointer-events-auto shrink-0"
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

        {selection && selection.kind === 'tree' && inspectorState && (
          <div
            data-ui-overlay="true"
            className="absolute right-0 top-0 w-full sm:w-[360px] max-w-full h-full min-h-[500px] rounded-l-lg shadow-lg z-[250] flex flex-col bg-white border-l border-gray-200 pointer-events-auto"
          >
            <TreeInspectorPanel
              tree={selection.tree}
              state={inspectorState}
              year={year}
              onClose={handleClosePanel}
              scenarioId={scenarioId}
            />
          </div>
        )}
        {selection && selection.kind === 'regrowth' && (
          <div
            data-ui-overlay="true"
            className="absolute right-0 top-0 w-full sm:w-[360px] max-w-full h-full min-h-[500px] rounded-l-lg shadow-lg z-[250] flex flex-col bg-white border-l border-gray-200 pointer-events-auto"
          >
            <RegrowthInspectorPanel
              item={selection.item}
              age={year - selection.item.spawnYear}
              onClose={handleClosePanel}
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
