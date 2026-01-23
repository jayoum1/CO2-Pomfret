'use client'

import { useState, useEffect, useMemo } from 'react'
import { simulateScenario, PlantingGroup, getSummary } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, X, Save, Loader2, Play, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const CO2E_FACTOR = 3.667

// Available tree species based on forest data
const AVAILABLE_SPECIES = [
  'red oak',
  'sugar maple',
  'white oak',
  'black oak',
  'white pine',
  'eastern hemlock',
  'yellow birch',
  'tulip poplar',
  'american beech',
  'black cherry',
  'red maple',
] as const

interface RemovalGroup {
  plot: 'Upper' | 'Middle' | 'Lower'
  species: string
  dbh_cm: number
  count: number
}

export default function Scenarios() {
  // Planting state
  const [plantings, setPlantings] = useState<PlantingGroup[]>([])
  const [plantingPlot, setPlantingPlot] = useState<'Upper' | 'Middle' | 'Lower'>('Middle')
  const [plantingSpecies, setPlantingSpecies] = useState<string>('')
  const [plantingDbh, setPlantingDbh] = useState<number | ''>(5.0)
  const [plantingCount, setPlantingCount] = useState<number | ''>(10)
  
  // Removal state
  const [removals, setRemovals] = useState<RemovalGroup[]>([])
  const [removalPlot, setRemovalPlot] = useState<'Upper' | 'Middle' | 'Lower'>('Middle')
  const [removalSpecies, setRemovalSpecies] = useState<string>('')
  const [removalDbh, setRemovalDbh] = useState<number | ''>(10.0)
  const [removalCount, setRemovalCount] = useState<number | ''>(10)
  
  const [scenarioResult, setScenarioResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedScenarios, setSavedScenarios] = useState<Array<{ name: string; data: any }>>([])
  const [scenarioName, setScenarioName] = useState<string>('')
  const [carbonSequestration, setCarbonSequestration] = useState(true)
  const [biodiversityImpact, setBiodiversityImpact] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('savedScenarios')
      if (saved) {
        setSavedScenarios(JSON.parse(saved))
      }
    }
  }, [])

  const addPlanting = () => {
    if (plantingSpecies && plantingDbh !== '' && plantingCount !== '') {
      setPlantings([...plantings, {
        plot: plantingPlot,
        species: plantingSpecies,
        dbh_cm: plantingDbh as number,
        count: plantingCount as number,
      }])
      setPlantingSpecies('')
      setPlantingDbh(5.0)
      setPlantingCount(10)
    }
  }

  const removePlanting = (index: number) => {
    setPlantings(plantings.filter((_, i) => i !== index))
  }

  const totalTreesPlanted = useMemo(() => {
    return plantings.reduce((sum, item) => sum + (item.count || 0), 0)
  }, [plantings])

  const addRemoval = () => {
    if (removalSpecies && removalDbh !== '' && removalCount !== '') {
      setRemovals([...removals, {
        plot: removalPlot,
        species: removalSpecies,
        dbh_cm: removalDbh as number,
        count: removalCount as number,
      }])
      setRemovalSpecies('')
      setRemovalDbh(10.0)
      setRemovalCount(10)
    }
  }

  const removeRemoval = (index: number) => {
    setRemovals(removals.filter((_, i) => i !== index))
  }

  // Simple carbon estimation function (simplified allometric equation)
  const estimateCarbonFromDbh = (dbh_cm: number, species: string): number => {
    // Simplified allometric: C = a * DBH^b
    // Using approximate values for hardwoods: C ≈ 0.15 * DBH^2.4 (kg C)
    const a = 0.15
    const b = 2.4
    return a * Math.pow(dbh_cm, b)
  }

  // Simulate DBH growth over years (simplified approximation)
  const simulateDbhGrowth = (initialDbh: number, years: number, species: string, plot: string): number => {
    // Simplified growth model: DBH increases by approximately 0.3-0.5 cm per year for mature trees
    // Younger trees grow faster. Using a simple linear approximation with diminishing returns
    const annualGrowth = initialDbh < 10 ? 0.5 : initialDbh < 20 ? 0.4 : 0.3
    return initialDbh + (annualGrowth * years)
  }

  const calculateRemovalImpact = async (yearsList: number[]): Promise<Record<string, { carbon_kgC: number; trees: number }>> => {
    const impact: Record<string, { carbon_kgC: number; trees: number }> = {}
    
    if (removals.length === 0) {
      // No removals, return zero impact
      for (const year of yearsList) {
        impact[year.toString()] = { carbon_kgC: 0, trees: 0 }
      }
      return impact
    }
    
    for (const year of yearsList) {
      let totalCarbonLoss = 0
      let totalTreesRemoved = removals.reduce((sum, r) => sum + r.count, 0)
      
      // For each removal group, calculate carbon that would have been stored at this year if trees weren't removed
      for (const removal of removals) {
        // Simulate what the DBH would be at this year if trees weren't removed
        const futureDbh = simulateDbhGrowth(removal.dbh_cm, year, removal.species, removal.plot)
        
        // Calculate carbon that would have been stored at this future year
        const futureCarbon = estimateCarbonFromDbh(futureDbh, removal.species)
        
        // Total carbon loss = carbon per tree at this year * number of trees removed
        totalCarbonLoss += futureCarbon * removal.count
      }
      
      impact[year.toString()] = {
        carbon_kgC: totalCarbonLoss,
        trees: totalTreesRemoved
      }
    }
    
    return impact
  }

  const handleSimulate = async () => {
    // Only disallow if there are no plantings AND no removals
    if (totalTreesPlanted === 0 && removals.length === 0) {
      setError('Please add at least one tree planting or tree removal')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const yearsList = [0, 5, 10, 20]
      
      // Get baseline summaries for each year (needed for removal calculations)
      const baselineSummaries: Record<string, any> = {}
      for (const year of yearsList) {
        const summary = await getSummary(year, 'hybrid')
        baselineSummaries[year.toString()] = {
          num_trees: summary.num_trees,
          mean_dbh_cm: summary.mean_dbh_cm,
          total_carbon_kgC: summary.total_carbon_kgC,
        }
      }
      
      // Simulate plantings (only if there are plantings)
      let plantingResult: any = {
        baseline_by_year: baselineSummaries,
        cohort_by_year: {} as Record<string, any>,
        scenario_by_year: {} as Record<string, any>,
      }
      
      if (totalTreesPlanted > 0) {
        const plantingGroups: PlantingGroup[] = plantings.filter(p => p.species && p.count > 0)

        plantingResult = await simulateScenario({
          years_list: yearsList,
          plantings: plantingGroups,
        })
      } else {
        // No plantings, so cohort is empty for all years
        for (const year of yearsList) {
          plantingResult.cohort_by_year[year.toString()] = {
            num_trees: 0,
            total_carbon_kgC: 0,
            mean_dbh_cm: 0,
          }
        }
      }

      // Calculate removal impact
      const removalImpact = removals.length > 0 
        ? await calculateRemovalImpact(yearsList)
        : Object.fromEntries(yearsList.map(y => [y.toString(), { carbon_kgC: 0, trees: 0 }]))

      // Combine planting and removal results
      const combinedResult = {
        ...plantingResult,
        scenario_by_year: {} as Record<string, any>,
        delta_by_year: {} as Record<string, any>,
        removal_impact: removalImpact, // Store removal impact for display
      }

      for (const year of yearsList) {
        const yearStr = year.toString()
        const baseline = baselineSummaries[yearStr] || plantingResult.baseline_by_year[yearStr]
        const cohort = plantingResult.cohort_by_year[yearStr] || { num_trees: 0, total_carbon_kgC: 0, mean_dbh_cm: 0 }
        const removal = removalImpact[yearStr] || { carbon_kgC: 0, trees: 0 }

        // Calculate combined scenario: baseline + plantings - removals
        const baselineCarbon = baseline?.total_carbon_kgC || 0
        const plantingCarbon = cohort?.total_carbon_kgC || 0
        const removalCarbon = removal?.carbon_kgC || 0
        
        // Scenario carbon = baseline + what we plant - what we remove
        const scenarioCarbon = baselineCarbon + plantingCarbon - removalCarbon
        
        const combinedScenario = {
          num_trees: Math.max(0, (baseline?.num_trees || 0) + (cohort?.num_trees || 0) - (removal?.trees || 0)),
          total_carbon_kgC: Math.max(0, scenarioCarbon),
          mean_dbh_cm: baseline?.mean_dbh_cm || 0, // Simplified - would need weighted average in production
        }

        combinedResult.scenario_by_year[yearStr] = combinedScenario

        // Calculate delta (change from baseline) = plantings - removals
        // This represents the net change: positive if plantings > removals, negative if removals > plantings
        const deltaCarbon = plantingCarbon - removalCarbon
        
        combinedResult.delta_by_year[yearStr] = {
          num_trees: (cohort?.num_trees || 0) - (removal?.trees || 0),
          total_carbon_kgC: deltaCarbon,
          mean_dbh_cm: combinedScenario.mean_dbh_cm - (baseline?.mean_dbh_cm || 0),
        }
      }

      setScenarioResult(combinedResult)
    } catch (err: any) {
      setError(err.message || 'Failed to simulate scenario')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!scenarioName.trim()) {
      setError('Please enter a scenario name')
      return
    }

    const newScenario = {
      name: scenarioName,
      data: {
        plantings,
        removals,
        carbonSequestration,
        biodiversityImpact,
      },
    }

    const updated = [...savedScenarios, newScenario]
    setSavedScenarios(updated)
    localStorage.setItem('savedScenarios', JSON.stringify(updated))
    setScenarioName('')
  }

  const loadScenario = (scenario: any) => {
    // Handle migration from old format
    if (scenario.data.plantings) {
      setPlantings(scenario.data.plantings)
    } else if (scenario.data.speciesMix) {
      // Old format: convert speciesMix to plantings
      const plot = scenario.data.plot || 'Middle'
      const initialDbh = scenario.data.initialDbh || 5.0
      const migratedPlantings: PlantingGroup[] = scenario.data.speciesMix
        .filter((item: any) => item.species && (item.count > 0 || (item.percent && scenario.data.totalTrees)))
        .map((item: any) => ({
          plot: plot as 'Upper' | 'Middle' | 'Lower',
          species: item.species,
          dbh_cm: initialDbh,
          count: item.count || Math.round((scenario.data.totalTrees || 100) * (item.percent / 100)),
        }))
      setPlantings(migratedPlantings)
    }
    if (scenario.data.removals) setRemovals(scenario.data.removals)
    if (scenario.data.carbonSequestration !== undefined) setCarbonSequestration(scenario.data.carbonSequestration)
    if (scenario.data.biodiversityImpact !== undefined) setBiodiversityImpact(scenario.data.biodiversityImpact)
  }

  const incrementNumber = (setter: (val: number | '') => void, current: number | '', step: number = 1) => {
    const num = typeof current === 'number' ? current : 0
    setter(num + step)
  }

  const decrementNumber = (setter: (val: number | '') => void, current: number | '', step: number = 1) => {
    const num = typeof current === 'number' ? current : 0
    setter(Math.max(0, num - step))
  }

  // Prepare chart data - ensure removals are properly reflected
  const chartData = useMemo(() => {
    if (!scenarioResult) return []
    
    return [0, 5, 10, 20].map(year => {
      const yearStr = year.toString()
      const baseline = scenarioResult.baseline_by_year[yearStr]?.total_carbon_kgC || 0
      const scenario = scenarioResult.scenario_by_year[yearStr]?.total_carbon_kgC || 0
      
      return {
        years_ahead: year,
        baseline,
        scenario: Math.max(0, scenario), // Ensure non-negative, removals will make this lower than baseline
      }
    })
  }, [scenarioResult])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Forest Modification</h1>
        <p className="text-[var(--text-muted)]">Simulate tree planting and removal scenarios to understand their impact on carbon storage</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Modification Builder */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="font-semibold mb-6 text-lg">Modification Builder</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Planting Section */}
              <div className="pb-6 border-b border-[var(--border)]">
                <h3 className="font-semibold mb-4 text-[var(--teal-600)] flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Tree Planting
                </h3>
                
                <div className="space-y-4">
                  {/* Planting Species */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Species to Plant</label>
                    <div className="relative">
                      <select
                        value={plantingSpecies}
                        onChange={(e) => setPlantingSpecies(e.target.value)}
                        className="input appearance-none pr-8"
                      >
                        <option value="">Select species</option>
                        {AVAILABLE_SPECIES.map(species => (
                          <option key={species} value={species}>
                            {species.charAt(0).toUpperCase() + species.slice(1)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  {/* Planting Plot */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Plot Location</label>
                    <div className="relative">
                      <select
                        value={plantingPlot}
                        onChange={(e) => setPlantingPlot(e.target.value as 'Upper' | 'Middle' | 'Lower')}
                        className="input appearance-none pr-8"
                      >
                        <option value="Upper">Upper</option>
                        <option value="Middle">Middle</option>
                        <option value="Lower">Lower</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  {/* Planting DBH */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Initial DBH (cm)</label>
                    <div className="number-input">
                      <button
                        type="button"
                        onClick={() => decrementNumber(setPlantingDbh, plantingDbh, 0.1)}
                        className="rounded-l-lg rounded-r-none"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        value={plantingDbh}
                        onChange={(e) => {
                          const value = e.target.value
                          setPlantingDbh(value === '' ? '' : parseFloat(value) || '')
                        }}
                        className="rounded-none border-x-0"
                      />
                      <button
                        type="button"
                        onClick={() => incrementNumber(setPlantingDbh, plantingDbh, 0.1)}
                        className="rounded-r-lg rounded-l-none"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Planting Count */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Trees</label>
                    <div className="number-input">
                      <button
                        type="button"
                        onClick={() => decrementNumber(setPlantingCount, plantingCount)}
                        className="rounded-l-lg rounded-r-none"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={plantingCount}
                        onChange={(e) => {
                          const value = e.target.value
                          setPlantingCount(value === '' ? '' : parseInt(value) || '')
                        }}
                        className="rounded-none border-x-0"
                      />
                      <button
                        type="button"
                        onClick={() => incrementNumber(setPlantingCount, plantingCount)}
                        className="rounded-r-lg rounded-l-none"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Add Planting Button */}
                  <button
                    onClick={addPlanting}
                    disabled={!plantingSpecies || plantingDbh === '' || plantingCount === ''}
                    className="w-full btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Planting Group
                  </button>

                  {/* Current Plantings List */}
                  {plantings.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <label className="block text-sm font-medium mb-2">Current Plantings</label>
                      <div className="space-y-2">
                        {plantings.map((planting, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-[var(--bg-alt)] rounded-lg">
                            <div className="text-sm">
                              <span className="font-medium">{planting.count} × </span>
                              <span className="capitalize">{planting.species}</span>
                              <span className="text-[var(--text-muted)]"> • {planting.plot} • DBH: {planting.dbh_cm}cm</span>
                            </div>
                            <button
                              onClick={() => removePlanting(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm text-[var(--text-muted)]">
                        Total trees: {totalTreesPlanted}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Removal Section */}
              <div className="pb-6 border-b border-[var(--border)]">
                <h3 className="font-semibold mb-4 text-[var(--accent)] flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Tree Removal (Cutting)
                </h3>
                
                <div className="space-y-4">
                  {/* Removal Species */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Species to Remove</label>
                    <div className="relative">
                      <select
                        value={removalSpecies}
                        onChange={(e) => setRemovalSpecies(e.target.value)}
                        className="input appearance-none pr-8"
                      >
                        <option value="">Select species</option>
                        {AVAILABLE_SPECIES.map(species => (
                          <option key={species} value={species}>
                            {species.charAt(0).toUpperCase() + species.slice(1)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  {/* Removal Plot */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Plot Location</label>
                    <div className="relative">
                      <select
                        value={removalPlot}
                        onChange={(e) => setRemovalPlot(e.target.value as 'Upper' | 'Middle' | 'Lower')}
                        className="input appearance-none pr-8"
                      >
                        <option value="Upper">Upper</option>
                        <option value="Middle">Middle</option>
                        <option value="Lower">Lower</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  {/* Removal DBH */}
                  <div>
                    <label className="block text-sm font-medium mb-2">DBH to Remove (cm)</label>
                    <div className="number-input">
                      <button
                        type="button"
                        onClick={() => decrementNumber(setRemovalDbh, removalDbh, 0.1)}
                        className="rounded-l-lg rounded-r-none"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        value={removalDbh}
                        onChange={(e) => {
                          const value = e.target.value
                          setRemovalDbh(value === '' ? '' : parseFloat(value) || '')
                        }}
                        className="rounded-none border-x-0"
                      />
                      <button
                        type="button"
                        onClick={() => incrementNumber(setRemovalDbh, removalDbh, 0.1)}
                        className="rounded-r-lg rounded-l-none"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Removal Count */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Trees</label>
                    <div className="number-input">
                      <button
                        type="button"
                        onClick={() => decrementNumber(setRemovalCount, removalCount)}
                        className="rounded-l-lg rounded-r-none"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={removalCount}
                        onChange={(e) => {
                          const value = e.target.value
                          setRemovalCount(value === '' ? '' : parseInt(value) || '')
                        }}
                        className="rounded-none border-x-0"
                      />
                      <button
                        type="button"
                        onClick={() => incrementNumber(setRemovalCount, removalCount)}
                        className="rounded-r-lg rounded-l-none"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Add Removal Button */}
                  <button
                    onClick={addRemoval}
                    disabled={!removalSpecies || removalDbh === '' || removalCount === ''}
                    className="w-full btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Removal Group
                  </button>

                  {/* Removal List */}
                  {removals.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <label className="block text-sm font-medium mb-2">Removal Groups</label>
                      {removals.map((removal, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
                          <div className="text-sm">
                            <div className="font-medium">{removal.count} trees</div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {removal.species} • {removal.plot} • {removal.dbh_cm} cm DBH
                            </div>
                          </div>
                          <button
                            onClick={() => removeRemoval(index)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle Switches */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Carbon Sequestration</label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={carbonSequestration}
                      onChange={(e) => setCarbonSequestration(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Biodiversity Impact</label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={biodiversityImpact}
                      onChange={(e) => setBiodiversityImpact(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Simulate Button */}
              <button
                onClick={handleSimulate}
                disabled={loading || (totalTreesPlanted === 0 && removals.length === 0)}
                className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Simulate Modification
                  </>
                )}
              </button>

              {/* Save Section */}
              <div className="pt-4 border-t border-[var(--border)]">
                <input
                  type="text"
                  placeholder="Scenario name"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="input mb-2"
                />
                <button
                  onClick={handleSave}
                  className="w-full btn btn-secondary flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Scenario
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Projected Carbon Storage Graph */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="font-semibold mb-6 text-lg">Projected Carbon Storage Over Time</h2>
            
            {scenarioResult ? (
              <div className="space-y-6">
                {/* Summary Breakdown */}
                {(totalTreesPlanted > 0 || removals.length > 0) && (
                  <div className="p-4 bg-[var(--bg-alt)] rounded-2xl border border-[var(--border)]">
                    <h3 className="font-semibold mb-3 text-sm">Modification Summary (20 years)</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[var(--text-muted)]">Plantings: </span>
                        <span className="font-medium text-[var(--teal-600)]">
                          +{scenarioResult.cohort_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Removals: </span>
                        <span className="font-medium text-red-600">
                          -{(scenarioResult.removal_impact?.['20']?.carbon_kgC || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20">
                    <p className="text-sm text-[var(--text-muted)] mb-1">Total Carbon (20 years)</p>
                    <p className="text-xl font-semibold">
                      {scenarioResult.scenario_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </p>
                  </div>
                  <div className="p-4 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20">
                    <p className="text-sm text-[var(--text-muted)] mb-1">CO₂e (20 years)</p>
                    <p className="text-xl font-semibold">
                      {(scenarioResult.scenario_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂e
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${
                    (scenarioResult.delta_by_year['20']?.total_carbon_kgC || 0) >= 0
                      ? 'bg-[var(--secondary-light)] border-[var(--secondary)]/20'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <p className="text-sm text-[var(--text-muted)] mb-1">Net Change (vs Baseline)</p>
                    <p className={`text-xl font-semibold ${
                      (scenarioResult.delta_by_year['20']?.total_carbon_kgC || 0) >= 0
                        ? 'text-[var(--secondary)]'
                        : 'text-red-600'
                    }`}>
                      {scenarioResult.delta_by_year['20']?.total_carbon_kgC >= 0 ? '+' : ''}
                      {scenarioResult.delta_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {scenarioResult.delta_by_year['20']?.total_carbon_kgC >= 0 ? 'Increase' : 'Decrease'}
                    </p>
                  </div>
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="years_ahead" 
                      stroke="#64748b"
                      label={{ value: 'Years Ahead', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      stroke="#64748b"
                      label={{ value: 'Tons CO₂e', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => (value / 1000).toFixed(0)}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => `${(value / 1000).toFixed(1)} tCO₂e`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="baseline" 
                      stroke="var(--text-muted)" 
                      strokeWidth={2} 
                      name="Baseline" 
                      dot={{ fill: 'var(--text-muted)', r: 4 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="scenario" 
                      stroke="var(--teal-500)" 
                      strokeWidth={3} 
                      name="Modified Forest" 
                      dot={{ fill: 'var(--teal-500)', r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-16 text-[var(--text-muted)]">
                Create a modification scenario to see projected carbon storage
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Saved Scenarios</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedScenarios.map((scenario, index) => (
              <button
                key={index}
                onClick={() => loadScenario(scenario)}
                className="text-left p-4 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-alt)] transition-all"
              >
                <div className="font-medium mb-1">{scenario.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {scenario.data.plantings ? scenario.data.plantings.reduce((sum: number, p: PlantingGroup) => sum + p.count, 0) : 
                   scenario.data.speciesMix ? scenario.data.speciesMix.reduce((sum: number, item: any) => sum + (item.count || 0), 0) : 0} trees planted
                  {scenario.data.removals?.length > 0 && ` • ${scenario.data.removals.reduce((sum: number, r: RemovalGroup) => sum + r.count, 0)} trees removed`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
