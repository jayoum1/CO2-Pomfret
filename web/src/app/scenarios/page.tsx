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
    <div className="space-y-8">
      <div className="text-center space-y-2 pb-6 border-b border-[#334155]">
        <h1 className="text-5xl font-black text-[#4ade80] neon-glow tracking-tight">Planting Scenarios</h1>
        <p className="text-lg text-[#4ade80]/70 mt-1">Simulate the impact of planting new trees on forest carbon sequestration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Builder */}
        <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)] space-y-4">
          <h2 className="text-xl font-semibold text-[#4ade80]">Scenario Builder</h2>

          <div>
            <label className="block text-sm font-medium text-[#4ade80]/70 mb-1">
              Total Trees
            </label>
            <input
              type="number"
              min="1"
              value={totalTrees}
              onChange={(e) => setTotalTrees(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#334155] border border-[#475569] rounded-lg text-[#4ade80] focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4ade80]/70 mb-1">
              Plot
            </label>
            <select
              value={plot}
              onChange={(e) => setPlot(e.target.value as 'Upper' | 'Middle' | 'Lower')}
              className="w-full px-3 py-2 bg-[#334155] border border-[#475569] rounded-lg text-[#4ade80] focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-all"
            >
              <option value="Upper" className="bg-[#1e293b]">Upper</option>
              <option value="Middle" className="bg-[#1e293b]">Middle</option>
              <option value="Lower" className="bg-[#1e293b]">Lower</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4ade80]/70 mb-1">
              Initial DBH (cm)
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={initialDbh}
              onChange={(e) => setInitialDbh(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#334155] border border-[#475569] rounded-lg text-[#4ade80] focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-all"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-[#4ade80]/70">
                Species Mix
              </label>
              <button
                onClick={addSpeciesRow}
                className="text-sm text-[#4ade80] hover:text-[#4ade80]/80 hover:underline transition-colors"
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
                    className="flex-1 px-3 py-2 bg-[#334155] border border-[#475569] rounded-lg text-sm text-[#4ade80] placeholder:text-[#4ade80]/30 focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-all"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="%"
                    value={item.percent}
                    onChange={(e) => updateSpecies(index, 'percent', parseFloat(e.target.value) || 0)}
                    className="w-20 px-3 py-2 bg-[#334155] border border-[#475569] rounded-lg text-sm text-[#4ade80] placeholder:text-[#4ade80]/30 focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-all"
                  />
                  <button
                    onClick={() => removeSpeciesRow(index)}
                    className="px-3 py-2 text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-lg transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className={`mt-2 text-sm ${totalPercent === 100 ? 'text-[#4ade80]' : 'text-red-400'}`}>
              Total: {totalPercent}%
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={!isValid || loading}
            className="w-full bg-[#4ade80] text-[#0f172a] py-2 px-4 rounded-xl hover:bg-[#4ade80]/90 disabled:bg-[#334155] disabled:text-[#4ade80]/30 disabled:cursor-not-allowed transition-all font-medium shadow-[0_0_15px_rgba(74,222,128,0.3)] hover:shadow-[0_0_20px_rgba(74,222,128,0.5)]"
          >
            {loading ? 'Simulating...' : 'Simulate Scenario'}
          </button>

          {error && (
            <div className="bg-red-400/10 border border-red-400/30 text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)] min-h-[500px]">
          <h2 className="text-xl font-semibold text-[#4ade80] mb-4">Results</h2>
          
          {scenarioResult ? (
            <div className="w-full">
              <div className="inline-flex h-10 items-center justify-center rounded-lg bg-[#334155] p-1 mb-4 w-full border border-[#475569]">
                <button
                  onClick={() => setActiveTab('baseline')}
                  className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'baseline'
                      ? 'bg-[#4ade80] text-[#0f172a] shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                      : 'text-[#4ade80]/70 hover:text-[#4ade80]'
                  }`}
                >
                  Baseline
                </button>
                <button
                  onClick={() => setActiveTab('scenario')}
                  className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'scenario'
                      ? 'bg-[#4ade80] text-[#0f172a] shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                      : 'text-[#4ade80]/70 hover:text-[#4ade80]'
                  }`}
                >
                  Scenario
                </button>
                <button
                  onClick={() => setActiveTab('delta')}
                  className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activeTab === 'delta'
                      ? 'bg-[#4ade80] text-[#0f172a] shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                      : 'text-[#4ade80]/70 hover:text-[#4ade80]'
                  }`}
                >
                  Delta
                </button>
              </div>
              
              {activeTab === 'baseline' && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#334155] p-3 rounded-lg border border-[#475569]">
                    <div className="text-xs text-[#4ade80]/50">Total Carbon (20 years)</div>
                    <div className="text-lg font-bold text-[#4ade80]">
                      {scenarioResult.baseline_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </div>
                  </div>
                  <div className="bg-[#334155] p-3 rounded-lg border border-[#475569]">
                    <div className="text-xs text-[#4ade80]/50">CO2e (20 years)</div>
                    <div className="text-lg font-bold text-[#4ade80]">
                      {(scenarioResult.baseline_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#475569]">
                        <th className="text-left py-2 text-[#4ade80]">Years</th>
                        <th className="text-right py-2 text-[#4ade80]">Carbon (kg C)</th>
                        <th className="text-right py-2 text-[#4ade80]">CO2e (kg)</th>
                        <th className="text-right py-2 text-[#4ade80]">Mean DBH (cm)</th>
                        <th className="text-right py-2 text-[#4ade80]">Trees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 5, 10, 20].map((year) => {
                        const data = scenarioResult.baseline_by_year[year.toString()]
                        return data ? (
                          <tr key={year} className="border-b border-[#334155]">
                            <td className="py-2 text-[#4ade80]/70">{year}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2 text-[#4ade80]">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.mean_dbh_cm.toFixed(1)}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.num_trees.toLocaleString()}</td>
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
                  <div className="bg-[#334155] p-3 rounded-lg border border-[#475569]">
                    <div className="text-xs text-[#4ade80]/50">Total Carbon (20 years)</div>
                    <div className="text-lg font-bold text-[#4ade80]">
                      {scenarioResult.scenario_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </div>
                  </div>
                  <div className="bg-[#334155] p-3 rounded-lg border border-[#475569]">
                    <div className="text-xs text-[#4ade80]/50">CO2e (20 years)</div>
                    <div className="text-lg font-bold text-[#4ade80]">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="years_ahead" stroke="#4ade80" tick={{ fill: '#4ade80' }} />
                    <YAxis stroke="#4ade80" tick={{ fill: '#4ade80' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #4ade80', color: '#4ade80' }} />
                    <Legend wrapperStyle={{ color: '#4ade80' }} />
                    <Line type="monotone" dataKey="baseline" stroke="#4ade80" strokeWidth={2} name="Baseline" />
                    <Line type="monotone" dataKey="scenario" stroke="#4ade80" strokeWidth={3} name="With Planting" />
                  </LineChart>
                </ResponsiveContainer>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#475569]">
                        <th className="text-left py-2 text-[#4ade80]">Years</th>
                        <th className="text-right py-2 text-[#4ade80]">Carbon (kg C)</th>
                        <th className="text-right py-2 text-[#4ade80]">CO2e (kg)</th>
                        <th className="text-right py-2 text-[#4ade80]">Mean DBH (cm)</th>
                        <th className="text-right py-2 text-[#4ade80]">Trees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 5, 10, 20].map((year) => {
                        const data = scenarioResult.scenario_by_year[year.toString()]
                        return data ? (
                          <tr key={year} className="border-b border-[#334155]">
                            <td className="py-2 text-[#4ade80]/70">{year}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2 text-[#4ade80]">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.mean_dbh_cm.toFixed(1)}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.num_trees.toLocaleString()}</td>
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
                  <div className="bg-[#334155] p-3 rounded-lg border border-[#4ade80]/30">
                    <div className="text-xs text-[#4ade80]/50">Carbon Added (20 years)</div>
                    <div className="text-lg font-bold text-[#4ade80]">
                      {scenarioResult.delta_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                    </div>
                  </div>
                  <div className="bg-[#334155] p-3 rounded-lg border border-[#4ade80]/30">
                    <div className="text-xs text-[#4ade80]/50">CO2e Added (20 years)</div>
                    <div className="text-lg font-bold text-[#4ade80]">
                      {(scenarioResult.delta_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#475569]">
                        <th className="text-left py-2 text-[#4ade80]">Years</th>
                        <th className="text-right py-2 text-[#4ade80]">Delta Carbon (kg C)</th>
                        <th className="text-right py-2 text-[#4ade80]">Delta CO2e (kg)</th>
                        <th className="text-right py-2 text-[#4ade80]">Delta DBH (cm)</th>
                        <th className="text-right py-2 text-[#4ade80]">Trees Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 5, 10, 20].map((year) => {
                        const data = scenarioResult.delta_by_year[year.toString()]
                        return data ? (
                          <tr key={year} className="border-b border-[#334155]">
                            <td className="py-2 text-[#4ade80]/70">{year}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2 text-[#4ade80]">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.mean_dbh_cm > 0 ? '+' : ''}{data.mean_dbh_cm.toFixed(2)}</td>
                            <td className="text-right py-2 text-[#4ade80]">{data.num_trees.toLocaleString()}</td>
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
                  className="flex-1 px-3 py-2 bg-[#334155] border border-[#475569] rounded-lg text-sm text-[#4ade80] placeholder:text-[#4ade80]/30 focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-all"
                />
                <button
                  onClick={handleSave}
                  disabled={!scenarioName.trim()}
                  className="px-4 py-2 bg-[#4ade80] text-[#0f172a] rounded-lg hover:bg-[#4ade80]/90 disabled:bg-[#334155] disabled:text-[#4ade80]/30 disabled:cursor-not-allowed text-sm font-medium transition-all shadow-[0_0_10px_rgba(74,222,128,0.3)]"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[#4ade80]/50 text-center py-8">
              Run a simulation to see results
            </div>
          )}
        </div>
      </div>

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <div className="bg-[#1e293b] p-6 rounded-lg border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)]">
          <h2 className="text-xl font-semibold text-[#4ade80] mb-4">Saved Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savedScenarios.map((scenario, index) => (
              <div
                key={index}
                className="border border-[#334155] rounded-lg p-4 hover:border-[#4ade80] cursor-pointer transition-all bg-[#1e293b]"
                onClick={() => handleLoad(scenario)}
              >
                <div className="font-semibold text-[#4ade80]">{scenario.name}</div>
                <div className="text-sm text-[#4ade80]/50 mt-1">
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
