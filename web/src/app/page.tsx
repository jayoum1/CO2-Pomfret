'use client'

import { useState, useEffect } from 'react'
import { getAvailableYears, getSummary, Summary } from '@/lib/api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Info } from 'lucide-react'

export default function Dashboard() {
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summary20, setSummary20] = useState<Summary | null>(null)
  
  // Type guard helper
  const isSummary = (s: Summary | null): s is Summary => {
    return s !== null && 'total_carbon_kgC' in s
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([])

  // Load available years and initial summary
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const years = await getAvailableYears()
        setAvailableYears(years)
        
        if (years.length > 0) {
          setSelectedYear(years[0])
          const initialSummary = await getSummary(years[0])
          setSummary(initialSummary)
          
          // Load time series data for all years (using hybrid mode)
          const timeSeries = []
          for (const year of years) {
            const yearSummary = await getSummary(year, 'hybrid')
            timeSeries.push({
              years_ahead: year,
              total_carbon: yearSummary.total_carbon_kgC,
            })
            // Store year 20 summary separately
            if (year === 20) {
              setSummary20(yearSummary)
            }
          }
          setTimeSeriesData(timeSeries)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Update summary when year changes
  useEffect(() => {
    if (selectedYear !== null && availableYears.includes(selectedYear)) {
      setLoading(true)
      getSummary(selectedYear)
        .then(setSummary)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [selectedYear, availableYears])

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading forest data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    )
  }

  if (!summary) {
    return <div className="text-gray-500">No data available</div>
  }

  // Prepare chart data
  const plotData = Object.entries(summary.plot_breakdown || {}).map(([plot, data]: [string, any]) => ({
    plot,
    carbon: data.carbon_at_time,
    count: data.count,
  }))

  const speciesData = Object.entries(summary.species_breakdown || {})
    .map(([species, carbon]: [string, any]) => ({
      species: species.length > 15 ? species.substring(0, 15) + '...' : species,
      carbon,
    }))
    .sort((a, b) => b.carbon - a.carbon)
    .slice(0, 10)

  return (
    <div className="space-y-8">
      {/* Big Project Title */}
      <div className="text-center space-y-4 pb-8 border-b border-[#1e293b]">
        <h1 className="text-7xl font-black text-[#4ade80] neon-glow tracking-tight">
          POMFRET FOREST
        </h1>
        <p className="text-2xl text-[#4ade80]/70 font-light tracking-wide">
          Carbon Sequestration Simulation Platform
        </p>
        <p className="text-sm text-[#4ade80]/50 mt-4">
          Advanced forest growth modeling & analysis system
        </p>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#4ade80]">Dashboard</h2>
          <p className="text-[#4ade80]/70 mt-1">Forest snapshots and carbon metrics over time</p>
        </div>
        <div className="flex items-center gap-2 bg-[#1e293b] border border-[#4ade80]/30 rounded-lg px-3 py-2 shadow-[0_0_8px_rgba(74,222,128,0.15)]">
          <Info className="w-4 h-4 text-[#4ade80]" />
          <span className="text-sm text-[#4ade80]">
            Model: <span className="font-semibold">Hybrid long-term simulator</span>
          </span>
        </div>
      </div>

      {/* Year Selector - Slider */}
      <div className="bg-[#1e293b] p-6 rounded-lg border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)]">
        <label className="block text-sm font-medium text-[#4ade80] mb-4">
          Years Ahead: <span className="text-[#4ade80] font-bold neon-glow-subtle">{selectedYear}</span>
        </label>
        {availableYears.length > 0 && (
          <div className="space-y-2">
            <input
              type="range"
              min={Math.min(...availableYears)}
              max={Math.max(...availableYears)}
              value={selectedYear}
              onChange={(e) => {
                const value = parseInt(e.target.value)
                // Find closest available year
                const closest = availableYears.reduce((prev, curr) =>
                  Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
                )
                setSelectedYear(closest)
              }}
              step={availableYears.length > 10 ? 1 : undefined}
              className="w-full h-2 bg-[#334155] rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #4ade80 0%, #4ade80 ${((selectedYear - Math.min(...availableYears)) / (Math.max(...availableYears) - Math.min(...availableYears))) * 100}%, #334155 ${((selectedYear - Math.min(...availableYears)) / (Math.max(...availableYears) - Math.min(...availableYears))) * 100}%, #334155 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-[#4ade80]/50">
              <span>{Math.min(...availableYears)}</span>
              <span>{Math.max(...availableYears)}</span>
            </div>
            {/* Quick jump buttons for key years */}
            <div className="flex gap-2 flex-wrap mt-3">
              {[0, 5, 10, 15, 20].filter(y => availableYears.includes(y)).map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 text-xs rounded transition-all ${
                    selectedYear === year
                      ? 'bg-[#4ade80] text-[#0f172a] font-semibold shadow-[0_0_12px_rgba(74,222,128,0.3)]'
                      : 'bg-[#334155] text-[#4ade80]/70 hover:bg-[#475569] hover:text-[#4ade80] border border-[#334155]'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Cards - Show Year 0 and Year 20 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] animate-pulse">
              <div className="h-4 bg-[#334155] rounded w-32 mb-2"></div>
              <div className="h-8 bg-[#334155] rounded w-40 mb-4"></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-4 bg-[#334155] rounded"></div>
                <div className="h-4 bg-[#334155] rounded"></div>
                <div className="h-4 bg-[#334155] rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            const year0 = timeSeriesData.find(d => d.years_ahead === 0)
            const year20 = timeSeriesData.find(d => d.years_ahead === 20)
            const summary0 = summary && selectedYear === 0 ? summary : null
            const summary20 = timeSeriesData.length > 0 ? null : null // Will need to fetch separately
            
            return (
              <>
                <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)] hover:border-[#4ade80]/50 transition-all">
                  <div className="text-sm text-[#4ade80]/70 mb-1">Year 0 (Current)</div>
                  <div className="text-2xl font-bold text-[#4ade80] mb-4 neon-glow-subtle">
                    {summary0 ? summary0.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 }) : year0?.total_carbon.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg C
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-[#4ade80]/50">DBH</div>
                      <div className="font-semibold text-[#4ade80]">{summary0 ? summary0.mean_dbh_cm.toFixed(1) : '-'} cm</div>
                    </div>
                    <div>
                      <div className="text-[#4ade80]/50">Trees</div>
                      <div className="font-semibold text-[#4ade80]">{summary0 ? summary0.num_trees.toLocaleString() : '-'}</div>
                    </div>
                    <div>
                      <div className="text-[#4ade80]/50">CO2e</div>
                      <div className="font-semibold text-[#4ade80]">
                        {summary0 ? (summary0.total_carbon_kgC * 3.667).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'} kg
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)] hover:border-[#4ade80]/50 transition-all">
                  <div className="text-sm text-[#4ade80]/70 mb-1">Year 20 (Projected)</div>
                  <div className="text-2xl font-bold text-[#4ade80] mb-4 neon-glow-subtle">
                    {summary20 ? (summary20 as Summary).total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'} kg C
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-[#4ade80]/50">DBH</div>
                      <div className="font-semibold text-[#4ade80]">{summary20 ? (summary20 as Summary).mean_dbh_cm.toFixed(1) : '-'} cm</div>
                    </div>
                    <div>
                      <div className="text-[#4ade80]/50">Trees</div>
                      <div className="font-semibold text-[#4ade80]">{summary20 ? (summary20 as Summary).num_trees.toLocaleString() : '-'}</div>
                    </div>
                    <div>
                      <div className="text-[#4ade80]/50">CO2e</div>
                      <div className="font-semibold text-[#4ade80]">
                        {summary20 ? ((summary20 as Summary).total_carbon_kgC * 3.667).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'} kg
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Carbon Over Time */}
        <div className="bg-[#1e293b] p-6 rounded-lg border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)]">
          <h2 className="text-xl font-semibold text-[#4ade80] mb-4">Total Carbon vs Years</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="years_ahead" label={{ value: 'Years Ahead', position: 'insideBottom', offset: -5 }} stroke="#4ade80" tick={{ fill: '#4ade80' }} />
              <YAxis label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} stroke="#4ade80" tick={{ fill: '#4ade80' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #4ade80', color: '#4ade80' }} />
              <Legend wrapperStyle={{ color: '#4ade80' }} />
              <Line type="monotone" dataKey="total_carbon" stroke="#4ade80" strokeWidth={3} name="Total Carbon (kg C)" dot={{ fill: '#4ade80', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Carbon by Plot */}
        <div className="bg-[#1e293b] p-6 rounded-lg border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)]">
          <h2 className="text-xl font-semibold text-[#4ade80] mb-4">Carbon by Plot</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={plotData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="plot" stroke="#4ade80" tick={{ fill: '#4ade80' }} />
              <YAxis label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} stroke="#4ade80" tick={{ fill: '#4ade80' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #4ade80', color: '#4ade80' }} />
              <Legend wrapperStyle={{ color: '#4ade80' }} />
              <Bar dataKey="carbon" fill="#4ade80" name="Carbon (kg C)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Species */}
        <div className="bg-[#1e293b] p-6 rounded-lg border border-[#334155] shadow-[0_0_20px_rgba(74,222,128,0.1)] lg:col-span-2">
          <h2 className="text-xl font-semibold text-[#4ade80] mb-4">Top 10 Species by Carbon</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={speciesData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" label={{ value: 'Carbon (kg C)', position: 'insideBottom', offset: -5 }} stroke="#4ade80" tick={{ fill: '#4ade80' }} />
              <YAxis dataKey="species" type="category" width={150} stroke="#4ade80" tick={{ fill: '#4ade80' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #4ade80', color: '#4ade80' }} />
              <Legend wrapperStyle={{ color: '#4ade80' }} />
              <Bar dataKey="carbon" fill="#4ade80" name="Carbon (kg C)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
