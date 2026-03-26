'use client'

import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import TreeSVG from './TreeSVG'
import { getTreeState, type TreeInstance } from '@/lib/vectorForest/treeModel'
import type { TreeState } from '@/lib/vectorForest/treeModel'
import { visualParamsFromTreeState } from '@/lib/vectorForest/visualMapping'
import { applyScenario, getFallDirection } from '@/lib/vectorForest/scenarios'
import type { ScenarioConfig } from '@/lib/vectorForest/scenarios'
import type { ScenarioId, ScenarioCard } from '@/lib/vectorForest/scenarioCatalog'
import ScenarioCarousel from './ScenarioCarousel'
import { TREE_SPECIES_WITH_IMAGES, type TreeSpeciesKey } from '@/lib/vectorForest/treeSpeciesImages'

const PAN_THRESHOLD_PX = 6
const PAN_EXTENT = 1.5
const CAPTURE_THRESHOLD_PX = 6

export type TreeSelection = { treeId: string; tree: TreeInstance; state: TreeState } | null

export interface TreeMeta {
  deathYear: number
  fallDir: number
}

const VIEWBOX_HEIGHT = 160
const VIEWBOX_WIDTH = 120

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function getScenarioProgress(year: number, scenarioConfig: ScenarioConfig): number {
  if (scenarioConfig.id === 'baseline') return 0
  const startYear = 'startYear' in scenarioConfig ? scenarioConfig.startYear : 0
  const durationYears = 'durationYears' in scenarioConfig ? scenarioConfig.durationYears : 30
  if (year < startYear) return 0
  return Math.min(1, (year - startYear) / Math.max(1, durationYears))
}

