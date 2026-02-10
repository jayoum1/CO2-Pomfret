'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { POMFRET_FOREST, CONNECTICUT, AreaBoundary, getAreaById } from '@/lib/geo/boundaries'
import {
  createGrid,
  seedInfection,
  spreadTick,
  resetGrid,
  createSeededRNG,
  GridState,
  SpreadParams
} from '@/lib/sim/invasiveSpread'

const InvasiveMap = dynamic(() => import('@/components/visualize/InvasiveMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[var(--bg-alt)] rounded flex items-center justify-center">Loading map...</div>
})

type SimulationStatus = 'idle' | 'running' | 'paused'

export default function Visualize() {
  // Area selection
  const [selectedAreaId, setSelectedAreaId] = useState<string>('pomfret')
  const selectedArea = getAreaById(selectedAreaId) || POMFRET_FOREST

  // Simulation state
  const [gridState, setGridState] = useState<GridState | null>(null)
  const [simStatus, setSimStatus] = useState<SimulationStatus>('idle')
  const [timeSteps, setTimeSteps] = useState(0)
  const [mapReady, setMapReady] = useState(false)

  // Simulation parameters
  const [spreadRate, setSpreadRate] = useState(0.15)
  const [seedCount, setSeedCount] = useState(3)
  const mortalityMultiplier = 0.7

  // RNG for reproducible demos
  const rngRef = useRef(createSeededRNG(42))

  // Interval ref for spread ticks
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize grid when area changes
  useEffect(() => {
    if (!mapReady) return

    const resolution = selectedArea.id === 'connecticut' ? 60 : 40
    const grid = createGrid(selectedArea.bounds, resolution)
    setGridState(grid)
    setSimStatus('idle')
    setTimeSteps(0)
    
    // Reset RNG
    rngRef.current = createSeededRNG(42)
    
    // Clear any running interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [selectedArea, mapReady])

  // Handle simulation control
  const handleStart = useCallback(() => {
    if (!gridState) return

    if (simStatus === 'idle') {
      // Seed initial infection
      const seeded = seedInfection(gridState, seedCount, rngRef.current)
      setGridState(seeded)
      setTimeSteps(1)
    }

    setSimStatus('running')

    // Start interval for spread ticks
    const params: SpreadParams = {
      spreadRate,
      mortalityMultiplier,
      tickIntervalMs: 300
    }

    intervalRef.current = setInterval(() => {
      setGridState(prev => {
        if (!prev) return prev
        return spreadTick(prev, params, rngRef.current)
      })
      setTimeSteps(prev => prev + 1)
    }, params.tickIntervalMs)
  }, [gridState, simStatus, seedCount, spreadRate])

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
      const resetted = resetGrid(gridState)
      setGridState(resetted)
    }

    setSimStatus('idle')
    setTimeSteps(0)
    rngRef.current = createSeededRNG(42)
  }, [gridState])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Calculate impact metrics
  const percentInfected = gridState?.percentInfected || 0
  const mortalityFraction = Math.min(percentInfected * mortalityMultiplier, 1)
  const treesDead = Math.round(selectedArea.estimatedTrees * mortalityFraction)
  const carbonImpact = selectedArea.estimatedCarbonKgC * mortalityFraction
  const co2eImpact = carbonImpact * 3.667 // Convert kg C to kg CO2e

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Invasive Species Spread Visualizer</h1>
        <p className="text-[var(--text-muted)]">
          Narrative simulation for classroom exploration
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Note: This is a visual demonstration, not a precise epidemiological model.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Controls and Stats */}
        <div className="space-y-6 lg:col-span-1">
          {/* Area Selection */}
          <div className="card">
            <h2 className="font-semibold mb-3">Select Area</h2>
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
            <div className="mt-3 text-sm text-[var(--text-muted)]">
              <div className="flex justify-between">
                <span>Area:</span>
                <span className="font-medium">
                  {selectedArea.areaM2 >= 1e6
                    ? `${(selectedArea.areaM2 / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} km²`
                    : `${selectedArea.areaM2.toLocaleString()} m²`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Est. Trees:</span>
                <span className="font-medium">{selectedArea.estimatedTrees.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Scenario Controls */}
          <div className="card">
            <h2 className="font-semibold mb-3">Scenario: Invasive Spread</h2>
            
            <div className="space-y-4">
              {/* Control buttons */}
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
                  className="btn btn-secondary flex-1"
                >
                  Reset
                </button>
              </div>

              {/* Spread rate slider */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Spread Rate: <span className="text-[var(--primary)]">{spreadRate.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={spreadRate}
                  onChange={(e) => setSpreadRate(parseFloat(e.target.value))}
                  disabled={simStatus !== 'idle'}
                  className="w-full"
                  style={{
                    accentColor: 'var(--primary)'
                  }}
                />
                <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
              </div>

              {/* Seed count */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Initial Outbreak Sites: <span className="text-[var(--primary)]">{seedCount}</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={seedCount}
                  onChange={(e) => setSeedCount(parseInt(e.target.value))}
                  disabled={simStatus !== 'idle'}
                  className="w-full"
                  style={{
                    accentColor: 'var(--primary)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Impact Stats */}
          <div className="card">
            <h2 className="font-semibold mb-3">Estimated Impact</h2>
            <div className="space-y-3">
              <div className="p-3 bg-[var(--bg-alt)] rounded">
                <div className="text-sm text-[var(--text-muted)] mb-1">Trees Lost</div>
                <div className="text-2xl font-bold text-red-500">
                  {treesDead.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {(mortalityFraction * 100).toFixed(1)}% mortality
                </div>
              </div>

              <div className="p-3 bg-[var(--bg-alt)] rounded">
                <div className="text-sm text-[var(--text-muted)] mb-1">Carbon Impact</div>
                <div className="text-xl font-bold text-[var(--accent)]">
                  {carbonImpact >= 1e6
                    ? `${(carbonImpact / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} M kg C`
                    : `${carbonImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C`}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  ({co2eImpact >= 1e6
                    ? `${(co2eImpact / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} M`
                    : co2eImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂e)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-alt)] rounded">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Area Infected</div>
                  <div className="text-lg font-semibold text-[var(--primary)]">
                    {(percentInfected * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3 bg-[var(--bg-alt)] rounded">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Time Steps</div>
                  <div className="text-lg font-semibold text-[var(--secondary)]">
                    {timeSteps}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Map */}
        <div className="lg:col-span-2">
          <div className="card h-full">
            <h2 className="font-semibold mb-4">Spread Visualization</h2>
            <div style={{ height: '600px' }}>
              <InvasiveMap
                selectedArea={selectedArea}
                gridState={gridState}
                onMapReady={() => setMapReady(true)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
