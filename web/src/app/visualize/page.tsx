'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { POMFRET_FOREST, CONNECTICUT, AreaBoundary, getAreaById } from '@/lib/geo/boundaries'
import {
  createGrid,
  addOutbreakPoint,
  clearOutbreakPoints,
  spreadTickRadial,
  resetInfection,
  GridState,
  SpreadParams
} from '@/lib/sim/invasiveSpread'
import { INVASIVE_PRESETS, InvasivePreset, getPresetById } from '@/lib/sim/invasivePresets'

const InvasiveMap = dynamic(() => import('@/components/visualize/InvasiveMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[var(--bg-alt)] rounded flex items-center justify-center">Loading map...</div>
})

type SimulationStatus = 'idle' | 'running' | 'paused'

export default function Visualize() {
  // Boundary constraint toggle
  const [constrainToBoundary, setConstrainToBoundary] = useState(false)
  const [selectedAreaId, setSelectedAreaId] = useState<string>('pomfret')
  const selectedArea = getAreaById(selectedAreaId) || POMFRET_FOREST

  // Simulation state
  const [gridState, setGridState] = useState<GridState | null>(null)
  const [simStatus, setSimStatus] = useState<SimulationStatus>('idle')
  const [timeSteps, setTimeSteps] = useState(0)
  const [mapReady, setMapReady] = useState(false)

  // Interaction mode
  const [placeOutbreakMode, setPlaceOutbreakMode] = useState(true)
  const [showNoPointsWarning, setShowNoPointsWarning] = useState(false)
  const [clickToast, setClickToast] = useState<string | null>(null)

  // Invasive preset selection
  const [selectedPresetId, setSelectedPresetId] = useState<string>('emerald-ash-borer')
  const selectedPreset = getPresetById(selectedPresetId) || INVASIVE_PRESETS[0]

  const baseMortalityMultiplier = 0.7

  // Interval ref for spread ticks
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize grid when area changes or constraint toggle changes
  useEffect(() => {
    if (!mapReady) return

    let grid: GridState
    
    if (constrainToBoundary) {
      // Use selected area boundary
      const resolution = selectedArea.id === 'connecticut' ? 60 : 40
      grid = createGrid(selectedArea.bounds, resolution)
    } else {
      // Use a large viewport-based grid (no polygon constraint)
      // Create a bounding box around a default center
      const defaultBounds = [
        { lat: 42.0, lng: -72.5 },  // NW
        { lat: 42.0, lng: -71.5 },  // NE
        { lat: 41.5, lng: -71.5 },  // SE
        { lat: 41.5, lng: -72.5 },  // SW
      ]
      const resolution = 50 // Medium resolution for unconstrained
      grid = createGrid(defaultBounds, resolution)
      
      // Mark ALL cells as inside area (no constraint)
      grid.cells.forEach(row => {
        row.forEach(cell => {
          cell.insideArea = true
        })
      })
      grid.totalCellsInArea = grid.rows * grid.cols
    }
    
    setGridState(grid)
    setSimStatus('idle')
    setTimeSteps(0)
    setShowNoPointsWarning(false)
    
    // Clear any running interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [selectedArea, mapReady, constrainToBoundary])

  // Handle outbreak point click
  const handleOutbreakClick = useCallback((lat: number, lng: number) => {
    if (!gridState) return

    let updated: GridState | null
    
    if (constrainToBoundary) {
      // Validate against boundary
      updated = addOutbreakPoint(gridState, lat, lng, selectedArea.bounds)
      if (!updated) {
        // Click was outside boundary
        setClickToast('Click inside the selected boundary')
        setTimeout(() => setClickToast(null), 2000)
        return
      }
    } else {
      // No boundary constraint, allow any click
      // Use a dummy bounds that encompasses the click
      const dummyBounds = [
        { lat: lat + 1, lng: lng - 1 },
        { lat: lat + 1, lng: lng + 1 },
        { lat: lat - 1, lng: lng + 1 },
        { lat: lat - 1, lng: lng - 1 },
      ]
      updated = addOutbreakPoint(gridState, lat, lng, dummyBounds)
    }
    
    if (updated) {
      setGridState(updated)
      setShowNoPointsWarning(false)
      setClickToast(null)
    }
  }, [gridState, selectedArea.bounds, constrainToBoundary])

  // Clear all outbreak points
  const handleClearPoints = useCallback(() => {
    if (!gridState) return

    const cleared = clearOutbreakPoints(gridState)
    setGridState(cleared)
    setShowNoPointsWarning(false)
  }, [gridState])

  // Handle simulation control
  const handleStart = useCallback(() => {
    if (!gridState) return

    // Check if outbreak points exist
    if (gridState.outbreakPoints.length === 0) {
      setShowNoPointsWarning(true)
      return
    }

    setShowNoPointsWarning(false)

    if (simStatus === 'idle') {
      setTimeSteps(1)
    }

    setSimStatus('running')

    // Start interval for spread ticks using preset params
    const params: SpreadParams = {
      expansionSpeed: selectedPreset.params.expansionSpeed,
      spreadRadius: selectedPreset.params.spreadRadius,
      intensity: selectedPreset.params.intensity,
      edgeRoughness: selectedPreset.params.edgeRoughness,
      mortalityMultiplier: baseMortalityMultiplier,
      tickIntervalMs: 300,
      noiseSeed: 42
    }

    intervalRef.current = setInterval(() => {
      setTimeSteps(prev => {
        const nextStep = prev + 1
        setGridState(prevGrid => {
          if (!prevGrid) return prevGrid
          return spreadTickRadial(prevGrid, nextStep, params)
        })
        return nextStep
      })
    }, params.tickIntervalMs)
  }, [gridState, simStatus, selectedPreset])

  const handlePause = useCallback(() => {
    setSimStatus('paused')
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (gridState) {
      // Reset infection but keep outbreak points
      const resetted = resetInfection(gridState)
      setGridState(resetted)
    }

    setSimStatus('idle')
    setTimeSteps(0)
    setShowNoPointsWarning(false)
  }, [gridState])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Calculate impact metrics (with intensity from preset)
  const percentInfected = gridState?.percentInfected || 0
  const presetIntensity = selectedPreset.params.intensity
  const mortalityMultiplier = baseMortalityMultiplier * (0.6 + 0.8 * presetIntensity) // Scale with preset intensity
  const mortalityFraction = Math.min(percentInfected * mortalityMultiplier, 1)
  
  // Use appropriate area for stats
  const statsArea = constrainToBoundary ? selectedArea : {
    estimatedTrees: 150000, // Rough estimate for unconstrained view
    estimatedCarbonKgC: 30000000 // Rough estimate
  }
  
  const treesDead = Math.round(statsArea.estimatedTrees * mortalityFraction)
  const carbonImpact = statsArea.estimatedCarbonKgC * mortalityFraction
  const co2eImpact = carbonImpact * 3.667 // Convert kg C to kg CO2e
  const outbreakPointCount = gridState?.outbreakPoints.length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Invasive Spread Simulator</h1>
        <p className="text-[var(--text-muted)]">
          Click the map to place an outbreak. Pick an invasive type. Press Start.
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Narrative simulation for classroom exploration (not a precise prediction).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Controls and Stats */}
        <div className="space-y-6 lg:col-span-1">
          {/* Toast for click outside boundary */}
          {clickToast && (
            <div className="card p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-600 dark:text-yellow-400">
              {clickToast}
            </div>
          )}

          {/* Place Outbreak */}
          <div className="card">
            <h2 className="font-semibold mb-3">Place Outbreak Points</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlaceOutbreakMode(!placeOutbreakMode)}
                className={`btn flex-1 ${placeOutbreakMode ? 'btn-primary' : 'btn-secondary'}`}
              >
                {placeOutbreakMode ? '✓ Placing' : 'Enable Placing'}
              </button>
              <button
                onClick={handleClearPoints}
                disabled={outbreakPointCount === 0}
                className="btn btn-secondary"
                title="Clear all outbreak points"
              >
                Clear ({outbreakPointCount})
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              {outbreakPointCount} point{outbreakPointCount !== 1 ? 's' : ''} placed
            </p>
          </div>

          {/* Boundary Constraint */}
          <div className="card">
            <h2 className="font-semibold mb-3">Boundary</h2>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={constrainToBoundary}
                onChange={(e) => setConstrainToBoundary(e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium text-sm">Constrain to boundary</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {constrainToBoundary ? 'Spread limited to selected area' : 'Spread anywhere on map'}
                </div>
              </div>
            </label>
            {constrainToBoundary && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedAreaId('pomfret')}
                  className={`btn flex-1 ${selectedAreaId === 'pomfret' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Pomfret Forest
                </button>
                <button
                  onClick={() => setSelectedAreaId('connecticut')}
                  className={`btn flex-1 ${selectedAreaId === 'connecticut' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Connecticut
                </button>
              </div>
            )}
          </div>

          {/* Invasive Type Selector */}
          <div className="card">
            <h2 className="font-semibold mb-3">Invasive Type</h2>
            <div className="grid grid-cols-2 gap-2">
              {INVASIVE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  disabled={simStatus !== 'idle'}
                  className={`p-3 rounded border-2 text-left transition-all ${
                    selectedPresetId === preset.id
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                      : 'border-[var(--border)] bg-[var(--bg-alt)] hover:border-[var(--primary)]/50'
                  } ${simStatus !== 'idle' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="text-2xl mb-1">{preset.icon}</div>
                  <div className="font-medium text-xs leading-tight">{preset.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 leading-tight">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="card">
            <h2 className="font-semibold mb-3">Simulation</h2>
            {showNoPointsWarning && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-600 dark:text-yellow-400 mb-3">
                Please place at least one outbreak point on the map first.
              </div>
            )}
            <div className="flex gap-2">
              {simStatus === 'idle' && (
                <button
                  onClick={handleStart}
                  disabled={!gridState}
                  className="btn btn-primary flex-1"
                >
                  Start
                </button>
              )}
              {simStatus === 'running' && (
                <button onClick={handlePause} className="btn btn-secondary flex-1">
                  Pause
                </button>
              )}
              {simStatus === 'paused' && (
                <button onClick={handleStart} className="btn btn-primary flex-1">
                  Resume
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={simStatus === 'idle' && timeSteps === 0}
                className="btn btn-secondary"
                title="Reset simulation"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Live Stats */}
          <div className="card">
            <h2 className="font-semibold mb-3">Live Impact</h2>
            <div className="space-y-3">
              <div className="p-3 bg-[var(--bg-alt)] rounded">
                <div className="text-sm text-[var(--text-muted)] mb-1">Trees Lost</div>
                <div className="text-2xl font-bold text-red-500">
                  {treesDead >= 1e6 ? `${(treesDead / 1e6).toFixed(1)}M` : treesDead >= 1e3 ? `${(treesDead / 1e3).toFixed(1)}K` : treesDead.toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-[var(--bg-alt)] rounded">
                <div className="text-sm text-[var(--text-muted)] mb-1">CO₂e Impact</div>
                <div className="text-xl font-bold text-[var(--accent)]">
                  {co2eImpact >= 1e6 ? `${(co2eImpact / 1e6).toFixed(1)}M kg` : `${(co2eImpact / 1e3).toFixed(1)}K kg`}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-alt)] rounded">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Area Infected</div>
                  <div className="text-lg font-semibold text-[var(--primary)]">{(percentInfected * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-[var(--bg-alt)] rounded">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Time Steps</div>
                  <div className="text-lg font-semibold text-[var(--secondary)]">{timeSteps}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Map in a box */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="font-semibold mb-4">Spread Map</h2>
            <div className="rounded-lg border border-[var(--border)] overflow-hidden" style={{ height: '600px' }}>
              <InvasiveMap
                selectedArea={constrainToBoundary ? selectedArea : POMFRET_FOREST}
                gridState={gridState}
                placeOutbreakMode={placeOutbreakMode}
                onMapReady={() => setMapReady(true)}
                onOutbreakClick={handleOutbreakClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