export default function VectorForestScene({
  year,
  containerWidth,
  containerHeight,
  selectedTreeId,
  onSelectionChange,
  scenarioConfig,
  scenarioId,
  scenarioCard,
  scenarioStartYear,
  onScenarioStartYearChange,
  onScenarioPrev,
  onScenarioNext,
  onResetScenario,
  metaById,
  onRecordDeath,
  onStatsChange,
}: {
  year: number
  containerWidth: number
  containerHeight: number
  selectedTreeId: string | null
  onSelectionChange?: (selection: TreeSelection) => void
  scenarioConfig: ScenarioConfig
  scenarioId: ScenarioId
  scenarioCard: ScenarioCard
  scenarioStartYear: number
  onScenarioStartYearChange: (y: number) => void
  onScenarioPrev: () => void
  onScenarioNext: () => void
  onResetScenario?: () => void
  metaById: Record<string, TreeMeta>
  onRecordDeath?: (treeId: string, deathYear: number, fallDir: number) => void
  onStatsChange?: (stats: {
    baselineCarbon: number
    baselineAlive: number
    scenarioCarbon: number
    scenarioAlive: number
  }) => void
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panStartRef = useRef<{ x: number; y: number } | null>(null)
  const isPanningRef = useRef(false)
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange

  const rng = useMemo(() => seededRandom(42), [])

  const trees = useMemo((): TreeInstance[] => {
    const count = Math.min(80, Math.max(30, Math.floor((containerWidth * containerHeight) / 12000)))
    const speciesKeys = TREE_SPECIES_WITH_IMAGES as readonly string[]
    const list: TreeInstance[] = []
    for (let i = 0; i < count; i++) {
      const depth = rng()
      const speciesKey = speciesKeys[Math.floor(rng() * speciesKeys.length)] as TreeSpeciesKey
      list.push({
        id: `tree-${i}`,
        species: 'generic',
        x: rng(),
        depth,
        dbh0: 8 + rng() * 27,
        growthRate: 0.2 + rng() * 0.6,
        jitter: rng(),
        hueBase: 100 + Math.floor(rng() * 50),
        lightnessBase: 28 + Math.floor(rng() * 12),
        speciesKey,
      })
    }
    list.sort((a, b) => a.depth - b.depth)
    return list
  }, [containerWidth, containerHeight, rng])

  const paddingPx = 24
  const groundY = containerHeight * 0.88
  const sceneHeight = containerHeight || 400
  const progress = getScenarioProgress(year, scenarioConfig)

  useEffect(() => {
    const w = containerWidth || 800
    const h = containerHeight || 400
    const maxX = w * PAN_EXTENT
    const maxY = h * PAN_EXTENT
    setPan((prev) => ({
      x: Math.max(-maxX, Math.min(maxX, prev.x)),
      y: Math.max(-maxY, Math.min(maxY, prev.y)),
    }))
  }, [containerWidth, containerHeight])

  const selectedTree = selectedTreeId ? trees.find((t) => t.id === selectedTreeId) ?? null : null
  const selectedState = selectedTree
    ? applyScenario(getTreeState(selectedTree, year), selectedTree, year, scenarioConfig)
    : null

  useEffect(() => {
    if (selectedTreeId && !selectedTree) {
      onSelectionChangeRef.current?.(null)
    }
  }, [selectedTreeId, selectedTree])

  useEffect(() => {
    if (!onRecordDeath || scenarioConfig.id === 'baseline') return
    const seed = 'seed' in scenarioConfig ? scenarioConfig.seed : 42
    trees.forEach((tree) => {
      const base = getTreeState(tree, year)
      const state = applyScenario(base, tree, year, scenarioConfig)
      if (!state.alive && !metaById[tree.id]) {
        onRecordDeath(tree.id, year, getFallDirection(tree.id, seed, scenarioId))
      }
    })
  }, [trees, year, scenarioConfig, scenarioId, metaById, onRecordDeath])

  useEffect(() => {
    if (!onStatsChange) return
    let baselineCarbon = 0
    let baselineAlive = 0
    let scenarioCarbon = 0
    let scenarioAlive = 0
    trees.forEach((tree) => {
      const base = getTreeState(tree, year)
      const scenario = applyScenario(base, tree, year, scenarioConfig)
      baselineCarbon += base.carbonKgC
      if (base.alive) baselineAlive += 1
      scenarioCarbon += scenario.carbonKgC
      if (scenario.alive) scenarioAlive += 1
    })
    onStatsChange({ baselineCarbon, baselineAlive, scenarioCarbon, scenarioAlive })
  }, [trees, year, scenarioConfig, onStatsChange])

  const clearPanState = useCallback(() => {
    panStartRef.current = null
    isPanningRef.current = false
  }, [])

  /**
   * Pan handlers on scene root. We only setPointerCapture AFTER movement exceeds threshold,
   * so simple clicks and slider drags never capture. UI and trees are ignored via target check.
   */
  const handleScenePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-tree-click="true"]')) return
    if (target.closest('[data-ui-overlay="true"]')) return
    panStartRef.current = { x: e.clientX, y: e.clientY }
    isPanningRef.current = false
  }, [])

  const handleScenePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (panStartRef.current === null) return
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      const moved = Math.abs(dx) > CAPTURE_THRESHOLD_PX || Math.abs(dy) > CAPTURE_THRESHOLD_PX
      if (moved && !isPanningRef.current) {
        isPanningRef.current = true
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch (_) {}
      }
      if (isPanningRef.current) {
        const w = containerWidth || 800
        const h = containerHeight || 400
        const maxX = w * PAN_EXTENT
        const maxY = h * PAN_EXTENT
        setPan((prev) => ({
          x: Math.max(-maxX, Math.min(maxX, prev.x + dx)),
          y: Math.max(-maxY, Math.min(maxY, prev.y + dy)),
        }))
        panStartRef.current = { x: e.clientX, y: e.clientY }
      }
    },
    [containerWidth, containerHeight]
  )

  const handleScenePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (panStartRef.current === null) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (_) {}
    const wasPanning = isPanningRef.current
    panStartRef.current = null
    isPanningRef.current = false
    if (!wasPanning) {
      const el = e.target as HTMLElement | null
      if (el?.closest('[data-tree-click="true"]') || el?.closest('[data-ui-overlay="true"]')) return
      onSelectionChangeRef.current?.(null)
    }
  }, [])

  const handleScenePointerCancel = useCallback((e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (_) {}
    panStartRef.current = null
    isPanningRef.current = false
  }, [])

  const handleLostPointerCapture = useCallback((e: React.PointerEvent) => {
    panStartRef.current = null
    isPanningRef.current = false
  }, [])

  const sceneRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onBlur = () => clearPanState()
    const onPointerUp = (ev: PointerEvent) => {
      if (panStartRef.current === null) return
      const root = sceneRootRef.current
      const target = ev.target as Node
      if (root && root.contains(target)) return
      clearPanState()
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('pointerup', onPointerUp, true)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [clearPanState])

  const selectTree = useCallback(
    (id: string) => {
      const tree = trees.find((t) => t.id === id)
      if (tree) {
        const state = applyScenario(getTreeState(tree, year), tree, year, scenarioConfig)
        onSelectionChangeRef.current?.({ treeId: id, tree, state })
      }
    },
    [trees, year, scenarioConfig]
  )

  const handleResetView = useCallback(() => {
    setPan({ x: 0, y: 0 })
  }, [])

  // Full-scene overlays (below trees so tree clicks work); pointer-events-none; z-10
  const waterlineFraction = scenarioId === 'flood' ? lerp(1.05, 0.55, progress) : 0

  const scenarioOverlay =
    scenarioId === 'tornado' && progress > 0 ? (
      <div
        className="absolute inset-0 bg-[rgba(60,60,60,0.25)] pointer-events-none z-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(105deg, transparent, transparent 40px, rgba(255,255,255,0.06) 40px, rgba(255,255,255,0.06) 42px)',
          backgroundSize: '200% 100%',
          animation: 'windStreak 8s linear infinite',
        }}
      />
    ) : scenarioId === 'flood' && progress > 0 ? (
      <div
        className="absolute bottom-0 left-0 right-0 transition-all duration-700 pointer-events-none z-10"
        style={{
          height: `${Math.min(1, Math.max(0, 1 - waterlineFraction)) * 100}%`,
          background: 'linear-gradient(180deg, rgba(30,80,140,0.35) 0%, rgba(20,60,120,0.5) 100%)',
          clipPath: 'polygon(0 10%, 5% 5%, 10% 8%, 15% 4%, 20% 7%, 25% 3%, 30% 6%, 35% 2%, 40% 5%, 45% 4%, 50% 6%, 55% 3%, 60% 5%, 65% 4%, 70% 6%, 75% 3%, 80% 5%, 85% 4%, 90% 6%, 95% 5%, 100% 4%, 100% 100%, 0 100%)',
        }}
      />
    ) : scenarioId === 'fire' && progress > 0 ? (
      <div
        className="absolute inset-0 transition-all duration-700 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(220,90,40,0.5) 0%, rgba(180,50,20,0.45) 40%, rgba(255,120,50,0.4) 100%)',
          animation: 'fireFlash 3s ease-out forwards',
        }}
      />
    ) : null

  return (
    <div
      ref={sceneRootRef}
      role="presentation"
      className="relative w-full h-full rounded-lg overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      style={{ height: sceneHeight }}
      onPointerDown={handleScenePointerDown}
      onPointerMove={handleScenePointerMove}
      onPointerUp={handleScenePointerUp}
      onPointerCancel={handleScenePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
    >
      <button
        type="button"
        data-ui-overlay="true"
        onClick={handleResetView}
        aria-label="Reset view to original position"
        className="absolute bottom-3 left-3 z-[250] px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg)]/90 hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] shadow-sm pointer-events-auto transition-colors"
      >
        Reset view
      </button>
      <ScenarioCarousel
        card={scenarioCard}
        startYear={scenarioStartYear}
        onStartYearChange={onScenarioStartYearChange}
        onPrev={onScenarioPrev}
        onNext={onScenarioNext}
        onReset={onResetScenario}
      />
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          width: '100%',
          height: '100%',
        }}
      >
        <div
          aria-hidden
          className="absolute"
          style={{
            width: '400%',
            height: '400%',
            left: '-150%',
            top: '-150%',
            background: 'linear-gradient(180deg, #e0f2e9 0%, #c8e6d4 40%, #a8d4b8 100%)',
            pointerEvents: 'none',
          }}
        />
        {/* Scenario overlay behind tree layer so tree clicks always register */}
        <div className="absolute inset-0 pointer-events-none z-10" aria-hidden>
          {scenarioOverlay}
        </div>
        {trees.map((tree) => {
          const baseState = getTreeState(tree, year)
          const state = applyScenario(baseState, tree, year, scenarioConfig)
          const params = visualParamsFromTreeState(state, tree.depth, {
            hueBase: tree.hueBase,
            lightnessBase: tree.lightnessBase,
          })

          const scale = lerp(0.45, 1.15, tree.depth)
          const yBottomPx = lerp(containerHeight * 0.25, groundY, tree.depth)
          const treeHeightPx = VIEWBOX_HEIGHT * scale
          const topPx = yBottomPx - treeHeightPx
          const treeWidthPx = VIEWBOX_WIDTH * scale
          const xPx = paddingPx + tree.x * (containerWidth - 2 * paddingPx)
          const opacity = 0.75 + 0.25 * tree.depth
          const isSelected = selectedTreeId === tree.id
          const meta = metaById[tree.id]
          const isDead = !state.alive
          const fallDeg = meta && isDead ? meta.fallDir * 70 : 0

          const visualClass = params.visualClass === 'tree-burning'
            ? 'drop-shadow-[0_0_12px_rgba(255,120,0,0.8)]'
            : params.visualClass === 'tree-charred'
              ? 'grayscale brightness-[0.55]'
              : ''

          return (
            <button
              key={tree.id}
              type="button"
              data-tree-click="true"
              aria-label={`Inspect tree ${tree.id}`}
              className={`absolute transition-all duration-300 ease-out cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 hover:brightness-110 touch-none ${visualClass} ${
                isSelected
                  ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg)] brightness-110 z-[200]'
                  : ''
              }`}
              style={{
                left: xPx - treeWidthPx / 2,
                top: topPx,
                width: treeWidthPx,
                height: treeHeightPx,
                zIndex: isSelected ? 200 : Math.floor(tree.depth * 100),
                opacity,
                transformOrigin: '50% 100%',
                transform: isDead ? `rotateZ(${fallDeg}deg) translateY(${treeHeightPx * 0.08}px)` : undefined,
                transition: 'transform 900ms ease-in-out, opacity 900ms ease',
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                e.stopPropagation()
                selectTree(tree.id)
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  selectTree(tree.id)
                }
              }}
            >
              <TreeSVG
                trunkWidthPx={params.trunkWidthPx}
                trunkHeightPx={params.trunkHeightPx}
                canopyScale={params.canopyScale}
                canopyYPx={params.canopyYPx}
                hue={params.hue}
                saturation={`${params.saturation}%`}
                lightness={`${params.lightness}%`}
                alpha={params.alpha}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
