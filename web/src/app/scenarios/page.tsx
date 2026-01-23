'use client'

import { useState, useEffect, useMemo } from 'react'
import { simulateScenario, PlantingGroup } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, X, Save, Loader2, Play, ChevronDown, ChevronUp } from 'lucide-react'

const CO2E_FACTOR = 3.667

export default function Scenarios() {
  const [totalTrees, setTotalTrees] = useState<number | ''>(100)
  const [plot, setPlot] = useState<'Upper' | 'Middle' | 'Lower'>('Middle')
  const [initialDbh, setInitialDbh] = useState<number | ''>(5.0)
  const [speciesMix, setSpeciesMix] = useState<Array<{ species: string; percent: number }>>([
    { species: 'red oak', percent: 50 },
    { species: 'sugar maple', percent: 50 },
  ])
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

  const addSpeciesRow = () => {
    setSpeciesMix([...speciesMix, { species: '', percent: 0 }])
  }

  const removeSpeciesRow = (index: number) => {
    setSpeciesMix(speciesMix.filter((_, i) => i !== index))
  }

  const updateSpecies = (index: number, field: 'species' | 'percent', value: string | number) => {
    const updated = [...speciesMix]
    updated[index] = { ...updated[index], [field]: value }
    setSpeciesMix(updated)
  }

  const totalPercent = useMemo(() => {
    return speciesMix.reduce((sum, item) => sum + (item.percent || 0), 0)
  }, [speciesMix])

  const handleSimulate = async () => {
    if (totalTrees === '' || initialDbh === '' || totalPercent !== 100) {
      setError('Please fill in all fields and ensure species percentages total 100%')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const plantings: PlantingGroup[] = speciesMix
        .filter(item => item.species && item.percent > 0)
        .map(item => ({
          plot,
          species: item.species,
          dbh_cm: initialDbh as number,
          count: Math.round((totalTrees as number) * (item.percent / 100)),
        }))

      const result = await simulateScenario({
        years_list: [0, 5, 10, 20],
        plantings,
      })

      setScenarioResult(result)
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
        totalTrees,
        plot,
        initialDbh,
        speciesMix,
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
    setTotalTrees(scenario.data.totalTrees)
    setPlot(scenario.data.plot)
    setInitialDbh(scenario.data.initialDbh)
    setSpeciesMix(scenario.data.speciesMix)
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

  // Prepare chart data
  const chartData = scenarioResult ? [0, 5, 10, 20].map(year => ({
    years_ahead: year,
    baseline: scenarioResult.baseline_by_year[year.toString()]?.total_carbon_kgC || 0,
    scenario: scenarioResult.scenario_by_year[year.toString()]?.total_carbon_kgC || 0,
  })) : []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Scenario Builder */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="font-semibold mb-6 text-lg">Scenario Builder</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {/* Species Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Species Type</label>
                <input
                  type="text"
                  value={speciesMix[0]?.species || ''}
                  onChange={(e) => {
                    const updated = [...speciesMix]
                    if (updated[0]) {
                      updated[0].species = e.target.value
                    } else {
                      updated.push({ species: e.target.value, percent: 100 })
                    }
                    setSpeciesMix(updated)
                  }}
                  className="input"
                  placeholder="Enter species"
                />
              </div>

              {/* Total Trees */}
              <div>
                <label className="block text-sm font-medium mb-2">Total Trees</label>
                <div className="number-input">
                  <button
                    type="button"
                    onClick={() => decrementNumber(setTotalTrees, totalTrees)}
                    className="rounded-l-lg rounded-r-none"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={totalTrees}
                    onChange={(e) => {
                      const value = e.target.value
                      setTotalTrees(value === '' ? '' : parseInt(value) || '')
                    }}
                    className="rounded-none border-x-0"
                  />
                  <button
                    type="button"
                    onClick={() => incrementNumber(setTotalTrees, totalTrees)}
                    className="rounded-r-lg rounded-l-none"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Plot Location */}
              <div>
                <label className="block text-sm font-medium mb-2">Plot Location</label>
                <div className="relative">
                  <select
                    value={plot}
                    onChange={(e) => setPlot(e.target.value as 'Upper' | 'Middle' | 'Lower')}
                    className="input appearance-none pr-8"
                  >
                    <option value="Upper">Upper</option>
                    <option value="Middle">Middle</option>
                    <option value="Lower">Lower</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </div>

              {/* Initial DBH */}
              <div>
                <label className="block text-sm font-medium mb-2">Initial DBH (cm)</label>
                <div className="number-input">
                  <button
                    type="button"
                    onClick={() => decrementNumber(setInitialDbh, initialDbh, 0.1)}
                    className="rounded-l-lg rounded-r-none"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    value={initialDbh}
                    onChange={(e) => {
                      const value = e.target.value
                      setInitialDbh(value === '' ? '' : parseFloat(value) || '')
                    }}
                    className="rounded-none border-x-0"
                  />
                  <button
                    type="button"
                    onClick={() => incrementNumber(setInitialDbh, initialDbh, 0.1)}
                    className="rounded-r-lg rounded-l-none"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Species Mix */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Species Mix</label>
                  <button
                    onClick={addSpeciesRow}
                    className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {speciesMix.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Species name"
                        value={item.species}
                        onChange={(e) => updateSpecies(index, 'species', e.target.value)}
                        className="flex-1 input text-sm"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="%"
                        value={item.percent}
                        onChange={(e) => updateSpecies(index, 'percent', parseFloat(e.target.value) || 0)}
                        className="w-20 input text-sm"
                      />
              <button
                onClick={() => removeSpeciesRow(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-2xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
                    </div>
                  ))}
                </div>
                <div className={`mt-2 text-sm ${totalPercent === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  Total: {totalPercent}%
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
                disabled={loading || totalPercent !== 100}
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
                    Simulate Scenario
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
            <h2 className="font-semibold mb-6 text-lg">Projected Carbon Storage (over Time (Years))</h2>
            
            {scenarioResult ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
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
                      stroke="#94a3b8" 
                      strokeWidth={2} 
                      name="Baseline" 
                      dot={{ fill: '#94a3b8', r: 4 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="scenario" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      name="Scenario A" 
                      dot={{ fill: '#3b82f6', r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-16 text-[var(--text-muted)]">
                Create a scenario to see projected carbon storage
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
                  {scenario.data.totalTrees} trees • {scenario.data.plot} • {scenario.data.initialDbh} cm DBH
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
