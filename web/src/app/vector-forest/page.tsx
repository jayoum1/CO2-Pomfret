'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import VectorForestScene from '@/components/vector-forest/VectorForestScene'
import TreeInspectorPanel from '@/components/vector-forest/TreeInspectorPanel'
import RegrowthInspectorPanel from '@/components/vector-forest/RegrowthInspectorPanel'
import type { TreeSelection, TreeMeta } from '@/components/vector-forest/VectorForestScene'
import { getScenarioConfig, getScenarioTiming, applyScenario } from '@/lib/vectorForest/scenarios'
import { getTreeState, type TreeInstance } from '@/lib/vectorForest/treeModel'
import { getVectorForestSnapshot, type VectorForestTree } from '@/lib/api'
import { TREE_SPECIES_WITH_IMAGES, type TreeSpeciesKey } from '@/lib/vectorForest/treeSpeciesImages'
import {
  getScenarioCard,
  getPrevScenarioId,
  getNextScenarioId,
  type ScenarioId,
} from '@/lib/vectorForest/scenarioCatalog'

const SCENARIO_SEED = 42
const MAX_YEAR = 20

/**
 * Seed a 32-bit state from a string (xmur3).
 * Returns a function that yields successive uint32 values with good avalanche.
 */
function splitmix32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x9e3779b9) | 0
    let t = seed ^ (seed >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    t = t ^ (t >>> 15)
    return (t >>> 0) / 0x100000000
  }
}

function strToSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x5bd1e995)
    h = (h ^ (h >>> 15)) >>> 0
  }
  return h
}

const SPECIES_IMAGE_MAP: Record<string, TreeSpeciesKey> = {
  'beech': 'Beech',
  'mockernut': 'Mockernut Hickory',
  'mockernut hickory': 'Mockernut Hickory',
  'red maple': 'Red Maple',
  'red oak': 'Red Oak',
  'shagbark hickory': 'Shagbark Hickory',
  'sugar maple': 'Sugar Maple',
  'white pine': 'White Pine',
}

function matchSpeciesKey(speciesName: string): TreeSpeciesKey | undefined {
  return SPECIES_IMAGE_MAP[speciesName.toLowerCase()]
}

function backendTreeToInstance(t: VectorForestTree, index: number, total: number): TreeInstance {
  const idStr = String(t.tree_id)
  const rng = splitmix32(strToSeed(`${idStr}:${t.plot}`))
  const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng()

  const cols = Math.ceil(Math.sqrt(total * 1.5))
  const rows = Math.ceil(total / cols)
  const col = index % cols
  const row = Math.floor(index / cols)
  const cellX = (col + 0.15 + r1 * 0.7) / cols
  const cellY = (row + 0.15 + r2 * 0.7) / rows

  return {
    id: idStr,
    species: 'generic',
    speciesName: t.species,
    plot: t.plot,
    x: cellX,
    depth: cellY,
    dbh0: t.dbh_cm,
    growthRate: 0,
    jitter: r3,
    hueBase: 100 + Math.floor(r4 * 50),
    lightnessBase: 28 + Math.floor(r5 * 12),
    speciesKey: matchSpeciesKey(t.species),
  }
}

