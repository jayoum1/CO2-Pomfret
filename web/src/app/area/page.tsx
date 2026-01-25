'use client'

import { useState, useEffect, useRef } from 'react'
import { getPlotAreas, getAreaDensities, scaleArea, ScaleAreaRequest, ScaleAreaResult } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Calculator, MapPin, AlertCircle, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import map component to avoid SSR issues
const MapComponent = dynamic(() => import('@/components/area/MapDrawer'), { ssr: false })

export default function AreaGeneralizer() {
  const [plotAreas, setPlotAreas] = useState<any>(null)
  const [targetArea, setTargetArea] = useState<string>('')
  const [areaUnit, setAreaUnit] = useState<'m2' | 'hectares' | 'acres'>('hectares')
  const [reference, setReference] = useState<'Upper' | 'Middle' | 'Lower' | 'Average' | 'Range'>('Average')
  const [mode, setMode] = useState<'baseline' | 'baseline_stochastic'>('baseline')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScaleAreaResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapArea, setMapArea] = useState<number | null>(null)

  useEffect(() => {
    getPlotAreas()
      .then(setPlotAreas)
      .catch((err) => {
        console.error('Error loading plot areas:', err)
        setError('Failed to load plot areas configuration')
      })
  }, [])

  // Convert area to square meters
  const convertToM2 = (value: number, unit: string): number => {
    switch (unit) {
      case 'hectares':
        return value * 10000 // 1 hectare = 10,000 m²
      case 'acres':
        return value * 4046.86 // 1 acre ≈ 4046.86 m²
      case 'm2':
      default:
        return value
    }
  }

  // Convert square meters to display unit
  const convertFromM2 = (value: number, unit: string): number => {
    switch (unit) {
      case 'hectares':
        return value / 10000
      case 'acres':
        return value / 4046.86
      case 'm2':
      default:
        return value
    }
  }

  const handleCalculate = async () => {
    if (!targetArea || parseFloat(targetArea) <= 0) {
      setError('Please enter a valid target area')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const areaM2 = convertToM2(parseFloat(targetArea), areaUnit)
      
      const request: ScaleAreaRequest = {
        mode,
        target_area_m2: areaM2,
        reference,
      }

      const response = await scaleArea(request)
      setResult(response)
    } catch (err: any) {
      setError(err.message || 'Failed to calculate scaled area')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleMapAreaSelected = (areaM2: number) => {
    const displayArea = convertFromM2(areaM2, areaUnit)
    setTargetArea(displayArea.toFixed(2))
    setMapArea(areaM2)
  }

  // Check if plot areas are configured
  const plotsConfigured = plotAreas?.plot_areas
    ? Object.values(plotAreas.plot_areas).some((p: any) => p.area_m2 !== null)
    : false

  const allPlotsConfigured = plotAreas?.plot_areas
    ? Object.values(plotAreas.plot_areas).every((p: any) => p.area_m2 !== null)
    : false

  // Prepare chart data
  const chartData = result?.results_by_horizon
    ? [0, 5, 10, 20].map((year) => {
        const yearData = result.results_by_horizon[year]
        if (!yearData) return null
        
        if (reference === 'Range' && yearData.low && yearData.high) {
          return {
            years_ahead: year,
            low: yearData.low.total_co2e_kg / 1000, // Convert to metric tons
            high: yearData.high.total_co2e_kg / 1000,
          }
        } else {
          return {
            years_ahead: year,
            value: yearData.total_co2e_kg / 1000, // Convert to metric tons
          }
        }
      }).filter(Boolean)
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Generalize to Any Area</h1>
        <p className="text-[var(--text-muted)] mt-1">
          Scale carbon sequestration results from measured plots to any target area
        </p>
      </div>

      {/* Warning if plot areas not configured */}
      {plotAreas && !plotsConfigured && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Plot Areas Not Configured</h3>
              <p className="text-sm text-yellow-800">
                Plot areas need to be set in <code className="bg-yellow-100 px-1 rounded">Data/Metadata/plot_areas.json</code> before scaling calculations can be performed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual Scaling Section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="font-semibold">Manual Scaling</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Target Area</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={targetArea}
                onChange={(e) => setTargetArea(e.target.value)}
                placeholder="Enter area"
                className="input flex-1"
                disabled={!plotsConfigured}
              />
              <select
                value={areaUnit}
                onChange={(e) => setAreaUnit(e.target.value as 'm2' | 'hectares' | 'acres')}
                className="input w-32"
              >
                <option value="m2">m²</option>
                <option value="hectares">hectares</option>
                <option value="acres">acres</option>
              </select>
            </div>
            {mapArea && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                From map: {convertFromM2(mapArea, areaUnit).toFixed(2)} {areaUnit}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reference</label>
            <select
              value={reference}
              onChange={(e) => setReference(e.target.value as any)}
              className="input w-full"
              disabled={!plotsConfigured || (reference === 'Average' && !allPlotsConfigured)}
            >
              <option value="Upper">Upper Plot</option>
              <option value="Middle">Middle Plot</option>
              <option value="Lower">Lower Plot</option>
              <option value="Average" disabled={!allPlotsConfigured}>
                Average of Plots {!allPlotsConfigured && '(requires all plot areas)'}
              </option>
              <option value="Range" disabled={!allPlotsConfigured}>
                Range (Min-Max) {!allPlotsConfigured && '(requires all plot areas)'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Simulation Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="input w-full"
            >
              <option value="baseline">Baseline (default)</option>
              <option value="baseline_stochastic">Visual mode (stochastic)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              disabled={loading || !plotsConfigured || !targetArea}
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Calculate
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Results Table */}
        {result && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Scaled Results</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2">Years Ahead</th>
                    <th className="text-right py-2">Carbon (kg C)</th>
                    <th className="text-right py-2">CO₂e (kg)</th>
                    <th className="text-right py-2">CO₂e (metric tons)</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 5, 10, 20].map((year) => {
                    const yearData = result.results_by_horizon[year]
                    if (!yearData) return null

                    if (reference === 'Range' && yearData.low && yearData.high) {
                      return (
                        <tr key={year} className="border-b border-[var(--border)]">
                          <td className="py-2">{year}</td>
                          <td className="text-right py-2">
                            {yearData.low.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })} - {yearData.high.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right py-2">
                            {yearData.low.total_co2e_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} - {yearData.high.total_co2e_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right py-2">
                            {(yearData.low.total_co2e_kg / 1000).toFixed(1)} - {(yearData.high.total_co2e_kg / 1000).toFixed(1)}
                          </td>
                        </tr>
                      )
                    } else {
                      return (
                        <tr key={year} className="border-b border-[var(--border)]">
                          <td className="py-2">{year}</td>
                          <td className="text-right py-2">
                            {yearData.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right py-2">
                            {yearData.total_co2e_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right py-2">
                            {(yearData.total_co2e_kg / 1000).toFixed(1)}
                          </td>
                        </tr>
                      )
                    }
                  })}
                </tbody>
              </table>
            </div>

            {/* Sequestration Summary */}
            {result.annual_sequestration && (
              <div className="mt-4 p-4 bg-[var(--primary-light)] rounded-lg border border-[var(--primary)]/20">
                <h4 className="font-semibold mb-2">Annual Sequestration (0→20 years average)</h4>
                {reference === 'Range' && result.annual_sequestration.low && result.annual_sequestration.high ? (
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Low:</strong> {result.annual_sequestration.low.kgCO2e_per_year.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂e/year
                    </div>
                    <div>
                      <strong>High:</strong> {result.annual_sequestration.high.kgCO2e_per_year.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂e/year
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <strong>{result.annual_sequestration.kgCO2e_per_year.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> kg CO₂e/year
                  </div>
                )}
              </div>
            )}

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Carbon Storage Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="years_ahead" 
                      label={{ value: 'Years Ahead', position: 'outside', offset: 10 }}
                      stroke="#64748b"
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis 
                      label={{ value: 'CO₂e (metric tons)', angle: -90, position: 'insideLeft', offset: -10 }}
                      stroke="#64748b"
                      tick={{ fill: '#64748b' }}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                      formatter={(value: number) => `${value.toFixed(1)} tCO₂e`}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {reference === 'Range' ? (
                      <>
                        <Line 
                          type="monotone" 
                          dataKey="low" 
                          stroke="var(--accent)" 
                          strokeWidth={2} 
                          name="Low Estimate" 
                          dot={{ fill: 'var(--accent)', r: 4 }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="high" 
                          stroke="var(--teal-500)" 
                          strokeWidth={2} 
                          name="High Estimate" 
                          dot={{ fill: 'var(--teal-500)', r: 4 }} 
                        />
                      </>
                    ) : (
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="var(--teal-500)" 
                        strokeWidth={2} 
                        name="Total CO₂e" 
                        dot={{ fill: 'var(--teal-500)', r: 4 }} 
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Callout */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> This assumes the selected area is similar to the reference plot(s) in terms of 
                forest structure, species composition, and environmental conditions.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Map Drawing Section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="font-semibold">Draw on Map</h2>
        </div>
        <MapComponent onAreaCalculated={handleMapAreaSelected} />
      </div>
    </div>
  )
}
