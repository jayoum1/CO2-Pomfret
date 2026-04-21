'use client'

/**
 * Simplified vector forest embed for the midterm showcase page.
 *
 * ── GitHub Pages / static demo (NEXT_PUBLIC_MIDTERM_STATIC_FIRST=true at CI build) ──
 *   - Tree positions and DBH come from `/midterm-data/snapshots.json` only (no network to FastAPI).
 *   - Scenario UI (VectorForestScene) is client-side; no backend required.
 *   - Tree inspector species photos use `publicAssetUrl()` so paths work with `basePath`.
 *
 * ── Local development (static flag off) ──
 *   - Tries GET /vector-forest/snapshot on FastAPI first (localhost:8000 by default).
 *   - If the backend is down, falls back to the same static JSON as above.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import VectorForestScene from '@/components/vector-forest/VectorForestScene'
import TreeInspectorPanel from '@/components/vector-forest/TreeInspectorPanel'
import type { TreeSelection, TreeMeta } from '@/components/vector-forest/VectorForestScene'
import {
  getScenarioConfig,
  getScenarioTiming,
  applyScenario,
} from '@/lib/vectorForest/scenarios'
import { getTreeState, type TreeInstance } from '@/lib/vectorForest/treeModel'
import { getVectorForestSnapshot, type VectorForestTree } from '@/lib/api'
import { getStaticVectorForestSnapshot } from '@/lib/midtermStaticData'
import { isMidtermStaticDemoBuild } from '@/lib/midtermMode'
import type { TreeSpeciesKey } from '@/lib/vectorForest/treeSpeciesImages'
import {
  getScenarioCard,
  getPrevScenarioId,
  getNextScenarioId,
  type ScenarioId,
} from '@/lib/vectorForest/scenarioCatalog'

// ── PRNG helpers (mirrors vector-forest/page.tsx for identical layout) ────────

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
  beech: 'Beech',
  mockernut: 'Mockernut Hickory',
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

function backendTreeToInstance(
  t: VectorForestTree,
  index: number,
  total: number,
): TreeInstance {
  const idStr = String(t.tree_id)
  const rng = splitmix32(strToSeed(`${idStr}:${t.plot}`))
  const r1 = rng()
  const r2 = rng()
  const r3 = rng()
  const r4 = rng()
  const r5 = rng()

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

const SCENARIO_SEED = 42
const MAX_YEAR = 20

export default function VectorForestDemo() {
  const [year, setYear] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [selection, setSelection] = useState<TreeSelection>(null)
  const [scenarioId, setScenarioId] = useState<ScenarioId>('emerald_ash_borer')
  const [scenarioStartYear, setScenarioStartYear] = useState(
    () => getScenarioTiming('emerald_ash_borer').startYear,
  )
  const [metaById, setMetaById] = useState<Record<string, TreeMeta>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  const [plotFilter, setPlotFilter] = useState('all')
  const [plots, setPlots] = useState<string[]>([])
  const [backendTrees, setBackendTrees] = useState<VectorForestTree[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch snapshot whenever year or plot changes
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const staticOnly = isMidtermStaticDemoBuild()

      try {
        if (staticOnly) {
          const snap = await getStaticVectorForestSnapshot(year, plotFilter)
          if (cancelled) return
          setBackendTrees(snap.trees)
          if (snap.plots.length > 0) setPlots(snap.plots)
          setLoading(false)
          return
        }

        const snap = await getVectorForestSnapshot(year, plotFilter)
        if (cancelled) return
        setBackendTrees(snap.trees)
        if (snap.plots.length > 0) setPlots(snap.plots)
        setLoading(false)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load snapshot'
        try {
          const fallback = await getStaticVectorForestSnapshot(year, plotFilter)
          if (cancelled) return
          setBackendTrees(fallback.trees)
          if (fallback.plots.length > 0) setPlots(fallback.plots)
          setError(null)
          setLoading(false)
        } catch {
          if (cancelled) return
          setError(message)
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [year, plotFilter])

  // Map backend rows → TreeInstance with deterministic grid placement
  const trees: TreeInstance[] = useMemo(() => {
    const shuffled = [...backendTrees].sort(
      (a, b) =>
        strToSeed(`${a.tree_id}:${a.plot}`) - strToSeed(`${b.tree_id}:${b.plot}`),
    )
    return shuffled.map((t, i) => backendTreeToInstance(t, i, shuffled.length))
  }, [backendTrees])

  const scenarioCard = getScenarioCard(scenarioId)
  const scenarioConfig = useMemo(
    () => getScenarioConfig(scenarioId, SCENARIO_SEED, scenarioStartYear),
    [scenarioId, scenarioStartYear],
  )

  // Reset start year when scenario changes
  useEffect(() => {
    setScenarioStartYear(getScenarioTiming(scenarioId).startYear)
  }, [scenarioId])

  // Responsive dimensions
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () =>
      setDimensions({
        width: el.clientWidth || 800,
        height: Math.min(580, Math.max(440, el.clientHeight || 500)),
      })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleClosePanel = useCallback(() => setSelection(null), [])
  const handleRecordDeath = useCallback(
    (treeId: string, deathYear: number, fallDir: number) => {
      setMetaById((prev) => ({ ...prev, [treeId]: { deathYear, fallDir } }))
    },
    [],
  )
  const handleResetScenario = useCallback(() => {
    setYear(0)
    setMetaById({})
    setSelection(null)
  }, [])
  const handleScenarioPrev = useCallback(
    () => setScenarioId((cur) => getPrevScenarioId(cur)),
    [],
  )
  const handleScenarioNext = useCallback(
    () => setScenarioId((cur) => getNextScenarioId(cur)),
    [],
  )

  const inspectorState = useMemo(() => {
    if (!selection || selection.kind !== 'tree') return null
    const currentTree = trees.find((t) => t.id === selection.treeId) ?? selection.tree
    const base = getTreeState(currentTree, year)
    return applyScenario(base, currentTree, year, scenarioConfig)
  }, [selection, year, scenarioConfig, trees])

  // Escape key clears selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: '#0e1f14', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Top controls bar */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3"
        style={{ background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#4ade80' }}
            title={
              isMidtermStaticDemoBuild()
                ? 'Static snapshot data (GitHub Pages demo — no API)'
                : 'Loads from FastAPI when available; falls back to static JSON'
            }
          >
            {isMidtermStaticDemoBuild() ? 'Offline snapshot' : 'Live API'}
          </span>
          <span
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            {loading ? 'Loading…' : `${trees.length} trees`}
          </span>
        </div>

        <select
          value={plotFilter}
          onChange={(e) => {
            setPlotFilter(e.target.value)
            setSelection(null)
          }}
          className="text-xs rounded-lg px-3 py-1.5 focus:outline-none"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          <option value="all">All Plots</option>
          {plots.map((p) => (
            <option key={p} value={p}>
              {p} Plot
            </option>
          ))}
        </select>
      </div>

      {/* Scene */}
      <div ref={containerRef} className="relative w-full" style={{ minHeight: 480 }}>
        {loading && trees.length === 0 ? (
          <div
            className="flex items-center justify-center"
            style={{ height: 480, color: 'rgba(255,255,255,0.35)' }}
          >
            <span className="text-sm animate-pulse">Loading forest data…</span>
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center justify-center gap-4 p-10 text-center"
            style={{ height: 480 }}
          >
            <div className="text-sm font-medium" style={{ color: '#fbbf24' }}>
              {isMidtermStaticDemoBuild()
                ? 'Could not load demo snapshot data'
                : 'Backend server not running'}
            </div>
            <p className="text-xs max-w-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {isMidtermStaticDemoBuild()
                ? 'Bundled snapshot data failed to load. Try rebuilding the site or report a bug.'
                : 'Start the FastAPI backend, or rely on static JSON fallback if configured.'}
            </p>
            {!isMidtermStaticDemoBuild() && (
              <code
                className="text-xs px-4 py-2 rounded-lg mt-1"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              >
                uvicorn src.api.app:app --reload
              </code>
            )}
          </div>
        ) : (
          <VectorForestScene
            trees={trees}
            year={year}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            selectedTreeId={
              selection
                ? selection.kind === 'tree'
                  ? selection.treeId
                  : selection.item.id
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
            onStatsChange={() => {}}
          />
        )}
      </div>

      {/* Year slider */}
      <div
        className="flex items-center gap-4 px-5 py-4"
        style={{
          background: 'rgba(0,0,0,0.35)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <span
          className="text-xs font-medium shrink-0 w-20"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Year{' '}
          <span className="font-bold" style={{ color: '#4ade80' }}>
            {year}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={MAX_YEAR}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="flex-1 min-w-0"
          style={{ accentColor: '#10b981' }}
        />
        <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
          +{MAX_YEAR} yrs
        </span>
      </div>

      {/* Tree inspector panel */}
      {selection && selection.kind === 'tree' && inspectorState && (
        <div
          className="absolute right-0 top-0 w-full sm:w-[340px] max-w-full h-full rounded-r-2xl z-[250] flex flex-col overflow-auto pointer-events-auto shadow-2xl"
          style={{
            background: 'rgba(6, 16, 9, 0.97)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <TreeInspectorPanel
            tree={selection.tree}
            state={inspectorState}
            year={year}
            onClose={handleClosePanel}
          />
        </div>
      )}
    </div>
  )
}
