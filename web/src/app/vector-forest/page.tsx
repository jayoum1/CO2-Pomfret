'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Maximize2, Minimize2, RotateCcw, AlertTriangle } from 'lucide-react'
import VectorForestScene from '@/components/vector-forest/VectorForestScene'
import TreeInspectorPanel from '@/components/vector-forest/TreeInspectorPanel'
import RegrowthInspectorPanel from '@/components/vector-forest/RegrowthInspectorPanel'
import type { TreeSelection, TreeMeta } from '@/components/vector-forest/VectorForestScene'
import { getScenarioConfig, getScenarioTiming, applyScenario } from '@/lib/vectorForest/scenarios'
import { getTreeState, type TreeInstance } from '@/lib/vectorForest/treeModel'
import { getVectorForestSnapshot, type VectorForestTree } from '@/lib/api'
import type { TreeSpeciesKey } from '@/lib/vectorForest/treeSpeciesImages'
import {
  SCENARIOS,
  getScenarioCard,
  getPrevScenarioId,
  getNextScenarioId,
  type ScenarioId,
} from '@/lib/vectorForest/scenarioCatalog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

const SCENARIO_SEED = 42
const MAX_YEAR = 20

// ── PRNG (unchanged) ──────────────────────────────────────────────────────────

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
  return {
    id: idStr,
    species: 'generic',
    speciesName: t.species,
    plot: t.plot,
    x: (col + 0.15 + r1 * 0.7) / cols,
    depth: (row + 0.15 + r2 * 0.7) / rows,
    dbh0: t.dbh_cm,
    growthRate: 0,
    jitter: r3,
    hueBase: 100 + Math.floor(r4 * 50),
    lightnessBase: 28 + Math.floor(r5 * 12),
    speciesKey: matchSpeciesKey(t.species),
  }
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  const isBackendDown = message.includes('Cannot reach the backend')
  return (
    <div className="rounded-card border border-amber-200 bg-amber-50/60 p-5 border-l-4 border-l-amber-400">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)] mb-1">
            {isBackendDown ? 'Backend Not Running' : 'Error Loading Data'}
          </h3>
          <p className="text-meta text-[var(--text-muted)] mb-3">{message}</p>
          {isBackendDown && (
            <div className="rounded-control bg-[var(--surface)] border border-amber-200/60 px-3 py-2.5">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Start the backend:</p>
              <code className="text-xs bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1 rounded block text-[var(--text)]">
                cd src && uvicorn api.app:app --reload
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VectorForestPage() {
  const [year, setYear]               = useState(0)
  const [dimensions, setDimensions]   = useState({ width: 800, height: 500 })
  const [selection, setSelection]     = useState<TreeSelection>(null)
  const [scenarioId, setScenarioId]   = useState<ScenarioId>('emerald_ash_borer')
  const [scenarioStartYear, setScenarioStartYear] = useState(
    () => getScenarioTiming('emerald_ash_borer').startYear,
  )
  const [metaById, setMetaById]       = useState<Record<string, TreeMeta>>({})
  const [stats, setStats]             = useState({
    baselineCarbon: 0, baselineAlive: 0, scenarioCarbon: 0, scenarioAlive: 0,
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef  = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const [plotFilter, setPlotFilter]   = useState('all')
  const [plots, setPlots]             = useState<string[]>([])
  const [backendTrees, setBackendTrees] = useState<VectorForestTree[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // Fetch snapshot whenever year or plot changes
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

  // Map backend rows → TreeInstance
  const trees: TreeInstance[] = useMemo(() => {
    const shuffled = [...backendTrees].sort(
      (a, b) => strToSeed(`${a.tree_id}:${a.plot}`) - strToSeed(`${b.tree_id}:${b.plot}`),
    )
    return shuffled.map((t, i) => backendTreeToInstance(t, i, shuffled.length))
  }, [backendTrees])

  const scenarioCard   = getScenarioCard(scenarioId)
  const scenarioConfig = useMemo(
    () => getScenarioConfig(scenarioId, SCENARIO_SEED, scenarioStartYear),
    [scenarioId, scenarioStartYear],
  )

  // Reset start year when scenario changes
  useEffect(() => {
    setScenarioStartYear(getScenarioTiming(scenarioId).startYear)
  }, [scenarioId])

  // Measure forest area for SVG sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      setDimensions({
        width: el.clientWidth || 800,
        height: Math.min(600, Math.max(400, el.clientHeight || 500)),
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleClosePanel    = useCallback(() => setSelection(null), [])
  const handleRecordDeath   = useCallback((id: string, yr: number, dir: number) => {
    setMetaById(prev => ({ ...prev, [id]: { deathYear: yr, fallDir: dir } }))
  }, [])
  const handleResetScenario = useCallback(() => {
    setYear(0)
    setMetaById({})
    setSelection(null)
  }, [])
  const handleScenarioPrev  = useCallback(() => setScenarioId(getPrevScenarioId), [])
  const handleScenarioNext  = useCallback(() => setScenarioId(getNextScenarioId), [])

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen()
        else setSelection(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = fullscreenRef.current
    if (!el) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await el.requestFullscreen()
  }, [])

  // Derived values for the data overlay
  const isDisturbance  = scenarioId !== 'baseline'
  const carbonDisplay  = stats.scenarioCarbon > 0
    ? `${(stats.scenarioCarbon / 1000).toFixed(1)}k kg C`
    : null

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error?.includes('Cannot reach the backend')) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <ErrorBanner message={error} />
      </div>
    )
  }

  // ── Loaded ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader />

      {/* ── Visualization panel ─────────────────────────────────────────────── */}
      <div
        ref={fullscreenRef}
        className="rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden flex flex-col"
      >

        {/* ── Top control bar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)] shrink-0">
          <div className="flex items-center gap-5 flex-wrap">

            {/* Scenario selector */}
            <div className="flex items-center gap-2">
              <span className="text-label text-[var(--text-muted)]">Scenario</span>
              <Select
                value={scenarioId}
                onValueChange={(v) => setScenarioId(v as ScenarioId)}
              >
                <SelectTrigger className="h-7 w-[170px] bg-[var(--surface)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

            {/* View / plot filter */}
            <div className="flex items-center gap-2">
              <span className="text-label text-[var(--text-muted)]">View</span>
              <Select
                value={plotFilter}
                onValueChange={(v) => { setPlotFilter(v); setSelection(null) }}
              >
                <SelectTrigger className="h-7 w-[130px] bg-[var(--surface)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trees</SelectItem>
                  {plots.map(p => (
                    <SelectItem key={p} value={p}>{p} Plot</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="p-1.5 rounded-control text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors shrink-0"
          >
            {isFullscreen
              ? <Minimize2 className="w-4 h-4" />
              : <Maximize2 className="w-4 h-4" />
            }
          </button>
        </div>

        {/* ── Forest area ───────────────────────────────────────────────────── */}
        <div ref={containerRef} className="relative flex-1 min-h-[480px]">

          {/* Data overlay — top left, low-opacity, non-interactive */}
          {trees.length > 0 && (
            <div className="absolute top-3 left-3 z-[200] pointer-events-none select-none">
              <div className="rounded-control bg-black/22 backdrop-blur-[3px] px-3 py-2 space-y-0.5">
                <p className="text-xs font-semibold text-white/95 tabular-nums leading-none">
                  Year {year}
                </p>
                <p className="text-xs text-white/72 leading-none">
                  {trees.length.toLocaleString()} trees
                </p>
                {carbonDisplay && (
                  <p className="text-xs text-white/72 leading-none">{carbonDisplay}</p>
                )}
              </div>
            </div>
          )}

          {/* Forest scene or loading / error */}
          {loading && trees.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[480px] text-[var(--text-muted)] text-sm">
              Loading forest data…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full min-h-[480px] text-sm text-rose-600 p-8 text-center">
              {error}
            </div>
          ) : (
            <VectorForestScene
              trees={trees}
              year={year}
              containerWidth={dimensions.width}
              containerHeight={dimensions.height}
              selectedTreeId={
                selection
                  ? selection.kind === 'tree' ? selection.treeId : selection.item.id
                  : null
              }
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
              hideCarousel
            />
          )}

          {/* Tree inspector panel */}
          {selection?.kind === 'tree' && inspectorState && (
            <div
              data-ui-overlay="true"
              className="absolute right-0 top-0 w-full sm:w-[360px] max-w-full h-full rounded-l-xl shadow-lg z-[250] flex flex-col bg-[var(--surface)] border-l border-[var(--border)] pointer-events-auto"
            >
              <TreeInspectorPanel
                tree={selection.tree}
                state={inspectorState}
                year={year}
                onClose={handleClosePanel}
              />
            </div>
          )}

          {/* Regrowth inspector panel */}
          {selection?.kind === 'regrowth' && (
            <div
              data-ui-overlay="true"
              className="absolute right-0 top-0 w-full sm:w-[360px] max-w-full h-full rounded-l-xl shadow-lg z-[250] flex flex-col bg-[var(--surface)] border-l border-[var(--border)] pointer-events-auto"
            >
              <RegrowthInspectorPanel
                item={selection.item}
                age={year - selection.item.spawnYear}
                onClose={handleClosePanel}
              />
            </div>
          )}
        </div>

        {/* ── Bottom control bar ───────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-2)] shrink-0">

          {/* Primary row: year slider */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[var(--primary)] shrink-0 w-[4.5rem] tabular-nums">
              Year {year}
            </span>
            <Slider
              min={0}
              max={MAX_YEAR}
              step={1}
              value={[year]}
              onValueChange={([v]) => setYear(v)}
              className="flex-1 min-w-0"
            />
            <span className="text-meta text-[var(--text-faint)] shrink-0">20 yr</span>
            <button
              type="button"
              onClick={handleResetScenario}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Disturbance start year — only shown for non-baseline scenarios */}
          {isDisturbance && (
            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-[var(--border)]/50">
              <span className="text-xs font-medium text-[var(--text-muted)] shrink-0 w-[4.5rem] leading-tight tabular-nums">
                Starts yr {scenarioStartYear}
              </span>
              <Slider
                min={0}
                max={15}
                step={1}
                value={[scenarioStartYear]}
                onValueChange={([v]) => setScenarioStartYear(v)}
                className="flex-1 min-w-0"
              />
              <span className="text-meta text-[var(--text-faint)] shrink-0">15 yr max</span>
              <span className="text-xs text-[var(--text-faint)] shrink-0 hidden sm:block">
                Disturbance onset
              </span>
            </div>
          )}

          {/* Helper text */}
          <p className="text-meta text-[var(--text-faint)] mt-2">
            Drag the slider to simulate forest growth. Click any tree to inspect it.
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <h1 className="text-page-title">Forest Simulation</h1>
      <p className="text-meta text-[var(--text-muted)] mt-1">
        Explore how the Pomfret campus forest evolves over a 20-year simulation horizon
      </p>
    </div>
  )
}