export default function VectorForestPage() {
  const [year, setYear] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [selection, setSelection] = useState<TreeSelection>(null)
  const [scenarioId, setScenarioId] = useState<ScenarioId>('emerald_ash_borer')
  const [scenarioStartYear, setScenarioStartYear] = useState(() => getScenarioTiming('emerald_ash_borer').startYear)
  const [metaById, setMetaById] = useState<Record<string, TreeMeta>>({})
  const [stats, setStats] = useState({ baselineCarbon: 0, baselineAlive: 0, scenarioCarbon: 0, scenarioAlive: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  // --- Real data state ---
  const [plotFilter, setPlotFilter] = useState('all')
  const [plots, setPlots] = useState<string[]>([])
  const [backendTrees, setBackendTrees] = useState<VectorForestTree[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch snapshot whenever year or plot filter changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getVectorForestSnapshot(year, plotFilter)
      .then((snap) => {
        if (cancelled) return
        setBackendTrees(snap.trees)
        if (snap.plots.length > 0) setPlots(snap.plots)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Failed to load snapshot')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [year, plotFilter])

  // Map backend rows to TreeInstance objects with stratified grid placement
  const trees: TreeInstance[] = useMemo(
    () => {
      const shuffled = [...backendTrees].sort(
        (a, b) => strToSeed(`${a.tree_id}:${a.plot}`) - strToSeed(`${b.tree_id}:${b.plot}`),
      )
      return shuffled.map((t, i) => backendTreeToInstance(t, i, shuffled.length))
    },
    [backendTrees],
  )

  const scenarioCard = getScenarioCard(scenarioId)
  const scenarioConfig = useMemo(
    () => getScenarioConfig(scenarioId, SCENARIO_SEED, scenarioStartYear),
    [scenarioId, scenarioStartYear],
  )

  useEffect(() => {
    setScenarioStartYear(getScenarioTiming(scenarioId).startYear)
  }, [scenarioId])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => {
      setDimensions({
        width: el.clientWidth || 800,
        height: Math.min(600, Math.max(400, el.clientHeight || 500)),
      })
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleClosePanel = useCallback(() => setSelection(null), [])
  const handleRecordDeath = useCallback((treeId: string, deathYear: number, fallDir: number) => {
    setMetaById((prev) => ({ ...prev, [treeId]: { deathYear, fallDir } }))
  }, [])
  const handleResetScenario = useCallback(() => { setYear(0); setMetaById({}); setSelection(null) }, [])
  const handleScenarioPrev = useCallback(() => setScenarioId((cur) => getPrevScenarioId(cur)), [])
  const handleScenarioNext = useCallback(() => setScenarioId((cur) => getNextScenarioId(cur)), [])

  const inspectorState = useMemo(() => {
    if (!selection || selection.kind !== 'tree') return null
    const currentTree = trees.find(t => t.id === selection.treeId) ?? selection.tree
    const base = getTreeState(currentTree, year)
    return applyScenario(base, currentTree, year, scenarioConfig)
  }, [selection, year, scenarioConfig, trees])

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
        if (document.fullscreenElement) document.exitFullscreen()
        else setSelection(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = fullscreenRef.current
    if (!el) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await el.requestFullscreen()
  }, [])

  // Backend-down error page
  const isBackendDown = error?.includes('Cannot reach the backend')
  if (error && isBackendDown) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Vector Forest</h1>
          <p className="text-[var(--text-muted)]">Real forest growth visualization from snapshot data.</p>
        </div>
        <div className="card border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-500 mt-0.5 shrink-0" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Backend Server Not Running</h3>
              <p className="text-sm text-gray-600 mb-3">{error}</p>
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                <p className="font-medium mb-1">To start the backend:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-1">cd src && uvicorn api.app:app --reload</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Vector Forest</h1>
          <p className="text-[var(--text-muted)]">
            Baseline forest projection — {trees.length} trees{plotFilter !== 'all' ? ` (${plotFilter} plot)` : ''}.
          </p>
        </div>
        {/* Plot selector */}
        <div data-ui-overlay="true" className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--text)]">View:</label>
          <select
            value={plotFilter}
            onChange={(e) => { setPlotFilter(e.target.value); setSelection(null) }}
            className="input w-40 py-1.5 text-sm"
          >
            <option value="all">All Trees</option>
            {plots.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={fullscreenRef}
        className={`relative card p-0 overflow-hidden flex flex-col ${isFullscreen ? 'h-screen min-h-0' : ''}`}
      >
        <div ref={containerRef} className="w-full relative z-10 flex-1 min-h-0 min-h-[500px]">
          {loading && trees.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[500px] text-[var(--text-muted)]">
              Loading forest data...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full min-h-[500px] text-red-600 p-8 text-center">
              {error}
            </div>
          ) : (
            <VectorForestScene
              trees={trees}
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
          )}
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
            max={MAX_YEAR}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="flex-1 min-w-0 max-w-md"
            style={{ accentColor: 'var(--primary)' }}
          />
          <span className="text-xs text-[var(--text-muted)] shrink-0">0 → {MAX_YEAR} years</span>
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
        Showing real tree data from the Pomfret forest baseline model. {trees.length} trees across {plots.length} plots.
      </p>
    </div>
  )
}
