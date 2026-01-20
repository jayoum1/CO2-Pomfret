'use client'

import { useState, useEffect } from 'react'
import { simulateScenario, PlantingGroup } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const CO2E_FACTOR = 3.667

export default function Scenarios() {
  const [totalTrees, setTotalTrees] = useState<number>(100)
  const [plot, setPlot] = useState<'Upper' | 'Middle' | 'Lower'>('Middle')
  const [initialDbh, setInitialDbh] = useState<number>(5.0)
  const [speciesMix, setSpeciesMix] = useState<Array<{ species: string; percent: number }>>([
    { species: 'red oak', percent: 50 },
    { species: 'sugar maple', percent: 50 },
  ])
  const [scenarioResult, setScenarioResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedScenarios, setSavedScenarios] = useState<Array<{ name: string; data: any }>>([])
  const [scenarioName, setScenarioName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'baseline' | 'scenario' | 'delta'>('scenario')

  // Load saved scenarios from localStorage
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

  const totalPercent = speciesMix.reduce((sum, item) => sum + item.percent, 0)
  const isValid = totalPercent === 100 && speciesMix.every(item => item.species.trim() !== '')

  const handleSimulate = async () => {
    if (!isValid) {
      setError('Species percentages must sum to 100%')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Aggregate trees by (species, plot, dbh_cm) for efficient simulation
      const plantingsMap = new Map<string, PlantingGroup>()
      
      for (const item of speciesMix) {
        const count = Math.round((item.percent / 100) * totalTrees)
        if (count > 0) {
          const key = `${item.species.trim()}_${plot}_${initialDbh}`
          if (plantingsMap.has(key)) {
            plantingsMap.get(key)!.count += count
          } else {
            plantingsMap.set(key, {
              species: item.species.trim(),
              plot,
              dbh_cm: initialDbh,
              count,
            })
          }
        }
      }

      // Adjust for rounding errors
      const totalPlanned = Array.from(plantingsMap.values()).reduce((sum, g) => sum + g.count, 0)
      if (totalPlanned < totalTrees) {
        const firstKey = Array.from(plantingsMap.keys())[0]
        if (firstKey) {
          plantingsMap.get(firstKey)!.count += (totalTrees - totalPlanned)
        }
      } else if (totalPlanned > totalTrees) {
        const firstKey = Array.from(plantingsMap.keys())[0]
        if (firstKey) {
          plantingsMap.get(firstKey)!.count -= (totalPlanned - totalTrees)
        }
      }

      const plantings = Array.from(plantingsMap.values())

      const result = await simulateScenario({
        mode: 'hybrid',
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
    if (!scenarioName.trim() || !scenarioResult) return

    const scenarioData = {
      name: scenarioName,
      totalTrees,
      plot,
      initialDbh,
      speciesMix,
      result: scenarioResult,
      timestamp: new Date().toISOString(),
    }

    const updated = [...savedScenarios, { name: scenarioName, data: scenarioData }]
    setSavedScenarios(updated)
    localStorage.setItem('savedScenarios', JSON.stringify(updated))
    setScenarioName('')
  }

  const handleLoad = (scenario: { name: string; data: any }) => {
    setTotalTrees(scenario.data.totalTrees)
    setPlot(scenario.data.plot)
    setInitialDbh(scenario.data.initialDbh)
    setSpeciesMix(scenario.data.speciesMix)
    setScenarioResult(scenario.data.result)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Planting Scenarios</h1>
        <p className="text-gray-600 mt-1">Simulate the impact of planting new trees on forest carbon sequestration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Builder */}
        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Scenario Builder</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Trees
            </label>
            <input
              type="number"
              min="1"
              value={totalTrees}
              onChange={(e) => setTotalTrees(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-green focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plot
            </label>
            <select
              value={plot}
              onChange={(e) => setPlot(e.target.value as 'Upper' | 'Middle' | 'Lower')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-green focus:border-transparent"
            >
              <option value="Upper">Upper</option>
              <option value="Middle">Middle</option>
              <option value="Lower">Lower</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial DBH (cm)
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={initialDbh}
              onChange={(e) => setInitialDbh(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-green focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Species Mix
              </label>
              <button
                onClick={addSpeciesRow}
                className="text-sm text-forest-green hover:underline"
              >
                + Add Species
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="%"
                    value={item.percent}
                    onChange={(e) => updateSpecies(index, 'percent', parseFloat(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => removeSpeciesRow(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className={`mt-2 text-sm ${totalPercent === 100 ? 'text-green-600' : 'text-red-600'}`}>
              Total: {totalPercent}%
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={!isValid || loading}
            className="w-full bg-forest-green text-white py-2 px-4 rounded-xl hover:bg-forest-light disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Simulating...' : 'Simulate Scenario'}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white p-6 rounded-xl shadow min-h-[500px]">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Results</h2>
          
          {scenarioResult ? (
            <div className="w-full">
              <div className="inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 mb-4 w-full">
                <button
                  onClick={() => setActiveTab('baseline')}
                  className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'baseline'
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Baseline
                </button>
                <button
                  onClick={() => setActiveTab('scenario')}
                  className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'scenario'
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Scenario
                </button>
                <button
                  onClick={() => setActiveTab('delta')}
                  className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'delta'
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Delta
                </button>
              </div>
              
              {activeTab === 'baseline' && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600">Total Carbon (20 years)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {scenarioResult.baseline_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600">CO2e (20 years)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {(scenarioResult.baseline_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Years</th>
                        <th className="text-right py-2">Carbon (kg C)</th>
                        <th className="text-right py-2">CO2e (kg)</th>
                        <th className="text-right py-2">Mean DBH (cm)</th>
                        <th className="text-right py-2">Trees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 5, 10, 20].map((year) => {
                        const data = scenarioResult.baseline_by_year[year.toString()]
                        return data ? (
                          <tr key={year} className="border-b">
                            <td className="py-2">{year}</td>
                            <td className="text-right py-2">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2">{data.mean_dbh_cm.toFixed(1)}</td>
                            <td className="text-right py-2">{data.num_trees.toLocaleString()}</td>
                          </tr>
                        ) : null
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              
              {activeTab === 'scenario' && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600">Total Carbon (20 years)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {scenarioResult.scenario_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600">CO2e (20 years)</div>
                    <div className="text-lg font-bold text-gray-900">
                      {(scenarioResult.scenario_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e
                    </div>
                  </div>
                </div>
                
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={[0, 5, 10, 20].map(year => ({
                    years_ahead: year,
                    baseline: scenarioResult.baseline_by_year[year.toString()]?.total_carbon_kgC || 0,
                    scenario: scenarioResult.scenario_by_year[year.toString()]?.total_carbon_kgC || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="years_ahead" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="baseline" stroke="#8884d8" name="Baseline" />
                    <Line type="monotone" dataKey="scenario" stroke="#82ca9d" name="With Planting" />
                  </LineChart>
                </ResponsiveContainer>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Years</th>
                        <th className="text-right py-2">Carbon (kg C)</th>
                        <th className="text-right py-2">CO2e (kg)</th>
                        <th className="text-right py-2">Mean DBH (cm)</th>
                        <th className="text-right py-2">Trees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 5, 10, 20].map((year) => {
                        const data = scenarioResult.scenario_by_year[year.toString()]
                        return data ? (
                          <tr key={year} className="border-b">
                            <td className="py-2">{year}</td>
                            <td className="text-right py-2">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2">{data.mean_dbh_cm.toFixed(1)}</td>
                            <td className="text-right py-2">{data.num_trees.toLocaleString()}</td>
                          </tr>
                        ) : null
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              
              {activeTab === 'delta' && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="text-xs text-gray-600">Carbon Added (20 years)</div>
                    <div className="text-lg font-bold text-green-700">
                      {scenarioResult.delta_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="text-xs text-gray-600">CO2e Added (20 years)</div>
                    <div className="text-lg font-bold text-green-700">
                      {(scenarioResult.delta_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Years</th>
                        <th className="text-right py-2">Delta Carbon (kg C)</th>
                        <th className="text-right py-2">Delta CO2e (kg)</th>
                        <th className="text-right py-2">Delta DBH (cm)</th>
                        <th className="text-right py-2">Trees Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 5, 10, 20].map((year) => {
                        const data = scenarioResult.delta_by_year[year.toString()]
                        return data ? (
                          <tr key={year} className="border-b">
                            <td className="py-2">{year}</td>
                            <td className="text-right py-2 text-green-600">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2 text-green-600">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2">{data.mean_dbh_cm > 0 ? '+' : ''}{data.mean_dbh_cm.toFixed(2)}</td>
                            <td className="text-right py-2">{data.num_trees.toLocaleString()}</td>
                          </tr>
                        ) : null
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="Scenario name"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={handleSave}
                  disabled={!scenarioName.trim()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              Run a simulation to see results
            </div>
          )}
        </div>
      </div>

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Saved Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savedScenarios.map((scenario, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:border-forest-green cursor-pointer transition-colors"
                onClick={() => handleLoad(scenario)}
              >
                <div className="font-semibold text-gray-900">{scenario.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {scenario.data.totalTrees} trees • {scenario.data.plot}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
