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
import AftermathLayer from './aftermath/AftermathLayer'

const PAN_EXTENT = 3
const CAPTURE_THRESHOLD_PX = 6

export interface RegrowthItem {
  id: string
  type: 'sapling'
  x: number
  depth: number
  spawnYear: number
  scenarioId: ScenarioId
}

export type TreeSelection =
  | { kind: 'tree'; treeId: string; tree: TreeInstance; state: TreeState }
  | { kind: 'regrowth'; item: RegrowthItem; age: number }
  | null

export interface TreeMeta {
  deathYear: number
  fallDir: number
}

const VIEWBOX_HEIGHT = 160
const VIEWBOX_WIDTH = 120
const SCENE_SCALE_X = 4
const SCENE_SCALE_Y = 3

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export default function VectorForestScene({
  trees,
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
  hideCarousel = false,
  onStatsChange,
}: {
  trees: TreeInstance[]
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
  /** When true, the ScenarioCarousel overlay is not rendered (controls live in the parent). */
  hideCarousel?: boolean
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

  const sortedTrees = useMemo(
    () => [...trees].sort((a, b) => a.depth - b.depth),
    [trees],
  )

  const paddingPx = 24
  const sceneWidth = containerWidth * SCENE_SCALE_X
  const sceneHeight = (containerHeight || 400) * SCENE_SCALE_Y
  const sceneOffsetX = -(sceneWidth - containerWidth) / 2
  const sceneOffsetY = -(sceneHeight - (containerHeight || 400)) / 2
  const groundY = sceneHeight * 0.92

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

  const selectedTree = selectedTreeId ? sortedTrees.find((t) => t.id === selectedTreeId) ?? null : null

  useEffect(() => {
    if (selectedTreeId && !selectedTreeId.startsWith('regrowth-') && !selectedTree) {
      onSelectionChangeRef.current?.(null)
    }
  }, [selectedTreeId, selectedTree])

  useEffect(() => {
    if (!onRecordDeath || scenarioConfig.id === 'baseline') return
    const seed = 'seed' in scenarioConfig ? scenarioConfig.seed : 42
    sortedTrees.forEach((tree) => {
      const base = getTreeState(tree, year)
      const state = applyScenario(base, tree, year, scenarioConfig)
      if (!state.alive && !metaById[tree.id]) {
        onRecordDeath(tree.id, year, getFallDirection(tree.id, seed, scenarioId))
      }
    })
  }, [sortedTrees, year, scenarioConfig, scenarioId, metaById, onRecordDeath])

  useEffect(() => {
    if (!onStatsChange) return
    let baselineCarbon = 0
    let baselineAlive = 0
    let scenarioCarbon = 0
    let scenarioAlive = 0
    sortedTrees.forEach((tree) => {
      const base = getTreeState(tree, year)
      const scenario = applyScenario(base, tree, year, scenarioConfig)
      baselineCarbon += base.carbonKgC
      if (base.alive) baselineAlive += 1
      scenarioCarbon += scenario.carbonKgC
      if (scenario.alive) scenarioAlive += 1
    })
    onStatsChange({ baselineCarbon, baselineAlive, scenarioCarbon, scenarioAlive })
  }, [sortedTrees, year, scenarioConfig, onStatsChange])

  const clearPanState = useCallback(() => {
    panStartRef.current = null
    isPanningRef.current = false
  }, [])

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
    [containerWidth, containerHeight],
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

  const handleLostPointerCapture = useCallback((_e: React.PointerEvent) => {
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
      const tree = sortedTrees.find((t) => t.id === id)
      if (tree) {
        const state = applyScenario(getTreeState(tree, year), tree, year, scenarioConfig)
        onSelectionChangeRef.current?.({ kind: 'tree', treeId: id, tree, state })
      }
    },
    [sortedTrees, year, scenarioConfig],
  )

  const selectRegrowth = useCallback(
    (item: RegrowthItem) => {
      const age = year - item.spawnYear
      onSelectionChangeRef.current?.({ kind: 'regrowth', item, age })
    },
    [year],
  )

  const handleResetView = useCallback(() => {
    setPan({ x: 0, y: 0 })
  }, [])

  // ——— Scenario overlays — fixed to scene viewport ———
  const floodWaterPct = (() => {
    if (scenarioId !== 'flood') return 0
    const PEAK_HEIGHT = 65
    const HOLD_YEARS = 1
    const RECEDE_YEARS = 2
    const ya = year - scenarioStartYear
    if (ya <= 0) return 0
    if (ya <= HOLD_YEARS) return PEAK_HEIGHT
    return PEAK_HEIGHT * Math.max(0, 1 - (ya - HOLD_YEARS) / RECEDE_YEARS)
  })()

  const scenarioOverlay =
    scenarioId === 'tornado' && year === scenarioStartYear ? (
      <div className="absolute inset-0 pointer-events-none z-[15]" aria-hidden>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(52,55,65,0.40)', backgroundImage: ['repeating-linear-gradient(108deg, transparent, transparent 34px, rgba(255,255,255,0.07) 34px, rgba(255,255,255,0.07) 36px)', 'repeating-linear-gradient(94deg, transparent, transparent 70px, rgba(210,210,225,0.04) 70px, rgba(210,210,225,0.04) 72px)'].join(', '), backgroundSize: '200% 100%, 300% 100%', animation: 'windStreak 5s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 55% at 50% 120%, rgba(65,55,45,0.55) 0%, transparent 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(180deg, rgba(38,38,52,0.32) 0%, transparent 100%)' }} />
      </div>
    ) : scenarioId === 'fire' && year === scenarioStartYear ? (
      <div className="absolute inset-0 pointer-events-none z-[15]" aria-hidden>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(235,82,12,0.68) 0%, rgba(210,52,8,0.42) 28%, rgba(168,32,4,0.18) 58%, rgba(90,18,4,0.06) 100%)', animation: 'fireFlicker 1.8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(180deg, rgba(32,20,10,0.30) 0%, rgba(38,22,8,0.12) 60%, transparent 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: ['radial-gradient(ellipse 32% 22% at 18% 82%, rgba(255,95,8,0.28) 0%, transparent 100%)', 'radial-gradient(ellipse 26% 18% at 76% 72%, rgba(255,75,4,0.22) 0%, transparent 100%)', 'radial-gradient(ellipse 22% 16% at 50% 92%, rgba(255,115,18,0.32) 0%, transparent 100%)', 'radial-gradient(ellipse 18% 12% at 88% 55%, rgba(220,60,0,0.18) 0%, transparent 100%)'].join(', '), animation: 'fireFlicker 2.6s ease-in-out infinite', animationDelay: '0.4s' }} />
      </div>
    ) : scenarioId === 'flood' ? (
      <div className="absolute inset-0 pointer-events-none z-[15]" aria-hidden>
        {floodWaterPct > 0 && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,35,85,0.24) 0%, rgba(18,50,110,0.10) 55%, transparent 100%)', transition: 'opacity 800ms ease' }} />}
        {floodWaterPct > 0 && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(170deg, transparent, transparent 8px, rgba(135,170,215,0.13) 8px, rgba(135,170,215,0.13) 9px)', backgroundSize: '18px 18px', animation: 'rainfall 0.7s linear infinite' }} />}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${floodWaterPct.toFixed(1)}%`, background: 'linear-gradient(180deg, rgba(30,82,145,0.40) 0%, rgba(14,54,122,0.58) 100%)', clipPath: 'polygon(0 10%, 5% 5%, 10% 8%, 15% 4%, 20% 7%, 25% 3%, 30% 6%, 35% 2%, 40% 5%, 45% 4%, 50% 6%, 55% 3%, 60% 5%, 65% 4%, 70% 6%, 75% 3%, 80% 5%, 85% 4%, 90% 6%, 95% 5%, 100% 4%, 100% 100%, 0 100%)', transition: 'height 800ms ease-in-out' }} />
      </div>
    ) : null

  return (
    <div
      ref={sceneRootRef}
      role="presentation"
      className="relative w-full h-full rounded-lg overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      style={{ height: containerHeight || 400 }}
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
      {!hideCarousel && (
        <ScenarioCarousel
          card={scenarioCard}
          startYear={scenarioStartYear}
          onStartYearChange={onScenarioStartYearChange}
          onPrev={onScenarioPrev}
          onNext={onScenarioNext}
          onReset={onResetScenario}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, width: '100%', height: '100%' }}
      >
        <div
          aria-hidden
          className="absolute"
          style={{ width: '1200%', height: '800%', left: '-550%', top: '-350%', background: 'linear-gradient(180deg, #e0f2e9 0%, #c8e6d4 40%, #a8d4b8 100%)', pointerEvents: 'none' }}
        />
        <AftermathLayer
          scenarioId={scenarioId}
          year={year}
          startYear={scenarioStartYear}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          groundY={groundY}
          selectedRegrowthId={selectedTreeId}
          onRegrowthSelect={selectRegrowth}
        />
        {sortedTrees.map((tree) => {
          const baseState = getTreeState(tree, year)
          const state = applyScenario(baseState, tree, year, scenarioConfig)
          const params = visualParamsFromTreeState(state, tree.depth, {
            hueBase: tree.hueBase,
            lightnessBase: tree.lightnessBase,
          })

          const scale = lerp(0.45, 1.15, tree.depth)
          const yBottomPx = sceneOffsetY + lerp(sceneHeight * 0.08, groundY, tree.depth)
          const treeHeightPx = VIEWBOX_HEIGHT * scale
          const topPx = yBottomPx - treeHeightPx
          const treeWidthPx = VIEWBOX_WIDTH * scale
          const xPx = sceneOffsetX + paddingPx + tree.x * (sceneWidth - 2 * paddingPx)
          const baseOpacity = 0.75 + 0.25 * tree.depth
          const isSelected = selectedTreeId === tree.id
          const meta = metaById[tree.id]
          const isDead = !state.alive
          const fallDeg = meta && isDead ? meta.fallDir * 70 : 0

          let opacity = baseOpacity
          const isDisturbanceScenario = scenarioId !== 'baseline'
          if (isDead && meta && isDisturbanceScenario) {
            const yearsDown = year - meta.deathYear
            if (yearsDown >= 15) return null
            const fadeProgress = Math.min(1, Math.max(0, yearsDown / 10))
            opacity = baseOpacity * (1 - fadeProgress * 0.85)
          }

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
              onPointerUp={(e) => { e.stopPropagation(); selectTree(tree.id) }}
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
      {scenarioOverlay}
    </div>
  )
}
