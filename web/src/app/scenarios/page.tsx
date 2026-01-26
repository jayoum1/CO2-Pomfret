'use client'

import { useState, useEffect, useMemo } from 'react'
import { simulateScenario, PlantingGroup, getSummary, getRemovalOptions, RemovalOptions, getDbhBins, DbhBin, getPlantingDbhBins, PlantingDbhBin } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, X, Save, Loader2, Play, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const CO2E_FACTOR = 3.667

// Available tree species based on forest data
// Includes only species with ≥5 trees AND baseline growth curves for reliable simulation
// See SPECIES_UI_RECOMMENDATIONS.md for full analysis
const AVAILABLE_SPECIES = [
  'red oak',
  'sugar maple',
  'white pine',
  'red maple',
  'black birch',
  'musclewood',
  'norway maple',
  'beech',
  'mockernut hickory',
  'shagbark hickory',
  'pignut hickory',
] as const

// Species available per plot (based on actual forest data)
// Used to filter removal options based on selected plot
// Only includes species from AVAILABLE_SPECIES that actually exist in each plot
const SPECIES_BY_PLOT: Record<'Upper' | 'Middle' | 'Lower', string[]> = {
  Upper: ['sugar maple', 'norway maple', 'red maple'],
  Middle: ['sugar maple', 'red oak', 'mockernut hickory', 'beech', 'pignut hickory', 'black birch', 'norway maple', 'red maple'],
  Lower: ['black birch', 'musclewood', 'sugar maple', 'red oak', 'white pine', 'shagbark hickory', 'red maple', 'beech', 'mockernut hickory', 'pignut hickory', 'norway maple'],
}

// Maximum number of trees available for removal by plot and species
// Based on actual tree counts in the forest dataset
const MAX_TREES_BY_PLOT_SPECIES: Record<string, Record<string, number>> = {
  Upper: {
    'norway maple': 15,
    'red maple': 2,
    'sugar maple': 104,
  },
  Middle: {
    'beech': 6,
    'black birch': 1,
    'mockernut hickory': 8,
    'norway maple': 1,
    'pignut hickory': 3,
    'red maple': 1,
    'red oak': 12,
    'sugar maple': 89,
  },
  Lower: {
    'beech': 5,
    'black birch': 53,
    'mockernut hickory': 2,
    'musclewood': 46,
    'norway maple': 1,
    'pignut hickory': 3,
    'red maple': 6,
    'red oak': 19,
    'shagbark hickory': 7,
    'sugar maple': 29,
    'white pine': 10,
  },
}

interface RemovalGroup {
  plot: 'Upper' | 'Middle' | 'Lower'
  species: string
  dbh_bin: string  // Changed from dbh_cm to dbh_bin (e.g., "0-10", "10-20", "120+")
  count: number
}

