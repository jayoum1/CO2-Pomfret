'use client'

import { useState, useEffect } from 'react'
import { getAvailableYears, getSummary, Summary } from '@/lib/api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([])

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
          
          const timeSeries = []
          for (const year of years) {
            const yearSummary = await getSummary(year, 'hybrid')
            timeSeries.push({
              years_ahead: year,
              total_carbon: yearSummary.total_carbon_kgC,
            })
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

  useEffect(() => {
    if (selectedYear !== null && availableYears.includes(selectedYear)) {
      setLoading(true)
      getSummary(selectedYear)
        .then(setSummary)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [selectedYear, availableYears])

  const plotData = summary ? Object.entries(summary.plot_breakdown || {}).map(([plot, data]: [string, any]) => ({
    plot,
    carbon: data.carbon_at_time,
    count: data.count,
  })) : []

  if (error) {
    return (
      <div className="card">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Year Selector */}
      <div className="card">
        <label className="block text-sm font-medium mb-3">
          Time Horizon: <span className="font-semibold text-[var(--primary)]">{selectedYear} years ahead</span>
        </label>
        {availableYears.length > 0 && (
          <div className="flex gap-2">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`btn ${selectedYear === year ? 'btn-primary' : 'btn-secondary'}`}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="h-20 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card border-t-4" style={{ borderTopColor: 'var(--teal-500)' }}>
            <div className="text-sm text-[var(--text-muted)] mb-1">Total Carbon</div>
            <div className="text-2xl font-bold mb-1" style={{ color: 'var(--teal-600)' }}>
              {summary.total_carbon_kgC.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-[var(--text-muted)]">kg C</div>
          </div>

          <div className="card border-t-4" style={{ borderTopColor: 'var(--accent)' }}>
            <div className="text-sm text-[var(--text-muted)] mb-1">Mean DBH</div>
            <div className="text-2xl font-bold mb-1" style={{ color: 'var(--accent)' }}>
              {summary.mean_dbh_cm.toFixed(1)}
            </div>
            <div className="text-sm text-[var(--text-muted)]">cm</div>
          </div>

          <div className="card border-t-4" style={{ borderTopColor: 'var(--secondary)' }}>
            <div className="text-sm text-[var(--text-muted)] mb-1">Total Trees</div>
            <div className="text-2xl font-bold mb-1" style={{ color: 'var(--secondary)' }}>
              {summary.num_trees.toLocaleString()}
            </div>
            <div className="text-sm text-[var(--text-muted)]">trees</div>
          </div>

          <div className="card border-t-4" style={{ borderTopColor: 'var(--teal-500)' }}>
            <div className="text-sm text-[var(--text-muted)] mb-1">CO₂ Equivalent</div>
            <div className="text-2xl font-bold mb-1" style={{ color: 'var(--teal-600)' }}>
              {(summary.total_carbon_kgC * 3.667).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-[var(--text-muted)]">kg CO₂e</div>
          </div>
        </div>
      ) : null}

      {/* Charts */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Carbon Analysis</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Time series and breakdown visualizations</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold mb-4">Total Carbon vs Years</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="years_ahead" label={{ value: 'Years Ahead', position: 'insideBottom', offset: -5 }} stroke="#64748b" />
                <YAxis label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="total_carbon" stroke="var(--teal-500)" strokeWidth={2} name="Total Carbon (kg C)" dot={{ fill: 'var(--teal-500)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Carbon by Plot</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={plotData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="plot" stroke="#64748b" />
                <YAxis label={{ value: 'Carbon (kg C)', angle: -90, position: 'insideLeft' }} stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="carbon" fill="var(--green-500)" name="Carbon (kg C)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
