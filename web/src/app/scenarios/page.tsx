'use client'

import { useState, useEffect, useMemo } from 'react'
import { simulateScenario, PlantingGroup } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, X, Save, Loader2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SkeletonBlock } from '@/components/ui/SkeletonBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCard } from '@/components/ui/KpiCard'
import { TrendingUp, Leaf } from 'lucide-react'

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
  const isValid = totalPercent === 100 && 
                  speciesMix.every(item => item.species.trim() !== '') &&
                  typeof totalTrees === 'number' && totalTrees > 0 &&
                  typeof initialDbh === 'number' && initialDbh > 0

  const handleSimulate = async () => {
    if (!isValid) {
      setError('Species percentages must sum to 100%')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const plantingsMap = new Map<string, PlantingGroup>()
      
      const totalTreesNum = typeof totalTrees === 'number' ? totalTrees : 0
      const initialDbhNum = typeof initialDbh === 'number' ? initialDbh : 0
      
      for (const item of speciesMix) {
        const count = Math.round((item.percent / 100) * totalTreesNum)
        if (count > 0) {
          const key = `${item.species.trim()}_${plot}_${initialDbhNum}`
          if (plantingsMap.has(key)) {
            plantingsMap.get(key)!.count += count
          } else {
            plantingsMap.set(key, {
              species: item.species.trim(),
              plot,
              dbh_cm: initialDbhNum,
              count,
            })
          }
        }
      }

      const totalPlanned = Array.from(plantingsMap.values()).reduce((sum, g) => sum + g.count, 0)
      if (totalPlanned < totalTreesNum) {
        const firstKey = Array.from(plantingsMap.keys())[0]
        if (firstKey) {
          plantingsMap.get(firstKey)!.count += (totalTreesNum - totalPlanned)
        }
      } else if (totalPlanned > totalTreesNum) {
        const firstKey = Array.from(plantingsMap.keys())[0]
        if (firstKey) {
          plantingsMap.get(firstKey)!.count -= (totalPlanned - totalTreesNum)
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
    setTotalTrees(scenario.data.totalTrees || '')
    setPlot(scenario.data.plot)
    setInitialDbh(scenario.data.initialDbh || '')
    setSpeciesMix(scenario.data.speciesMix)
    setScenarioResult(scenario.data.result)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Planting Scenarios"
        subtitle="Simulate the impact of planting new trees on forest carbon sequestration"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Builder */}
        <GlassCard>
          <h2 className="text-heading-3 text-[var(--text)] mb-4">Scenario Builder</h2>

          <div className="space-y-4">
            <div>
              <label className="text-label mb-2 block">Total Trees</label>
              <Input
                type="number"
                min="1"
                value={totalTrees}
                onChange={(e) => {
                  const value = e.target.value
                  setTotalTrees(value === '' ? '' : parseInt(value) || '')
                }}
              />
            </div>

            <div>
              <label className="text-label mb-2 block">Plot</label>
              <Select value={plot} onValueChange={(value) => setPlot(value as 'Upper' | 'Middle' | 'Lower')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Upper">Upper</SelectItem>
                  <SelectItem value="Middle">Middle</SelectItem>
                  <SelectItem value="Lower">Lower</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-label mb-2 block">Initial DBH (cm)</label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={initialDbh}
                onChange={(e) => {
                  const value = e.target.value
                  setInitialDbh(value === '' ? '' : parseFloat(value) || '')
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-label">Species Mix</label>
                <Button variant="ghost" size="sm" onClick={addSpeciesRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Species
                </Button>
              </div>
              <div className="space-y-2">
                {speciesMix.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Species name"
                      value={item.species}
                      onChange={(e) => updateSpecies(index, 'species', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="%"
                      value={item.percent}
                      onChange={(e) => updateSpecies(index, 'percent', parseFloat(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSpeciesRow(index)}
                      className="text-[var(--error)] hover:text-[var(--error)] hover:bg-[var(--error)]/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className={`mt-2 text-sm ${totalPercent === 100 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                Total: {totalPercent}%
              </div>
            </div>

            <Button
              onClick={handleSimulate}
              disabled={!isValid || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Simulating...
                </>
              ) : (
                'Simulate Scenario'
              )}
            </Button>

            {error && (
              <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Results */}
        <GlassCard>
          <h2 className="text-heading-3 text-[var(--text)] mb-4">Results</h2>
          
          {scenarioResult ? (
            <div className="w-full">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'baseline' | 'scenario' | 'delta')} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="baseline">Baseline</TabsTrigger>
                  <TabsTrigger value="scenario">Scenario</TabsTrigger>
                  <TabsTrigger value="delta">Delta</TabsTrigger>
                </TabsList>
                
                <TabsContent value="baseline" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <KpiCard
                      title="Total Carbon (20 years)"
                      value={`${scenarioResult.baseline_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C`}
                      icon={Leaf}
                    />
                    <KpiCard
                      title="CO2e (20 years)"
                      value={`${(scenarioResult.baseline_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e`}
                      icon={TrendingUp}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 text-[var(--muted)]">Years</th>
                          <th className="text-right py-2 text-[var(--muted)]">Carbon (kg C)</th>
                          <th className="text-right py-2 text-[var(--muted)]">CO2e (kg)</th>
                          <th className="text-right py-2 text-[var(--muted)]">Mean DBH (cm)</th>
                          <th className="text-right py-2 text-[var(--muted)]">Trees</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 5, 10, 20].map((year) => {
                          const data = scenarioResult.baseline_by_year[year.toString()]
                          return data ? (
                            <tr key={year} className="border-b border-[var(--border)]">
                              <td className="py-2 text-[var(--text)]">{year}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="text-right py-2 text-[var(--text)]">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.mean_dbh_cm.toFixed(1)}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.num_trees.toLocaleString()}</td>
                            </tr>
                          ) : null
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                
                <TabsContent value="scenario" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <KpiCard
                      title="Total Carbon (20 years)"
                      value={`${scenarioResult.scenario_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C`}
                      icon={Leaf}
                    />
                    <KpiCard
                      title="CO2e (20 years)"
                      value={`${(scenarioResult.scenario_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e`}
                      icon={TrendingUp}
                    />
                  </div>
                  
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={[0, 5, 10, 20].map(year => ({
                      years_ahead: year,
                      baseline: scenarioResult.baseline_by_year[year.toString()]?.total_carbon_kgC || 0,
                      scenario: scenarioResult.scenario_by_year[year.toString()]?.total_carbon_kgC || 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                      <XAxis dataKey="years_ahead" stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} />
                      <YAxis stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--panel)', 
                          border: '1px solid var(--border)', 
                          color: 'var(--text)',
                          borderRadius: 'var(--radius-lg)'
                        }} 
                      />
                      <Legend wrapperStyle={{ color: 'var(--text)' }} />
                      <Line type="monotone" dataKey="baseline" stroke="var(--muted)" strokeWidth={3} name="Baseline" dot={{ fill: 'var(--muted)', r: 5 }} />
                      <Line type="monotone" dataKey="scenario" stroke="var(--primary)" strokeWidth={3} name="With Planting" dot={{ fill: 'var(--primary)', r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 text-[var(--muted)]">Years</th>
                          <th className="text-right py-2 text-[var(--muted)]">Carbon (kg C)</th>
                          <th className="text-right py-2 text-[var(--muted)]">CO2e (kg)</th>
                          <th className="text-right py-2 text-[var(--muted)]">Mean DBH (cm)</th>
                          <th className="text-right py-2 text-[var(--muted)]">Trees</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 5, 10, 20].map((year) => {
                          const data = scenarioResult.scenario_by_year[year.toString()]
                          return data ? (
                            <tr key={year} className="border-b border-[var(--border)]">
                              <td className="py-2 text-[var(--text)]">{year}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="text-right py-2 text-[var(--text)]">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.mean_dbh_cm.toFixed(1)}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.num_trees.toLocaleString()}</td>
                            </tr>
                          ) : null
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                
                <TabsContent value="delta" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <KpiCard
                      title="Carbon Added (20 years)"
                      value={`${scenarioResult.delta_by_year['20']?.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C`}
                      icon={Leaf}
                      delta={{ value: '+', trend: 'up' }}
                    />
                    <KpiCard
                      title="CO2e Added (20 years)"
                      value={`${(scenarioResult.delta_by_year['20']?.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e`}
                      icon={TrendingUp}
                      delta={{ value: '+', trend: 'up' }}
                    />
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 text-[var(--muted)]">Years</th>
                          <th className="text-right py-2 text-[var(--muted)]">Delta Carbon (kg C)</th>
                          <th className="text-right py-2 text-[var(--muted)]">Delta CO2e (kg)</th>
                          <th className="text-right py-2 text-[var(--muted)]">Delta DBH (cm)</th>
                          <th className="text-right py-2 text-[var(--muted)]">Trees Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 5, 10, 20].map((year) => {
                          const data = scenarioResult.delta_by_year[year.toString()]
                          return data ? (
                            <tr key={year} className="border-b border-[var(--border)]">
                              <td className="py-2 text-[var(--text)]">{year}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="text-right py-2 text-[var(--text)]">{(data.total_carbon_kgC * CO2E_FACTOR).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.mean_dbh_cm > 0 ? '+' : ''}{data.mean_dbh_cm.toFixed(2)}</td>
                              <td className="text-right py-2 text-[var(--text)]">{data.num_trees.toLocaleString()}</td>
                            </tr>
                          ) : null
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex gap-2 mt-4">
                <Input
                  type="text"
                  placeholder="Scenario name"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSave}
                  disabled={!scenarioName.trim()}
                  variant="outline"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Results Yet"
              description="Run a simulation to see results here"
            />
          )}
        </GlassCard>
      </div>

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <GlassCard>
          <h2 className="text-heading-3 text-[var(--text)] mb-4">Saved Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savedScenarios.map((scenario, index) => (
              <div
                key={index}
                className="glass-panel rounded-lg p-4 cursor-pointer transition-premium hover:translate-y-[-2px]"
                onClick={() => handleLoad(scenario)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleLoad(scenario)
                  }
                }}
                aria-label={`Load scenario: ${scenario.name}`}
              >
                <div className="font-semibold text-[var(--text)]">{scenario.name}</div>
                <div className="text-sm text-[var(--muted)] mt-1">
                  {scenario.data.totalTrees} trees • {scenario.data.plot}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