export default function Scenarios() {
  // Planting state
  const [plantings, setPlantings] = useState<PlantingGroup[]>([])
  const [plantingPlot, setPlantingPlot] = useState<'Upper' | 'Middle' | 'Lower'>('Middle')
  const [plantingSpecies, setPlantingSpecies] = useState<string>('')
  const [plantingDbhBin, setPlantingDbhBin] = useState<string>('')
  const [plantingDbhOverride, setPlantingDbhOverride] = useState<number | ''>('') // Optional override within bin
  const [plantingCount, setPlantingCount] = useState<number | ''>(10)
  const [advancedMode, setAdvancedMode] = useState(false) // For allowing >20 cm planting
  const [plantingDbhBins, setPlantingDbhBins] = useState<PlantingDbhBin[]>([])
  
  // Removal state
  const [removals, setRemovals] = useState<RemovalGroup[]>([])
  const [removalPlot, setRemovalPlot] = useState<'Upper' | 'Middle' | 'Lower'>('Middle')
  const [removalSpecies, setRemovalSpecies] = useState<string>('')
  const [removalDbhBin, setRemovalDbhBin] = useState<string>('')
  const [removalCount, setRemovalCount] = useState<number | ''>(1)
  
  // Removal options state
  const [removalOptions, setRemovalOptions] = useState<RemovalOptions | null>(null)
  const [dbhBins, setDbhBins] = useState<DbhBin[]>([])
  const [loadingRemovalOptions, setLoadingRemovalOptions] = useState(false)
  
  const [scenarioResult, setScenarioResult] = useState<any>(null)
  const [baselineData, setBaselineData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [baselineLoading, setBaselineLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedScenarios, setSavedScenarios] = useState<Array<{ name: string; data: any }>>([])
  const [scenarioName, setScenarioName] = useState<string>('')
  const [carbonSequestration, setCarbonSequestration] = useState(true)
  const [biodiversityImpact, setBiodiversityImpact] = useState(true)
  const [simulationMode, setSimulationMode] = useState<'baseline' | 'baseline_stochastic'>('baseline')
  const [selectedYear, setSelectedYear] = useState<number>(20) // For toggling metrics by year

  // Filter available species for removal based on selected plot
  const availableRemovalSpecies = useMemo(() => {
    return AVAILABLE_SPECIES.filter(species => 
      SPECIES_BY_PLOT[removalPlot].includes(species)
    )
  }, [removalPlot])

  // Load DBH bins on mount
  useEffect(() => {
    async function loadDbhBins() {
      try {
        const bins = await getDbhBins()
        setDbhBins(bins)
      } catch (err) {
        console.error('Error loading DBH bins:', err)
      }
    }
    loadDbhBins()
  }, [])

  // Load planting DBH bins on mount
  useEffect(() => {
    async function loadPlantingDbhBins() {
      try {
        const bins = await getPlantingDbhBins()
        setPlantingDbhBins(bins)
      } catch (err) {
        console.error('Error loading planting DBH bins:', err)
      }
    }
    loadPlantingDbhBins()
  }, [])

  // Load removal options when plot and species are selected
  useEffect(() => {
    async function loadRemovalOptions() {
      if (!removalPlot || !removalSpecies) {
        setRemovalOptions(null)
        setRemovalDbhBin('')
        setRemovalCount(1)
        return
      }
      
      try {
        setLoadingRemovalOptions(true)
        setError(null) // Clear any previous errors
        const response = await getRemovalOptions(removalPlot, removalSpecies)
        console.log('Removal options response:', response)
        console.log('Response bins:', response?.bins)
        console.log('Response options keys:', response?.options ? Object.keys(response.options) : 'none')
        
        // Accept response if it has options and bins, regardless of success field
        if (response && response.options && Array.isArray(response.bins)) {
          setRemovalOptions(response)
          // Reset DBH bin selection when options change
          setRemovalDbhBin('')
          setRemovalCount(1)
          console.log(`Loaded ${response.bins.length} DBH bins for ${removalSpecies} in ${removalPlot}`)
          const binsWithTrees = response.bins.filter((bin: string) => (response.options[bin]?.count || 0) > 0)
          console.log(`Bins with available trees: ${binsWithTrees.length}`)
        } else {
          console.error('Invalid removal options response:', response)
          setRemovalOptions(null)
          setError(`Failed to load removal options for ${removalSpecies} in ${removalPlot} plot`)
        }
      } catch (err: any) {
        console.error('Error loading removal options:', err)
        setRemovalOptions(null)
        setError(`Error loading removal options: ${err.message || 'Unknown error'}`)
      } finally {
        setLoadingRemovalOptions(false)
      }
    }
    
    loadRemovalOptions()
  }, [removalPlot, removalSpecies])

  // Get maximum trees available for removal based on selected DBH bin
  const maxRemovalTrees = useMemo(() => {
    if (!removalOptions || !removalDbhBin) return null
    return removalOptions.options[removalDbhBin]?.count || null
  }, [removalOptions, removalDbhBin])

  // Reset removal species if current selection is not available in new plot
  useEffect(() => {
    if (removalSpecies && !(availableRemovalSpecies as string[]).includes(removalSpecies)) {
      setRemovalSpecies('')
      setRemovalDbhBin('')
      setRemovalCount(1)
    }
  }, [removalPlot, removalSpecies, availableRemovalSpecies])

  // Reset removal count if it exceeds maximum when bin changes
  useEffect(() => {
    if (maxRemovalTrees !== null && removalCount !== '' && typeof removalCount === 'number') {
      if (removalCount > maxRemovalTrees) {
        setRemovalCount(maxRemovalTrees)
      }
    }
  }, [removalDbhBin, maxRemovalTrees, removalCount])

  // Load baseline data on mount
  useEffect(() => {
    async function loadBaselineData() {
      try {
        setBaselineLoading(true)
        const yearsList = [0, 5, 10, 20]
        const baselineSummaries: Record<string, any> = {}
        
        for (const year of yearsList) {
          const summary = await getSummary(year, 'baseline')
          baselineSummaries[year.toString()] = {
            num_trees: summary.num_trees,
            mean_dbh_cm: summary.mean_dbh_cm,
            total_carbon_kgC: summary.total_carbon_kgC,
          }
        }
        
        setBaselineData({
          baseline_by_year: baselineSummaries,
          scenario_by_year: baselineSummaries, // Initially same as baseline
        })
      } catch (err: any) {
        console.error('Error loading baseline data:', err)
      } finally {
        setBaselineLoading(false)
      }
    }
    
    loadBaselineData()
  }, [])


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('savedScenarios')
      if (saved) {
        setSavedScenarios(JSON.parse(saved))
      }
    }
  }, [])

  // Get current planting DBH value (from bin midpoint or override)
  const getPlantingDbhValue = useMemo(() => {
    if (!plantingDbhBin) return null
    
    const bin = plantingDbhBins.find(b => b.label === plantingDbhBin)
    if (!bin) return null
    
    // Use override if provided, otherwise use midpoint
    if (plantingDbhOverride !== '' && typeof plantingDbhOverride === 'number') {
      // Validate override is within bin range
      const min = bin.min_dbh
      const max = bin.max_dbh || 200
      return Math.max(min, Math.min(max, plantingDbhOverride))
    }
    
    return bin.midpoint
  }, [plantingDbhBin, plantingDbhOverride, plantingDbhBins])

  const addPlanting = () => {
    if (plantingSpecies && plantingDbhBin && plantingCount !== '') {
      const dbhValue = getPlantingDbhValue
      
      if (dbhValue === null) {
        setError('Invalid DBH bin selected')
        return
      }
      
      // Validation: prevent planting >20 cm unless advanced mode
      const bin = plantingDbhBins.find(b => b.label === plantingDbhBin)
      if (bin && !advancedMode && bin.max_dbh !== null && bin.max_dbh > 20) {
        setError('Planting trees >20 cm DBH requires Advanced Mode. Enable it to plant larger trees.')
        return
      }
      
      if (dbhValue > 20 && !advancedMode) {
        setError('Planting trees >20 cm DBH requires Advanced Mode. Enable it to plant larger trees.')
        return
      }
      
      setPlantings([...plantings, {
        plot: plantingPlot,
        species: plantingSpecies,
        dbh_cm: dbhValue,
        count: plantingCount as number,
      }])
      // Keep species and plot selected, reset only DBH bin and count
      setPlantingDbhBin('')
      setPlantingDbhOverride('')
      setPlantingCount(10)
      setError(null) // Clear any previous errors
    }
  }

  const removePlanting = (index: number) => {
    setPlantings(plantings.filter((_, i) => i !== index))
  }

  const totalTreesPlanted = useMemo(() => {
    return plantings.reduce((sum, item) => sum + (item.count || 0), 0)
  }, [plantings])

  const addRemoval = () => {
    if (removalSpecies && removalDbhBin && removalCount !== '') {
      const count = removalCount as number
      const maxAllowed = maxRemovalTrees !== null ? maxRemovalTrees : Infinity
      
      // Validate count doesn't exceed maximum
      if (count > maxAllowed) {
        setError(`Cannot remove more than ${maxAllowed} ${removalSpecies} tree${maxAllowed !== 1 ? 's' : ''} in ${removalDbhBin} cm DBH bin from ${removalPlot} plot`)
        return
      }
      
      if (count <= 0) {
        setError('Count must be at least 1')
        return
      }
      
      setRemovals([...removals, {
        plot: removalPlot,
        species: removalSpecies,
        dbh_bin: removalDbhBin,
        count: count,
      }])
      // Keep species and plot selected, reset only DBH bin and count
      setRemovalDbhBin('')
      setRemovalCount(1)
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
    
    // Load removal options for all removal groups to get mean carbon values
    const removalOptionsMap: Record<string, RemovalOptions> = {}
    
    for (const removal of removals) {
      const key = `${removal.plot}_${removal.species}`
      if (!removalOptionsMap[key]) {
        try {
          const options = await getRemovalOptions(removal.plot, removal.species)
          removalOptionsMap[key] = options
        } catch (err) {
          console.error(`Error loading removal options for ${removal.plot}/${removal.species}:`, err)
        }
      }
    }
    
    for (const year of yearsList) {
      let totalCarbonLoss = 0
      let totalTreesRemoved = removals.reduce((sum, r) => sum + r.count, 0)
      
      // For each removal group, calculate carbon that would have been stored at this year if trees weren't removed
      for (const removal of removals) {
        const key = `${removal.plot}_${removal.species}`
        const options = removalOptionsMap[key]
        
        if (options && options.options[removal.dbh_bin]) {
          // Use mean carbon from the bin
          const binData = options.options[removal.dbh_bin]
          const meanCarbon = binData.mean_carbon || 0
          
          // For future years, estimate growth using a simple growth factor
          // This approximates how carbon would increase as trees grow
          const growthFactor = 1 + (year * 0.02) // ~2% carbon increase per year
          const futureCarbon = meanCarbon * growthFactor
          
          totalCarbonLoss += futureCarbon * removal.count
        } else {
          // Fallback: estimate from bin midpoint
          const [minStr, maxStr] = removal.dbh_bin.replace('+', '').split('-')
          const minDbh = parseFloat(minStr) || 0
          const maxDbh = maxStr ? parseFloat(maxStr) : minDbh + 10
          const midDbh = (minDbh + maxDbh) / 2
          
          // Simplified carbon estimation
          const a = 0.15
          const b = 2.4
          const currentCarbon = a * Math.pow(midDbh, b)
          const growthFactor = 1 + (year * 0.02)
          const futureCarbon = currentCarbon * growthFactor
          
          totalCarbonLoss += futureCarbon * removal.count
        }
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
        const summary = await getSummary(year, simulationMode)
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
          mode: simulationMode,
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

  const handleDeleteScenario = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation() // Prevent loading the scenario when clicking delete
    if (confirm(`Delete scenario "${savedScenarios[index].name}"?`)) {
      const updated = savedScenarios.filter((_, i) => i !== index)
      setSavedScenarios(updated)
      localStorage.setItem('savedScenarios', JSON.stringify(updated))
    }
  }

  const loadScenario = (scenario: any) => {
    // Handle migration from old format
    if (scenario.data.plantings) {
      // Plantings already have dbh_cm, which is fine for backward compatibility
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
    if (scenario.data.removals) {
      // Migrate old removals with dbh_cm to dbh_bin format
      const migratedRemovals: RemovalGroup[] = scenario.data.removals.map((removal: any) => {
        if (removal.dbh_cm !== undefined && !removal.dbh_bin) {
          // Convert dbh_cm to dbh_bin
          const dbh = removal.dbh_cm
          let binLabel = '120+'
          if (dbh < 10) binLabel = '0-10'
          else if (dbh < 20) binLabel = '10-20'
          else if (dbh < 30) binLabel = '20-30'
          else if (dbh < 40) binLabel = '30-40'
          else if (dbh < 50) binLabel = '40-50'
          else if (dbh < 60) binLabel = '50-60'
          else if (dbh < 70) binLabel = '60-70'
          else if (dbh < 80) binLabel = '70-80'
          else if (dbh < 90) binLabel = '80-90'
          else if (dbh < 100) binLabel = '90-100'
          else if (dbh < 110) binLabel = '100-110'
          else if (dbh < 120) binLabel = '110-120'
          
          return {
            ...removal,
            dbh_bin: binLabel
          }
        }
        return removal
      })
      setRemovals(migratedRemovals)
    }
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
    const dataToUse = scenarioResult || baselineData
    if (!dataToUse) return []
    
    return [0, 5, 10, 20].map(year => {
      const yearStr = year.toString()
      const baseline = dataToUse.baseline_by_year[yearStr]?.total_carbon_kgC || 0
      const scenario = dataToUse.scenario_by_year[yearStr]?.total_carbon_kgC || 0
      
      return {
        years_ahead: year,
        baseline: baseline * 3.667, // Convert to CO2e
        scenario: scenarioResult ? Math.max(0, scenario * 3.667) : baseline * 3.667, // Convert to CO2e, ensure non-negative
      }
    })
  }, [scenarioResult, baselineData])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Forest Modification</h1>
        <p className="text-[var(--text-muted)]">Simulate tree planting and removal scenarios to understand their impact on carbon storage</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Modification Builder */}
        <div className="lg:col-span-1">
          <div className="card flex flex-col left-panel-container" style={{ height: '825px' }}>
            <h2 className="font-semibold mb-6 text-lg flex-shrink-0">Modification Builder</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex-shrink-0">
                {error}
              </div>
            )}

            <div 
              className="space-y-6 flex-1 overflow-y-auto pr-2"
              style={{ minHeight: 0 }}
            >
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

                  {/* Planting DBH Bin */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Initial DBH Size Class
                    </label>
                    <div className="relative">
                      <select
                        value={plantingDbhBin}
                        onChange={(e) => {
                          setPlantingDbhBin(e.target.value)
                          setPlantingDbhOverride('') // Reset override when bin changes
                        }}
                        className="input appearance-none pr-8"
                        disabled={!plantingSpecies || plantingDbhBins.length === 0}
                      >
                        <option value="">
                          {plantingDbhBins.length === 0 ? 'Loading bins...' : 'Select DBH size class'}
                        </option>
                        {plantingDbhBins.map(bin => {
                          const isDisabled = !advancedMode && bin.max_dbh !== null && bin.max_dbh > 20
                          return (
                            <option 
                              key={bin.label} 
                              value={bin.label}
                              disabled={isDisabled}
                            >
                              {bin.label} cm ({bin.description})
                              {isDisabled && ' - Enable Advanced Mode'}
                            </option>
                          )
                        })}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                    {plantingDbhBin && (() => {
                      const bin = plantingDbhBins.find(b => b.label === plantingDbhBin)
                      if (!bin) return null
                      const currentDbh = getPlantingDbhValue
                      if (currentDbh === null) return null
                      return (
                        <div className="mt-2 p-2 bg-[var(--bg-alt)] rounded-lg text-xs">
                          <div className="text-[var(--text-muted)]">
                            DBH value: <span className="font-semibold text-[var(--text)]">{currentDbh.toFixed(1)} cm</span> {plantingDbhOverride === '' ? '(midpoint)' : '(custom)'}
                          </div>
                          <div className="text-[var(--text-muted)] mt-1">
                            Range: {bin.min_dbh}-{bin.max_dbh || '200'} cm • {bin.description}
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Advanced Mode Toggle */}
                  {plantingDbhBins.some(bin => bin.max_dbh !== null && bin.max_dbh > 20) && (
                    <div className="flex items-center gap-2 p-2 bg-[var(--bg-alt)] rounded-lg">
                      <input
                        type="checkbox"
                        id="advanced-mode"
                        checked={advancedMode}
                        onChange={(e) => setAdvancedMode(e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--border)] cursor-pointer"
                      />
                      <label htmlFor="advanced-mode" className="text-sm text-[var(--text-muted)] cursor-pointer">
                        Advanced Mode (allow planting trees &gt;20 cm DBH)
                      </label>
                    </div>
                  )}

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
                    disabled={!plantingSpecies || !plantingDbhBin || plantingCount === ''}
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

                  {/* Removal Species */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Species to Remove</label>
                    <div className="relative">
                      <select
                        value={removalSpecies}
                        onChange={(e) => setRemovalSpecies(e.target.value)}
                        className="input appearance-none pr-8"
                        disabled={availableRemovalSpecies.length === 0}
                      >
                        <option value="">
                          {availableRemovalSpecies.length === 0 
                            ? `No species available in ${removalPlot} plot` 
                            : 'Select species'}
                        </option>
                        {availableRemovalSpecies.map(species => (
                          <option key={species} value={species}>
                            {species.charAt(0).toUpperCase() + species.slice(1)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                    {availableRemovalSpecies.length > 0 && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {availableRemovalSpecies.length} species available in {removalPlot} plot
                      </p>
                    )}
                  </div>

                  {/* Removal DBH Bin */}
                  {removalSpecies && (
                    <div>
                      <label className="block text-sm font-medium mb-2">DBH Size Class</label>
                      {loadingRemovalOptions ? (
                        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading options...
                        </div>
                      ) : removalOptions ? (
                        <>
                          <div className="relative">
                            <select
                              value={removalDbhBin}
                              onChange={(e) => {
                                console.log('DBH bin selected:', e.target.value)
                                setRemovalDbhBin(e.target.value)
                              }}
                              className="input appearance-none pr-8 w-full cursor-pointer"
                              disabled={loadingRemovalOptions}
                              style={{ zIndex: 1 }}
                            >
                              <option value="">Select DBH size class</option>
                              {removalOptions.bins && removalOptions.bins.length > 0 ? (
                                removalOptions.bins.map(binLabel => {
                                  const binData = removalOptions.options[binLabel]
                                  const available = binData?.count || 0
                                  const isDisabled = available === 0
                                  return (
                                    <option 
                                      key={binLabel} 
                                      value={binLabel}
                                      disabled={isDisabled}
                                      style={isDisabled ? { color: '#94a3b8' } : {}}
                                    >
                                      {binLabel} cm {available === 0 ? '(0 available)' : `(${available} available)`}
                                    </option>
                                  )
                                })
                              ) : (
                                <option value="" disabled>No bins available</option>
                              )}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none z-0" />
                          </div>
                          {removalOptions.bins && removalOptions.bins.length > 0 && (
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              {removalOptions.bins.filter(bin => (removalOptions.options[bin]?.count || 0) > 0).length} of {removalOptions.bins.length} bins have available trees
                            </p>
                          )}
                          {removalDbhBin && removalOptions.options[removalDbhBin] && (
                            <div className="mt-2 p-2 bg-[var(--bg-alt)] rounded-lg text-xs">
                              <div className="text-[var(--text-muted)]">
                                Available in dataset: <span className="font-semibold text-[var(--text)]">{removalOptions.options[removalDbhBin].count} trees</span>
                              </div>
                              {removalOptions.options[removalDbhBin].mean_dbh > 0 && (
                                <div className="text-[var(--text-muted)] mt-1">
                                  Mean DBH: {removalOptions.options[removalDbhBin].mean_dbh.toFixed(1)} cm • 
                                  Mean Carbon: {removalOptions.options[removalDbhBin].mean_carbon.toFixed(2)} kg C
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : removalOptions === null && removalSpecies && !loadingRemovalOptions ? (
                        <div className="text-sm text-[var(--error)]">
                          Failed to load DBH size classes. {error && <span className="text-xs">({error})</span>}
                        </div>
                      ) : removalOptions === null && !removalSpecies ? (
                        <p className="text-sm text-[var(--text-muted)]">Select a species to see DBH size classes</p>
                      ) : null}
                    </div>
                  )}

                  {/* Removal Count */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Number of Trees
                      {maxRemovalTrees !== null && (
                        <span className="text-xs font-normal text-[var(--text-muted)] ml-2">
                          (max: {maxRemovalTrees})
                        </span>
                      )}
                    </label>
                    <div className="number-input">
                      <button
                        type="button"
                        onClick={() => {
                          const current = typeof removalCount === 'number' ? removalCount : 0
                          const newValue = Math.max(1, current - 1)
                          setRemovalCount(maxRemovalTrees !== null ? Math.min(newValue, maxRemovalTrees) : newValue)
                        }}
                        className="rounded-l-lg rounded-r-none"
                        disabled={!removalSpecies || !removalDbhBin || loadingRemovalOptions || (typeof removalCount === 'number' && removalCount <= 1)}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max={maxRemovalTrees !== null ? maxRemovalTrees : undefined}
                        value={removalCount}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '') {
                            setRemovalCount('')
                            return
                          }
                          const numValue = parseInt(value) || 1
                          if (maxRemovalTrees !== null) {
                            setRemovalCount(Math.min(Math.max(1, numValue), maxRemovalTrees))
                          } else {
                            setRemovalCount(Math.max(1, numValue))
                          }
                        }}
                        className="rounded-none border-x-0"
                        disabled={!removalSpecies || !removalDbhBin || loadingRemovalOptions}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const current = typeof removalCount === 'number' ? removalCount : 0
                          const newValue = current + 1
                          setRemovalCount(maxRemovalTrees !== null ? Math.min(newValue, maxRemovalTrees) : newValue)
                        }}
                        className="rounded-r-lg rounded-l-none"
                        disabled={!removalSpecies || !removalDbhBin || loadingRemovalOptions || (maxRemovalTrees !== null && typeof removalCount === 'number' && removalCount >= maxRemovalTrees)}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                    {maxRemovalTrees !== null && removalDbhBin && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Max removable: <span className="font-semibold">{maxRemovalTrees}</span> trees in {removalDbhBin} cm DBH bin
                      </p>
                    )}
                    {maxRemovalTrees !== null && typeof removalCount === 'number' && removalCount > maxRemovalTrees && (
                      <p className="text-xs text-[var(--error)] mt-1">
                        Cannot remove more than {maxRemovalTrees} tree{maxRemovalTrees !== 1 ? 's' : ''} in this DBH bin
                      </p>
                    )}
                  </div>

                  {/* Add Removal Button */}
                  <button
                    onClick={addRemoval}
                    disabled={!removalSpecies || !removalDbhBin || removalCount === ''}
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
                              {removal.species} • {removal.plot} • {removal.dbh_bin} cm DBH bin
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

              {/* Simulation Mode Selection */}
              <div className="space-y-2 pt-2">
                <label className="block text-sm font-medium">Simulation Mode</label>
                <select
                  value={simulationMode}
                  onChange={(e) => setSimulationMode(e.target.value as 'baseline' | 'baseline_stochastic')}
                  className="input"
                >
                  <option value="baseline">Baseline (default)</option>
                  <option value="baseline_stochastic">Visual mode (stochastic)</option>
                </select>
                {simulationMode === 'baseline_stochastic' && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Adds small random variation calibrated from historical residual spread; improves realism, not accuracy.
                  </p>
                )}
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
            
            {baselineLoading ? (
              <div className="text-center py-16 text-[var(--text-muted)]">
                Loading baseline data...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Year Selector for Metrics */}
                <div className="flex items-center justify-between p-3 bg-[var(--bg-alt)] rounded-2xl border border-[var(--border)]">
                  <span className="text-sm font-medium text-[var(--text-muted)]">View metrics for:</span>
                  <div className="flex gap-2">
                    {[0, 5, 10, 20].map((year) => (
                      <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`px-3 py-1.5 text-sm rounded-xl transition-all ${
                          selectedYear === year
                            ? 'bg-[var(--primary)] text-white shadow-md'
                            : 'bg-white text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--bg-alt)]'
                        }`}
                      >
                        {year} years
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary Breakdown - Always visible */}
                <div className="p-4 bg-[var(--bg-alt)] rounded-2xl border border-[var(--border)]">
                  <h3 className="font-semibold mb-3 text-sm">Modification Summary ({selectedYear} years)</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)]">Plantings: </span>
                      <span className="font-medium text-[var(--teal-600)]">
                        {scenarioResult 
                          ? `+${scenarioResult.cohort_by_year[selectedYear.toString()]?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : '+0'
                        } kg C
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Removals: </span>
                      <span className="font-medium text-red-600">
                        {scenarioResult
                          ? `-${(scenarioResult.removal_impact?.[selectedYear.toString()]?.carbon_kgC || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : '-0'
                        } kg C
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20">
                    <p className="text-sm text-[var(--text-muted)] mb-1">Total Carbon ({selectedYear} years)</p>
                    <p className="text-xl font-semibold">
                      {scenarioResult 
                        ? scenarioResult.scenario_by_year[selectedYear.toString()]?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : baselineData?.baseline_by_year[selectedYear.toString()]?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })
                      } kg C
                    </p>
                  </div>
                  <div className="p-4 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20">
                    <p className="text-sm text-[var(--text-muted)] mb-1">CO₂e ({selectedYear} years)</p>
                    <p className="text-xl font-semibold">
                      {scenarioResult
                        ? (scenarioResult.scenario_by_year[selectedYear.toString()]?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : (baselineData?.baseline_by_year[selectedYear.toString()]?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })
                      } kg CO₂e
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${
                    scenarioResult && (scenarioResult.delta_by_year[selectedYear.toString()]?.total_carbon_kgC || 0) >= 0
                      ? 'bg-[var(--secondary-light)] border-[var(--secondary)]/20'
                      : scenarioResult && (scenarioResult.delta_by_year[selectedYear.toString()]?.total_carbon_kgC || 0) < 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-[var(--secondary-light)] border-[var(--secondary)]/20'
                  }`}>
                    <p className="text-sm text-[var(--text-muted)] mb-1">Net Change (vs Baseline)</p>
                    {scenarioResult ? (
                      <>
                        <p className={`text-xl font-semibold ${
                          (scenarioResult.delta_by_year[selectedYear.toString()]?.total_carbon_kgC || 0) >= 0
                            ? 'text-[var(--secondary)]'
                            : 'text-red-600'
                        }`}>
                          {scenarioResult.delta_by_year[selectedYear.toString()]?.total_carbon_kgC >= 0 ? '+' : ''}
                          {scenarioResult.delta_by_year[selectedYear.toString()]?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {scenarioResult.delta_by_year[selectedYear.toString()]?.total_carbon_kgC >= 0 ? 'Increase' : 'Decrease'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-semibold text-[var(--secondary)]">
                          +0 kg C
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          No change
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 50, left: 70 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="years_ahead" 
                        stroke="#64748b"
                        tick={{ fill: '#64748b' }}
                        label={{ value: 'Years Ahead', position: 'outside', offset: 10 }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        tick={{ fill: '#64748b' }}
                        label={{ value: 'Tons CO₂e', angle: -90, position: 'insideLeft', offset: -15 }}
                        tickFormatter={(value) => (value / 1000).toFixed(0)}
                        domain={(() => {
                          if (!chartData || chartData.length === 0) return [0, 100]
                          const allValues = scenarioResult
                            ? [...chartData.map(d => d.baseline), ...chartData.map(d => d.scenario)]
                            : chartData.map(d => d.baseline)
                          const filtered = allValues.filter(v => v != null && !isNaN(v))
                          if (filtered.length === 0) return [0, 100]
                          const min = Math.min(...filtered)
                          const max = Math.max(...filtered)
                          const range = max - min
                          const padding = range * 0.05
                          return [Math.max(0, min - padding), max + padding]
                        })()}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => `${(value / 1000).toFixed(1)} tCO₂e`}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line 
                        type="monotone" 
                        dataKey="baseline" 
                        stroke="var(--text-muted)" 
                        strokeWidth={2} 
                        name="Baseline" 
                        dot={{ fill: 'var(--text-muted)', r: 4 }} 
                      />
                      {scenarioResult && (
                        <Line 
                          type="monotone" 
                          dataKey="scenario" 
                          stroke="var(--teal-500)" 
                          strokeWidth={3} 
                          name="Modified Forest" 
                          dot={{ fill: 'var(--teal-500)', r: 6 }} 
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
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
              <div
                key={index}
                className="relative group"
              >
                <button
                  onClick={() => loadScenario(scenario)}
                  className="w-full text-left p-4 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-alt)] transition-all"
                >
                  <div className="font-medium mb-1">{scenario.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {scenario.data.plantings ? scenario.data.plantings.reduce((sum: number, p: PlantingGroup) => sum + p.count, 0) : 
                     scenario.data.speciesMix ? scenario.data.speciesMix.reduce((sum: number, item: any) => sum + (item.count || 0), 0) : 0} trees planted
                    {scenario.data.removals?.length > 0 && ` • ${scenario.data.removals.reduce((sum: number, r: RemovalGroup) => sum + r.count, 0)} trees removed`}
                  </div>
                </button>
                <button
                  onClick={(e) => handleDeleteScenario(index, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete scenario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
