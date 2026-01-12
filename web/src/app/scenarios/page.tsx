'use client'

import { useState, useEffect } from 'react'
import { postScenario, ScenarioTree } from '@/lib/api'
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
      // Generate trees based on proportions
      const newTrees: ScenarioTree[] = []
      let treeCount = 0
      
      for (const item of speciesMix) {
        const count = Math.round((item.percent / 100) * totalTrees)
        for (let i = 0; i < count; i++) {
          newTrees.push({
            species: item.species.trim(),
            plot,
            dbh_cm: initialDbh,
          })
          treeCount++
        }
      }

      // Adjust for rounding errors
      while (newTrees.length < totalTrees) {
        newTrees.push({
          species: speciesMix[0].species.trim(),
          plot,
          dbh_cm: initialDbh,
        })
      }
      while (newTrees.length > totalTrees) {
        newTrees.pop()
      }

      const result = await postScenario({
        years_list: [0, 5, 10, 20],
        new_trees: newTrees,
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
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
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
            className="w-full bg-forest-green text-white py-2 px-4 rounded-lg hover:bg-forest-light disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Simulating...' : '🌲 Simulate Scenario'}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Results</h2>
          
          {scenarioResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">Carbon Added (20 years)</div>
                  <div className="text-lg font-bold text-gray-900">
                    {scenarioResult.summaries[scenarioResult.summaries.length - 1]?.delta_carbon.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">CO2e Added (20 years)</div>
                  <div className="text-lg font-bold text-gray-900">
                    {(scenarioResult.summaries[scenarioResult.summaries.length - 1]?.delta_carbon * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={scenarioResult.summaries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="years_ahead" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="baseline_total_carbon" stroke="#8884d8" name="Baseline" />
                  <Line type="monotone" dataKey="scenario_total_carbon" stroke="#82ca9d" name="With Planting" />
                </LineChart>
              </ResponsiveContainer>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Comparison by Year</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Years</th>
                        <th className="text-right py-2">Baseline (kg C)</th>
                        <th className="text-right py-2">Scenario (kg C)</th>
                        <th className="text-right py-2">Delta (kg C)</th>
                        <th className="text-right py-2">Delta CO2e</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioResult.summaries.map((s: any) => (
                        <tr key={s.years_ahead} className="border-b">
                          <td className="py-2">{s.years_ahead}</td>
                          <td className="text-right py-2">{s.baseline_total_carbon.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right py-2">{s.scenario_total_carbon.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right py-2 text-green-600">{s.delta_carbon.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right py-2 text-green-600">{(s.delta_carbon * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
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
