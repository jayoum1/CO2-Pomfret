'use client'

import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import TreeSVG from './TreeSVG'
import { getTreeState, type TreeInstance } from '@/lib/vectorForest/treeModel'
import type { TreeState } from '@/lib/vectorForest/treeModel'
import { visualParamsFromTreeState } from '@/lib/vectorForest/visualMapping'
import { applyScenario, getFallDirection, isInvasiveOutbreakConfig } from '@/lib/vectorForest/scenarios'
import type { ScenarioConfig } from '@/lib/vectorForest/scenarios'

const PAN_THRESHOLD_PX = 5

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

export default function VectorForestScene({
  year,
  containerWidth,
  containerHeight,
  selectedTreeId,
  onSelectionChange,
  scenarioConfig,
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
    const list: TreeInstance[] = []
    for (let i = 0; i < count; i++) {
      const depth = rng()
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
      })
    }
    list.sort((a, b) => a.depth - b.depth)
    return list
  }, [containerWidth, containerHeight, rng])

  const paddingPx = 24
  const groundY = containerHeight * 0.88
  const selectedTree = selectedTreeId ? trees.find((t) => t.id === selectedTreeId) ?? null : null
  const selectedState = selectedTree
    ? applyScenario(getTreeState(selectedTree, year), selectedTree, year, scenarioConfig)
    : null

  useEffect(() => {
    if (!selectedTreeId || !selectedTree) {
      onSelectionChangeRef.current?.(null)
      return
    }
    const base = getTreeState(selectedTree, year)
    const state = applyScenario(base, selectedTree, year, scenarioConfig)
    onSelectionChangeRef.current?.({ treeId: selectedTreeId, tree: selectedTree, state })
  }, [selectedTreeId, selectedTree, year, scenarioConfig])

  useEffect(() => {
    if (!onRecordDeath || !isInvasiveOutbreakConfig(scenarioConfig)) return
    const seed = scenarioConfig.seed
    trees.forEach((tree) => {
      const base = getTreeState(tree, year)
      const state = applyScenario(base, tree, year, scenarioConfig)
      if (!state.alive && !metaById[tree.id]) {
        onRecordDeath(tree.id, year, getFallDirection(tree.id, seed))
      }
    })
  }, [trees, year, scenarioConfig, metaById, onRecordDeath])

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

  const handlePanLayerPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    panStartRef.current = { x: e.clientX, y: e.clientY }
    isPanningRef.current = false
  }, [])

  const handlePanLayerPointerMove = useCallback((e: React.PointerEvent) => {
    if (panStartRef.current === null) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    if (!isPanningRef.current && (Math.abs(dx) > PAN_THRESHOLD_PX || Math.abs(dy) > PAN_THRESHOLD_PX)) {
      isPanningRef.current = true
    }
    if (isPanningRef.current) {
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      panStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handlePanLayerPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const wasPanning = isPanningRef.current
    panStartRef.current = null
    isPanningRef.current = false
    if (!wasPanning) {
      onSelectionChangeRef.current?.(null)
    }
  }, [])

  const handlePanLayerPointerLeave = useCallback((e: React.PointerEvent) => {
    if (panStartRef.current === null) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    panStartRef.current = null
    isPanningRef.current = false
  }, [])

  const handleTreeClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      const tree = trees.find((t) => t.id === id)
      if (tree) {
        const state = applyScenario(getTreeState(tree, year), tree, year, scenarioConfig)
        onSelectionChangeRef.current?.({ treeId: id, tree, state })
      }
    },
    [trees, year, scenarioConfig]
  )

  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        const tree = trees.find((t) => t.id === id)
        if (tree) {
          const state = applyScenario(getTreeState(tree, year), tree, year, scenarioConfig)
          onSelectionChange?.({ treeId: id, tree, state })
        }
      }
    },
    [trees, year, scenarioConfig, onSelectionChange]
  )

  const sceneHeight = containerHeight || 400

  return (
    <div
      role="presentation"
      className="relative w-full h-full rounded-lg overflow-hidden touch-none"
      style={{ height: sceneHeight }}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          width: '100%',
          height: '100%',
        }}
      >
        <div
          role="presentation"
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            width: '400%',
            height: '400%',
            left: '-150%',
            top: '-150%',
            background: 'linear-gradient(180deg, #e0f2e9 0%, #c8e6d4 40%, #a8d4b8 100%)',
            touchAction: 'none',
          }}
          onPointerDown={handlePanLayerPointerDown}
          onPointerMove={handlePanLayerPointerMove}
          onPointerUp={handlePanLayerPointerUp}
          onPointerCancel={handlePanLayerPointerUp}
          onPointerLeave={handlePanLayerPointerLeave}
        />
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

          return (
            <button
              key={tree.id}
              type="button"
              data-tree-click="true"
              aria-label={`Inspect tree ${tree.id}`}
              className={`absolute transition-all duration-300 ease-out cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 hover:brightness-110 touch-none ${
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
              onClick={(e) => {
                e.stopPropagation()
                handleTreeClick(e, tree.id)
              }}
              onKeyDown={(e) => handleTreeKeyDown(e, tree.id)}
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
